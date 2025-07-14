import { createReadStream, accessSync, constants } from "fs";
import { createInterface } from "readline";
import { logger } from "../../utils/logger";
import {
	FileConfig,
	FileProcessor,
	FileProcessorResult,
	StorageProvider,
} from "../../application/interfaces/file-processor.interface";
import { ValidationService } from "../../domain/services/validation-service";
import { ValidationServiceInterface } from "../../domain/interfaces/validation-service.interface";
import { DataTransformerService } from "../../domain/services/data-transformer.service";

interface ValidationResult {
	isValid: boolean;
	lineNumber: number;
	data?: any;
	errors?: string[];
}

interface ProcessingOptions {
	chunkSize: number;
	showValidRecords: boolean;
	showInvalidRecords: boolean;
	validateRecords: boolean;
	// Database storage options
	storeToDatabase?: boolean;
	onChunkProcessed?: (
		validRecords: any[],
		chunkStats: { valid: number; invalid: number },
	) => Promise<void>;
}

export class LocalProcessor implements FileProcessor {
	constructor(
		private validationService: ValidationServiceInterface = new ValidationService(),
		private options: ProcessingOptions = {
			chunkSize: 128 * 1024, // 128KB buffer
			showValidRecords: false,
			showInvalidRecords: false,
			validateRecords: true,
			storeToDatabase: false,
		},
	) {}

	/**
	 * Set the chunk processed callback for streaming
	 */
	setChunkProcessedCallback(
		callback: (
			validRecords: any[],
			chunkStats: { valid: number; invalid: number },
		) => Promise<void>,
	): void {
		this.options.onChunkProcessed = callback;
	}

	/**
	 * Enable database storage mode
	 */
	enableDatabaseStorage(): void {
		this.options.storeToDatabase = true;
	}

	async processFile(config: FileConfig): Promise<FileProcessorResult> {
		const startTime = Date.now();
		let totalLines = 0;
		let validRecords = 0;
		let invalidRecords = 0;
		let validRecordsShown = 0;
		let invalidRecordsShown = 0;
		const errors: string[] = [];

		logger.info(`Starting processing: ${config.filepath}`);

		if (config.storageProvider !== StorageProvider.LOCAL) {
			return {
				success: false,
				totalRecords: 0,
				validRecords: 0,
				invalidRecords: 0,
				processingTimeMs: 0,
				errors: ["Storage provider not supported"],
			};
		}

		if (!this.isFileValid(config)) {
			return {
				success: false,
				totalRecords: 0,
				validRecords: 0,
				invalidRecords: 0,
				processingTimeMs: 0,
				errors: ["File is not valid"],
			};
		}
		if (this.isFileProcessed(config)) {
			return {
				success: true,
				totalRecords: 0,
				validRecords: 0,
				invalidRecords: 0,
				processingTimeMs: 0,
				errors: ["File is already processed"],
			};
		}

		try {
			// Use streaming approach if database storage is enabled
			if (this.options.storeToDatabase && this.options.onChunkProcessed) {
				return await this.processFileStreaming(config, startTime);
			}

			// Original approach for backward compatibility
			return await this.processFileTraditional(config, startTime);
		} catch (error) {
			const processingTimeMs = Date.now() - startTime;
			logger.error("File processing failed", error as Error, {
				filepath: config.filepath,
				processingTimeMs,
			});

			return {
				success: false,
				totalRecords: totalLines,
				validRecords,
				invalidRecords,
				processingTimeMs,
				errors: [error instanceof Error ? error.message : "Unknown error"],
			};
		}
	}

