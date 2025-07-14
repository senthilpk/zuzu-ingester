import { S3Client } from "bun";
import { ValidationService } from "../../domain/services/validation-service";
import { ValidationServiceInterface } from "../../domain/interfaces/validation-service.interface";
import { DataTransformerService } from "../../domain/services/data-transformer.service";
import {
	FileProcessor,
	FileConfig,
	FileProcessorResult,
} from "../../application/interfaces/file-processor.interface";
import { logger } from "../../utils/logger";

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

export class S3Processor implements FileProcessor {
	constructor(
		private s3Client: S3Client,
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

		logger.info("Processing file with streaming", {
			filepath: config.filepath,
			platform: config.platform,
			storageProvider: config.storageProvider,
		});

		try {
			// Check if file is valid
			if (!(await this.isFileValid(config))) {
				return {
					success: false,
					totalRecords: 0,
					validRecords: 0,
					invalidRecords: 0,
					processingTimeMs: 0,
					errors: ["File is not valid"],
				};
			}

			// Check if file is already processed
			if (await this.isFileProcessed(config)) {
				return {
					success: true,
					totalRecords: 0,
					validRecords: 0,
					invalidRecords: 0,
					processingTimeMs: 0,
					errors: ["File is already processed"],
				};
			}

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

		logger.info("Using S3 streaming processing with database insertion");

		// Use Bun's native S3 file API with chunked reading
		const s3File = this.s3Client.file(config.filepath);

		// Read file in chunks using Bun's streaming capabilities
		const chunk: string[] = [];
		let buffer = "";
		let chunkNumber = 0;

		// Get file size for progress tracking
		const stat = await s3File.stat();
		const fileSize = stat.size;
		let bytesRead = 0;

		// Read file in chunks using stream
		const stream = await s3File.stream();
		const reader = stream.getReader();
		const decoder = new TextDecoder();

		try {
			while (true) {
				const { done, value } = await reader.read();

				if (done) break;

				bytesRead += value.length;
				buffer += decoder.decode(value, { stream: true });

				// Process complete lines from buffer
				const lines = buffer.split("\n");
				buffer = lines.pop() || ""; // Keep incomplete line in buffer

				for (const line of lines) {
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

								logger.debug(`S3 Chunk ${chunkNumber} inserted into database`, {
									validRecords: chunkResult.valid,
									invalidRecords: chunkResult.invalid,
								});
							} catch (error) {
								logger.error(
									`Failed to insert S3 chunk ${chunkNumber}`,
									error as Error,
								);
								errors.push(
									`Chunk ${chunkNumber} insertion failed: ${error instanceof Error ? error.message : "Unknown error"}`,
								);
							}
						}

						chunk.length = 0; // Clear chunk

						// Log progress for large files
						if (fileSize > 10 * 1024 * 1024) {
							// > 10MB
							const progress = Math.round((bytesRead / fileSize) * 100);
							logger.debug(`S3 Processing progress: ${progress}%`, {
								filepath: config.filepath,
								bytesRead,
								fileSize,
								totalLines,
							});
						}
					}
				}
			}

