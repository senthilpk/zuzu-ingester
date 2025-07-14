import { FileProcessingOrchestratorService } from "../application/services/file-process/file-processing-orchestrator.service";
import { FileProcessingService } from "../application/services/file-process/file-processing.service";
import { JobsService } from "../application/services/jobs/jobs.service";
import { BulkProcessorService } from "../application/services/file-process/bulk-processor.service";
import {
	Platform,
	StorageProvider,
	ProcessingMetadata,
} from "../application/interfaces/file-processor.interface";
import { logger } from "../utils/logger";

/**
 * Cleaner approach Example
 *
 * This example demonstrates the proper integration of all services:
 * 1. FileProcessingOrchestratorService - Orchestrates the entire process
 * 2. FileProcessingService - Handles file reading, processing, and optional database storage
 * 3. JobsService - Manages job tracking and idempotency
 * 4. BulkProcessorService - Handles database operations
 */
async function main() {
	try {
		// 1. Initialize all services
		const jobsService = new JobsService();
		const bulkProcessor = new BulkProcessorService();
		const fileProcessingService = new FileProcessingService(bulkProcessor);

		// 2. Create the orchestrator with all dependencies
		const orchestrator = new FileProcessingOrchestratorService(
			jobsService,
			fileProcessingService,
			bulkProcessor,
		);

		// 3. Process a single file with database storage
		logger.info("Starting single file processing with database storage...");

		const singleFileMetadata: ProcessingMetadata = {
			filepath: "data/agoda_com_2025-04-10.jl",
			platform: Platform.AGODA,
			storageProvider: StorageProvider.LOCAL,
			options: {
				chunkSize: 128 * 1024,
				showValidRecords: false,
				showInvalidRecords: false,
				validateRecords: true,
				storeToDatabase: true, // Enable database storage
				dbBatchSize: 100, // Database batch size
			},
		};

		const singleFileResult = await orchestrator.processFile(
			singleFileMetadata,
			{
				batchSize: 100,
				onProgress: (stats) => {
					logger.info("Processing progress", stats);
				},
			},
		);

		logger.info("Single file processing result:", {
			jobId: singleFileResult.jobId,
			status: singleFileResult.status,
			stats: singleFileResult.stats,
			error: singleFileResult.error,
		});

		// 4. Process a file without database storage (validation only)
		logger.info("Starting file processing without database storage...");

		const validationOnlyMetadata: ProcessingMetadata = {
			filepath: "data/booking_com_2025-04-10.jl",
			platform: Platform.BOOKING,
			storageProvider: StorageProvider.LOCAL,
			options: {
				chunkSize: 128 * 1024,
				validateRecords: true,
				storeToDatabase: false, // Disable database storage
			},
		};

		const validationResult = await orchestrator.processFile(
			validationOnlyMetadata,
		);

		logger.info("Validation-only processing result:", {
			jobId: validationResult.jobId,
			status: validationResult.status,
			stats: validationResult.stats,
		});

		// 5. Process multiple files with mixed database storage settings
		logger.info("Starting multiple file processing...");

		const multipleFilesMetadata: ProcessingMetadata[] = [
			{
				filepath: "data/agoda_com_2025-04-10.jl",
				platform: Platform.AGODA,
				storageProvider: StorageProvider.LOCAL,
				options: {
					chunkSize: 128 * 1024,
					validateRecords: true,
					storeToDatabase: true, // Store to database
					dbBatchSize: 100,
				},
			},
			{
				filepath: "data/booking_com_2025-04-10.jl",
				platform: Platform.BOOKING,
				storageProvider: StorageProvider.LOCAL,
				options: {
					chunkSize: 256 * 1024, // Different chunk size
					validateRecords: true,
					storeToDatabase: false, // Don't store to database
				},
			},
		];

		const multipleFilesResult = await orchestrator.processFiles(
			multipleFilesMetadata,
			{
				batchSize: 100,
			},
		);

		logger.info("Multiple files processing results:", multipleFilesResult);

		// 6. Summary
		const completedJobs = multipleFilesResult.filter(
			(r) => r.status === "completed",
		).length;
		const failedJobs = multipleFilesResult.filter(
			(r) => r.status === "failed",
		).length;
		const skippedJobs = multipleFilesResult.filter(
			(r) => r.status === "already_processed",
		).length;

		const totalHotelsInserted = multipleFilesResult.reduce(
			(sum, r) => sum + (r.stats?.hotelsInserted || 0),
			0,
		);
		const totalReviewsInserted = multipleFilesResult.reduce(
			(sum, r) => sum + (r.stats?.reviewsInserted || 0),
			0,
		);

		logger.info("Processing summary:", {
			totalFiles: multipleFilesResult.length,
			completed: completedJobs,
			failed: failedJobs,
			skipped: skippedJobs,
			totalHotelsInserted,
			totalReviewsInserted,
		});
	} catch (error) {
		logger.error(
			"Example execution failed",
			error instanceof Error ? error : new Error(String(error)),
		);
	}
}

export { main as runOrchestratorUsage };
