import { logger } from "../../../utils/logger";
import {
	FileConfig,
	FileProcessorResult,
	ProcessingMetadata,
} from "../../interfaces/file-processor.interface";

import {
	BulkProcessorService,
	ProcessingStats,
} from "./bulk-processor.service";
import { getProcessor } from "./processor-factory";

export interface ProcessingResult extends FileProcessorResult {
	metadata: ProcessingMetadata;
	databaseStats?: ProcessingStats;
}

export class FileProcessingService {
	constructor(private bulkProcessor?: BulkProcessorService) {}

	/**
	 * Main entry point for file processing
	 */
	async processFile(metadata: ProcessingMetadata): Promise<ProcessingResult> {
		try {
			logger.info("Starting file processing", {
				filepath: metadata.filepath,
				storeToDatabase: metadata.options?.storeToDatabase || false,
			});

			// Validate metadata
			this.validateMetadata(metadata);

			// Create appropriate processor
			const processor = getProcessor(metadata);

			// Convert metadata to FileConfig
			const fileConfig: FileConfig = {
				filepath: metadata.filepath,
				platform: metadata.platform,
				storageProvider: metadata.storageProvider,
			};

			// If database storage is requested and bulk processor is available
			if (metadata.options?.storeToDatabase && this.bulkProcessor) {
				// Use streaming approach for database storage
				return await this.processFileStreaming(metadata, processor, fileConfig);
			}

			// Traditional approach - process file without database storage
			const fileResult = await processor.processFile(fileConfig);

			logger.info("File processing completed", {
				filepath: metadata.filepath,
				success: fileResult.success,
				totalRecords: fileResult.totalRecords,
				validRecords: fileResult.validRecords,
				invalidRecords: fileResult.invalidRecords,
				processingTimeMs: fileResult.processingTimeMs,
			});

			return {
				...fileResult,
				metadata,
			};
		} catch (error) {
			logger.error(
				"File processing failed",
				error instanceof Error ? error : new Error(String(error)),
				{
					filepath: metadata.filepath,
				},
			);

			return {
				success: false,
				totalRecords: 0,
				validRecords: 0,
				invalidRecords: 0,
				processingTimeMs: 0,
				errors: [
					error instanceof Error ? error.message : "Unknown error occurred",
				],
				metadata,
			};
		}
	}

	/**
	 * Process file using streaming approach with immediate database insertion
	 */
	private async processFileStreaming(
		metadata: ProcessingMetadata,
		processor: any,
		fileConfig: FileConfig,
	): Promise<ProcessingResult> {
		logger.info(
			"Using streaming processing with immediate database insertion",
			{
				filepath: metadata.filepath,
			},
		);

		// Track database stats during streaming
		let totalHotelsInserted = 0;
		let totalReviewsInserted = 0;

		// Configure processor for streaming using the new methods
		if (
			processor.setChunkProcessedCallback &&
			processor.enableDatabaseStorage
		) {
			processor.enableDatabaseStorage();
			processor.setChunkProcessedCallback(
				async (
					validRecords: any[],
					chunkStats: { valid: number; invalid: number },
				) => {
					if (validRecords.length > 0) {
						try {
							const dbStats = await this.bulkProcessor!.processRecords(
								validRecords,
								metadata.processingJobId || "",
								{
									batchSize: metadata.options?.dbBatchSize || 100,
									onProgress: (stats) => {
										logger.debug("Streaming database progress", {
											filepath: metadata.filepath,
											...stats,
										});
									},
								},
							);

							// Accumulate database stats
							totalHotelsInserted += dbStats.hotelsInserted;
							totalReviewsInserted += dbStats.reviewsInserted;

							logger.debug("Chunk processed and inserted", {
								filepath: metadata.filepath,
								chunkValidRecords: validRecords.length,
								chunkHotelsInserted: dbStats.hotelsInserted,
								chunkReviewsInserted: dbStats.reviewsInserted,
								totalHotelsInserted,
								totalReviewsInserted,
							});
						} catch (error) {
							logger.error(
								"Failed to process chunk in streaming mode",
								error as Error,
								{
									filepath: metadata.filepath,
									chunkValidRecords: validRecords.length,
								},
							);
							throw error; // Re-throw to stop processing
						}
					}
				},
			);
		}

		// Process file with streaming
		const fileResult = await processor.processFile(fileConfig);

		return {
			...fileResult,
			metadata,
			// Use accumulated database stats from streaming
			databaseStats: {
				totalRecords: fileResult.totalRecords,
				validRecords: fileResult.validRecords,
				invalidRecords: fileResult.invalidRecords,
				processingTimeMs: fileResult.processingTimeMs,
				hotelsInserted: totalHotelsInserted,
				reviewsInserted: totalReviewsInserted,
			},
		};
	}

	/**
	 * Validate processing metadata
	 */
	private validateMetadata(metadata: ProcessingMetadata): void {
		if (!metadata.filepath) {
			throw new Error("Filepath is required");
		}

		if (!metadata.platform) {
			throw new Error("Platform is required");
		}

		if (!metadata.storageProvider) {
			throw new Error("Storage provider is required");
		}

		// Validate database storage requirements
		if (metadata.options?.storeToDatabase && !this.bulkProcessor) {
			throw new Error("BulkProcessorService is required for database storage");
		}

		// Validate database storage requirements
		if (metadata.options?.storeToDatabase && !this.bulkProcessor) {
			throw new Error("BulkProcessorService is required for database storage");
		}
	}
}