	/**
	 * Stream processing with immediate database insertion
	 */
	private async processFileStreaming(
		config: FileConfig,
		startTime: number,
	): Promise<FileProcessorResult> {
		let totalLines = 0;
		let validRecords = 0;
		let invalidRecords = 0;
		const errors: string[] = [];

		logger.info("Using streaming processing with database insertion");

		const fileStream = createReadStream(config.filepath, {
			highWaterMark: this.options.chunkSize,
		});

		const rl = createInterface({
			input: fileStream,
			crlfDelay: Infinity,
		});

		const chunk: string[] = [];
		let chunkNumber = 0;

		for await (const line of rl) {
			totalLines++;

			// Skip empty lines
			if (line.trim() === "") {
				continue;
			}

			chunk.push(line);

			// Process chunk when it reaches the specified size
			if (chunk.length >= 100) {
				chunkNumber++;
				const chunkResult = await this.processChunkStreaming(
					chunk,
					totalLines - chunk.length + 1,
					chunkNumber,
				);

				validRecords += chunkResult.valid;
				invalidRecords += chunkResult.invalid;

				// Insert chunk into database immediately
				if (
					this.options.onChunkProcessed &&
					chunkResult.validRecords.length > 0
				) {
					try {
						await this.options.onChunkProcessed(chunkResult.validRecords, {
							valid: chunkResult.valid,
							invalid: chunkResult.invalid,
						});

						logger.debug(`Chunk ${chunkNumber} inserted into database`, {
							validRecords: chunkResult.valid,
							invalidRecords: chunkResult.invalid,
						});
					} catch (error) {
						logger.error(
							`Failed to insert chunk ${chunkNumber}`,
							error as Error,
						);
						errors.push(
							`Chunk ${chunkNumber} insertion failed: ${error instanceof Error ? error.message : "Unknown error"}`,
						);
					}
				}

				chunk.length = 0; // Clear chunk
			}
		}

		// Process remaining lines
		if (chunk.length > 0) {
			chunkNumber++;
			const chunkResult = await this.processChunkStreaming(
				chunk,
				totalLines - chunk.length + 1,
				chunkNumber,
			);

			validRecords += chunkResult.valid;
			invalidRecords += chunkResult.invalid;

			// Insert final chunk
			if (
				this.options.onChunkProcessed &&
				chunkResult.validRecords.length > 0
			) {
				try {
					await this.options.onChunkProcessed(chunkResult.validRecords, {
						valid: chunkResult.valid,
						invalid: chunkResult.invalid,
					});
				} catch (error) {
					logger.error(`Failed to insert final chunk`, error as Error);
					errors.push(
						`Final chunk insertion failed: ${error instanceof Error ? error.message : "Unknown error"}`,
					);
				}
			}
		}

		const processingTimeMs = Date.now() - startTime;

		logger.info(`Streaming processing completed`, {
			totalLines,
			validRecords,
			invalidRecords,
			processingTimeMs,
			recordsPerSecond: Math.round((totalLines / processingTimeMs) * 1000),
			chunksProcessed: chunkNumber,
		});

		return {
			success: errors.length === 0,
			totalRecords: totalLines,
			validRecords,
			invalidRecords,
			processingTimeMs,
			errors,
			records: [], // No records returned in streaming mode since they're already inserted
		};
	}

	/**
	 * Traditional processing (original approach)
	 */
	private async processFileTraditional(
		config: FileConfig,
		startTime: number,
	): Promise<FileProcessorResult> {
		let totalLines = 0;
		let validRecords = 0;
		let invalidRecords = 0;
		let validRecordsShown = 0;
		let invalidRecordsShown = 0;
		const errors: string[] = [];

		// Use optimized buffer size for reading
		const fileStream = createReadStream(config.filepath, {
			highWaterMark: this.options.chunkSize,
		});

		const rl = createInterface({
			input: fileStream,
			crlfDelay: Infinity,
		});

		const chunk: string[] = [];
		const results: ValidationResult[] = [];

		for await (const line of rl) {
			totalLines++;

			// Skip empty lines
			if (line.trim() === "") {
				continue;
			}

			chunk.push(line);

			// Process chunk when it reaches the specified size
			if (chunk.length >= 100) {
				// Process in smaller chunks for validation
				const chunkResults = await this.processChunk(
					chunk,
					totalLines - chunk.length + 1,
				);
				results.push(...chunkResults);
				chunk.length = 0;
			}
		}

		// Process remaining lines
		if (chunk.length > 0) {
			const chunkResults = await this.processChunk(
				chunk,
				totalLines - chunk.length + 1,
			);
			results.push(...chunkResults);
		}

		// Count and display results, collect valid records
		const validRecordsList: any[] = [];
		for (const result of results) {
			if (result.isValid) {
				validRecords++;
				// Add valid record to the list for database storage
				if (result.data) {
					validRecordsList.push(result.data);
				}
				if (this.options.showValidRecords) {
					this.printValidRecord(result);
					validRecordsShown++;
				}
			} else {
				invalidRecords++;
				if (this.options.showInvalidRecords) {
					this.printInvalidRecord(result);
					invalidRecordsShown++;
				}
			}
		}

		const processingTimeMs = Date.now() - startTime;

		logger.info(`Processing completed`, {
			totalLines,
			validRecords,
			invalidRecords,
			processingTimeMs,
			recordsPerSecond: Math.round((totalLines / processingTimeMs) * 1000),
			recordsCollected: validRecordsList.length,
		});

		return {
			success: true,
			totalRecords: totalLines,
			validRecords,
			invalidRecords,
			processingTimeMs,
			errors: [],
			records: validRecordsList,
		};
	}