			// Process any remaining data in buffer
			if (buffer.trim()) {
				totalLines++;
				chunk.push(buffer.trim());
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
						logger.error(`Failed to insert final S3 chunk`, error as Error);
						errors.push(
							`Final chunk insertion failed: ${error instanceof Error ? error.message : "Unknown error"}`,
						);
					}
				}
			}
		} finally {
			reader.releaseLock();
		}

		const processingTimeMs = Date.now() - startTime;

		logger.info("S3 streaming processing completed", {
			filepath: config.filepath,
			totalRecords: totalLines,
			validRecords,
			invalidRecords,
			processingTimeMs,
		});

		return {
			success: true,
			totalRecords: totalLines,
			validRecords,
			invalidRecords,
			processingTimeMs,
			errors,
		};
	}

	/**
	 * Traditional processing approach (for backward compatibility)
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

		// Use Bun's native S3 file API with chunked reading
		const s3File = this.s3Client.file(config.filepath);

		// Read file in chunks using Bun's streaming capabilities
		const chunk: string[] = [];
		const results: ValidationResult[] = [];
		let buffer = "";

		// Get file size for progress tracking
		const stat = await s3File.stat();
		const fileSize = stat.size;
		let bytesRead = 0;

		// Read file in chunks using stream
		const stream = await s3File.stream();
		const reader = stream.getReader();
		const decoder = new TextDecoder();

		try {
			while (true) {
				const { done, value } = await reader.read();

				if (done) break;

				bytesRead += value.length;
				buffer += decoder.decode(value, { stream: true });

				// Process complete lines from buffer
				const lines = buffer.split("\n");
				buffer = lines.pop() || ""; // Keep incomplete line in buffer

				for (const line of lines) {
					totalLines++;

					// Skip empty lines
					if (line.trim() === "") {
						continue;
					}

					chunk.push(line);

					// Process chunk when it reaches the specified size
					if (chunk.length >= 100) {
						const chunkResults = await this.processChunk(
							chunk,
							totalLines - chunk.length + 1,
						);
						results.push(...chunkResults);
						chunk.length = 0;

						// Log progress for large files
						if (fileSize > 10 * 1024 * 1024) {
							// > 10MB
							const progress = Math.round((bytesRead / fileSize) * 100);
							logger.debug(`Processing progress: ${progress}%`, {
								filepath: config.filepath,
								bytesRead,
								fileSize,
								totalLines,
							});
						}
					}
				}
			}

			// Process any remaining data in buffer
			if (buffer.trim()) {
				totalLines++;
				chunk.push(buffer.trim());
			}

			// Process remaining lines
			if (chunk.length > 0) {
				const chunkResults = await this.processChunk(
					chunk,
					totalLines - chunk.length + 1,
				);
				results.push(...chunkResults);
			}
		} finally {
			reader.releaseLock();
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

		logger.info("S3Processor completed", {
			filepath: config.filepath,
			totalRecords: totalLines,
			validRecords,
			invalidRecords,
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

	/**
	 * Process chunk with streaming support
	 */
	private async processChunkStreaming(
		chunk: string[],
		startLineNumber: number,
		chunkNumber: number,
	): Promise<{ valid: number; invalid: number; validRecords: any[] }> {
		const results = await this.processChunk(chunk, startLineNumber);
		const validRecords: any[] = [];
		let valid = 0;
		let invalid = 0;

		for (const result of results) {
			if (result.isValid) {
				valid++;
				if (result.data) {
					validRecords.push(result.data);
				}
			} else {
				invalid++;
			}
		}

		logger.debug(`S3 Chunk ${chunkNumber} processed`, {
			valid,
			invalid,
			validRecords: validRecords.length,
		});

		return { valid, invalid, validRecords };
	}

	/**
	 * Process a chunk of lines
	 */
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

					// Transform the data to flattened structure
					const transformedData =
						DataTransformerService.transformHotelReview(rawData);

					// Validate the transformed data
					const validationResult =
						this.validationService.validate(transformedData);

					if (validationResult.isValid) {
						results.push({
							isValid: true,
							lineNumber,
							data: transformedData,
						});
					} else {
						results.push({
							isValid: false,
							lineNumber,
							errors: validationResult.errors,
						});
					}
				} else {
					// Skip validation, assume valid
					results.push({
						isValid: true,
						lineNumber,
						data: JSON.parse(line),
					});
				}
			} catch (error) {
				results.push({
					isValid: false,
					lineNumber,
					errors: [
						error instanceof Error ? error.message : "Invalid JSON format",
					],
				});
			}
		}

		return results;
	}

	/**
	 * Print valid record for debugging
	 */
	private printValidRecord(result: ValidationResult): void {
		logger.debug(`✅ Line ${result.lineNumber}: Valid record`);
		if (this.options.showValidRecords && result.data) {
			logger.debug("Valid record data", { data: result.data });
		}
	}

	/**
	 * Print invalid record for debugging
	 */
	private printInvalidRecord(result: ValidationResult): void {
		logger.debug(`❌ Line ${result.lineNumber}: Invalid record`);
		if (this.options.showInvalidRecords && result.errors) {
			logger.debug("Invalid record errors", { errors: result.errors });
		}
	}

	/**
	 * Check if file is valid
	 */
	async isFileValid(config: FileConfig): Promise<boolean> {
		try {
			const s3File = this.s3Client.file(config.filepath);
			const stat = await s3File.stat();

			// Check if file exists and has content
			if (!stat || stat.size === 0) {
				logger.warn("S3 file is empty or does not exist", {
					filepath: config.filepath,
				});
				return false;
			}

			// Check file extension
			if (!config.filepath.endsWith(".jl")) {
				logger.warn("S3 file does not have .jl extension", {
					filepath: config.filepath,
				});
				return false;
			}

			return true;
		} catch (error) {
			logger.error("Error checking S3 file validity", error as Error, {
				filepath: config.filepath,
			});
			return false;
		}
	}

	/**
	 * Check if file is already processed
	 */
	async isFileProcessed(config: FileConfig): Promise<boolean> {
		// For now, we'll assume files are not processed
		// In a real implementation, you might check a database or metadata
		return false;
	}
}