	private async processChunkStreaming(
		chunk: string[],
		startLineNumber: number,
		chunkNumber: number,
	): Promise<{ valid: number; invalid: number; validRecords: any[] }> {
		let valid = 0;
		let invalid = 0;
		const validRecords: any[] = [];

		for (let i = 0; i < chunk.length; i++) {
			const line = chunk[i];
			const lineNumber = startLineNumber + i;

			try {
				if (this.options.validateRecords) {
					const rawData = JSON.parse(line);
					// Transform data if it's in raw format (nested structure)
					const transformedData =
						DataTransformerService.transformIfNeeded(rawData);
					const validationResult =
						this.validationService.validate(transformedData);

					if (validationResult.isValid) {
						valid++;
						validRecords.push(transformedData);
					} else {
						invalid++;
					}
				} else {
					// Skip validation, assume valid but still transform
					const rawData = JSON.parse(line);
					const transformedData =
						DataTransformerService.transformIfNeeded(rawData);
					valid++;
					validRecords.push(transformedData);
				}
			} catch (error) {
				invalid++;
				logger.debug(`Parse error at line ${lineNumber}`, {
					error: error instanceof Error ? error.message : "Unknown error",
				});
			}
		}

		logger.debug(`Chunk ${chunkNumber} processed`, {
			valid,
			invalid,
			total: chunk.length,
		});

		return { valid, invalid, validRecords };
	}

	private async processChunk(
		chunk: string[],
		startLineNumber: number,
	): Promise<ValidationResult[]> {
		const results: ValidationResult[] = [];

		for (let i = 0; i < chunk.length; i++) {
			const line = chunk[i];
			const lineNumber = startLineNumber + i;

			try {
				if (this.options.validateRecords) {
					const rawData = JSON.parse(line);
					// Transform data if it's in raw format (nested structure)
					const transformedData =
						DataTransformerService.transformIfNeeded(rawData);
					const validationResult =
						this.validationService.validate(transformedData);
					results.push({
						isValid: validationResult.isValid,
						lineNumber,
						data: validationResult.isValid ? transformedData : undefined,
						errors: validationResult.errors,
					});
				} else {
					// Skip validation, assume valid but still transform
					const rawData = JSON.parse(line);
					const transformedData =
						DataTransformerService.transformIfNeeded(rawData);
					results.push({
						isValid: true,
						lineNumber,
						data: transformedData,
					});
				}
			} catch (error) {
				results.push({
					isValid: false,
					lineNumber,
					errors: [error instanceof Error ? error.message : "Parse error"],
				});
			}
		}

		return results;
	}

	private printValidRecord(result: ValidationResult): void {
		logger.debug(`Valid Record (Line ${result.lineNumber})`, {
			data: result.data,
		});
	}

	private printInvalidRecord(result: ValidationResult): void {
		logger.debug(`Invalid Record (Line ${result.lineNumber})`, {
			errors: result.errors,
		});
	}

	isFileValid(config: FileConfig): boolean {
		try {
			// Check if file exists and is readable
			accessSync(config.filepath, constants.R_OK);
			return true;
		} catch (err) {
			logger.error("File validation failed", err as Error, {
				filepath: config.filepath,
			});
			return false;
		}
	}

	isFileProcessed(config: FileConfig): boolean {
		return false;
	}
}
