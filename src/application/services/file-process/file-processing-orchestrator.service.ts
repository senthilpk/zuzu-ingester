import { JobsService } from "../jobs/jobs.service";
import { FileProcessingService } from "./file-processing.service";
import {
	BulkProcessorService,
	ProcessingStats,
} from "./bulk-processor.service";
import { logger } from "../../../utils/logger";
import { createHash } from "crypto";
import {
	ProcessingMetadata,
	StorageProvider,
	Platform,
} from "../../interfaces/file-processor.interface";

export enum FileProcessingStatus {
	COMPLETED = "completed",
	ALREADY_PROCESSED = "already_processed",
	FAILED = "failed",
}

export interface FileProcessingOptions {
	batchSize?: number;
	onProgress?: (stats: Partial<ProcessingStats>) => void;
}

export interface FileProcessingResult {
	jobId: string;
	status: FileProcessingStatus;
	stats?: ProcessingStats;
	error?: string;
}

export class FileProcessingOrchestratorService {
	constructor(
		private jobsService: JobsService,
		private fileProcessingService: FileProcessingService,
		private bulkProcessor: BulkProcessorService,
	) {}

	/**
	 * Start file processing asynchronously (non-blocking)
	 * Returns job details immediately while processing happens in background
	 */
	async startFileProcessing(
		metadata: ProcessingMetadata,
		options: FileProcessingOptions = {},
	): Promise<FileProcessingResult> {
		const jobId = this.generateJobId(metadata.filepath, metadata.platform);

		try {
			// 1. Check if job already exists
			const existingJob = await this.jobsService.getProcessingJob(jobId);

			if (existingJob) {
				if (existingJob.status === "completed") {
					return {
						jobId,
						status: FileProcessingStatus.ALREADY_PROCESSED,
						stats: {
							totalRecords: existingJob.totalRecords || 0,
							validRecords: existingJob.validRecords || 0,
							invalidRecords: existingJob.invalidRecords || 0,
							processingTimeMs: existingJob.processingTimeMs || 0,
							hotelsInserted: 0, // Not stored in ProcessingJob
							reviewsInserted: 0, // Not stored in ProcessingJob
						},
					};
				} else if (existingJob.status === "processing") {
					return {
						jobId,
						status: FileProcessingStatus.FAILED,
						error: "File is currently being processed",
					};
				}
			} else {
				// 2. Create Processing Job
				await this.jobsService.createProcessingJob({
					jobId,
					filepath: metadata.filepath,
					platform: metadata.platform,
					storageProvider: metadata.storageProvider,
				});
			}

			// 3. Update Status to Processing
			await this.jobsService.updateProcessingJobStatus(jobId, {
				status: "processing",
			});

			// 4. Start async processing (don't await)
			this.processFileAsync(metadata, jobId, options);

			// 5. Return immediately with job details
			return {
				jobId,
				status: FileProcessingStatus.COMPLETED, // Will be updated by async process
			};
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);

			// Update job status to failed
			await this.jobsService.updateProcessingJobStatus(jobId, {
				status: FileProcessingStatus.FAILED,
				errors: [errorMessage],
			});

			return {
				jobId,
				status: FileProcessingStatus.FAILED,
				error: errorMessage,
			};
		}
	}

	/**
	 * Process file asynchronously in the background
	 */
	private async processFileAsync(
		metadata: ProcessingMetadata,
		jobId: string,
		options: FileProcessingOptions = {},
	): Promise<void> {
		try {
			// Process File using FileProcessingService
			const processingMetadata: ProcessingMetadata = {
				...metadata,
				processingJobId: jobId,
				options: {
					chunkSize: 128 * 1024,
					showValidRecords: false,
					showInvalidRecords: false,
					validateRecords: true,
					storeToDatabase: metadata.options?.storeToDatabase || false,
					dbBatchSize: metadata.options?.dbBatchSize || 100,
					...metadata.options,
					...options,
				},
			};

			const fileResult =
				await this.fileProcessingService.processFile(processingMetadata);

			if (!fileResult.success) {
				throw new Error(
					`File processing failed: ${fileResult.errors?.join(", ")}`,
				);
			}

			// 5. Update Job Status to Completed
			const jobStats = {
				totalRecords: fileResult.totalRecords,
				validRecords: fileResult.validRecords,
				invalidRecords: fileResult.invalidRecords,
				processingTimeMs: fileResult.processingTimeMs,
			};

			// Add database stats if available
			if (fileResult.databaseStats) {
				Object.assign(jobStats, {
					hotelsInserted: fileResult.databaseStats.hotelsInserted,
					reviewsInserted: fileResult.databaseStats.reviewsInserted,
				});
			}

			await this.jobsService.updateProcessingJobStatus(jobId, {
				status: FileProcessingStatus.COMPLETED,
				...jobStats,
			});

			logger.info("Async file processing completed successfully", {
				jobId,
				filepath: metadata.filepath,
				totalRecords: fileResult.totalRecords,
				validRecords: fileResult.validRecords,
				invalidRecords: fileResult.invalidRecords,
				processingTimeMs: fileResult.processingTimeMs,
				databaseStats: fileResult.databaseStats,
			});
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);

			// Update job status to failed
			await this.jobsService.updateProcessingJobStatus(jobId, {
				status: FileProcessingStatus.FAILED,
				errors: [errorMessage],
			});

			logger.error(
				"Async file processing failed",
				error instanceof Error ? error : new Error(String(error)),
				{
					jobId,
					filepath: metadata.filepath,
					error: errorMessage,
				},
			);
		}
	}

	/**
	 * Process a file with idempotency and proper file processing
	 */
	async processFile(
		metadata: ProcessingMetadata,
		options: FileProcessingOptions = {},
	): Promise<FileProcessingResult> {
		const jobId = this.generateJobId(metadata.filepath, metadata.platform);

		try {
			// 1. Check if job already exists
			const existingJob = await this.jobsService.getProcessingJob(jobId);

			if (existingJob) {
				// Job exists, check its status
				if (existingJob.status === "completed") {
					logger.info("File already processed, skipping", {
						jobId,
						filepath: metadata.filepath,
					});
					return { jobId, status: FileProcessingStatus.ALREADY_PROCESSED };
				} else if (existingJob.status === "processing") {
					logger.warn("File is currently being processed, skipping", {
						jobId,
						filepath: metadata.filepath,
					});
					return {
						jobId,
						status: FileProcessingStatus.FAILED,
						error: "File is currently being processed",
					};
				} else if (existingJob.status === "failed") {
					logger.info("Retrying failed job", {
						jobId,
						filepath: metadata.filepath,
					});
					// Continue with processing, we'll update the existing job
				}
			} else {
				// 2. Create Processing Job only if it doesn't exist
				await this.jobsService.createProcessingJob({
					jobId,
					filepath: metadata.filepath,
					platform: metadata.platform,
					storageProvider: metadata.storageProvider,
				});
			}

			// 3. Update Status to Processing
			await this.jobsService.updateProcessingJobStatus(jobId, {
				status: "processing",
			});

			// 4. Process File using FileProcessingService
			const processingMetadata: ProcessingMetadata = {
				...metadata,
				processingJobId: jobId, // Pass the real job ID
				options: {
					chunkSize: 128 * 1024,
					showValidRecords: false,
					showInvalidRecords: false,
					validateRecords: true,
					storeToDatabase: metadata.options?.storeToDatabase || false,
					dbBatchSize: metadata.options?.dbBatchSize || 100,
					...metadata.options,
					...options,
				},
			};

			const fileResult =
				await this.fileProcessingService.processFile(processingMetadata);

			if (!fileResult.success) {
				throw new Error(
					`File processing failed: ${fileResult.errors?.join(", ")}`,
				);
			}

			// 5. Update Job Status to Completed
			const jobStats = {
				totalRecords: fileResult.totalRecords,
				validRecords: fileResult.validRecords,
				invalidRecords: fileResult.invalidRecords,
				processingTimeMs: fileResult.processingTimeMs,
			};

			// Add database stats if available
			if (fileResult.databaseStats) {
				Object.assign(jobStats, {
					hotelsInserted: fileResult.databaseStats.hotelsInserted,
					reviewsInserted: fileResult.databaseStats.reviewsInserted,
				});
			}

			await this.jobsService.updateProcessingJobStatus(jobId, {
				status: FileProcessingStatus.COMPLETED,
				...jobStats,
			});

			logger.info("File processing completed successfully", {
				jobId,
				filepath: metadata.filepath,
				totalRecords: fileResult.totalRecords,
				validRecords: fileResult.validRecords,
				invalidRecords: fileResult.invalidRecords,
				processingTimeMs: fileResult.processingTimeMs,
				databaseStats: fileResult.databaseStats,
			});

			return {
				jobId,
				status: FileProcessingStatus.COMPLETED,
				stats: {
					totalRecords: fileResult.totalRecords,
					validRecords: fileResult.validRecords,
					invalidRecords: fileResult.invalidRecords,
					processingTimeMs: fileResult.processingTimeMs,
					hotelsInserted: fileResult.databaseStats?.hotelsInserted || 0,
					reviewsInserted: fileResult.databaseStats?.reviewsInserted || 0,
				},
			};
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);

			// Update job status to failed
			await this.jobsService.updateProcessingJobStatus(jobId, {
				status: FileProcessingStatus.FAILED,
				errors: [errorMessage],
			});

			logger.error(
				"File processing failed",
				error instanceof Error ? error : new Error(String(error)),
				{
					jobId,
					filepath: metadata.filepath,
					error: errorMessage,
				},
			);

			return {
				jobId,
				status: FileProcessingStatus.FAILED,
				error: errorMessage,
			};
		}
	}

	/**
	 * Process multiple files
	 */
	async processFiles(
		files: ProcessingMetadata[],
		options: FileProcessingOptions = {},
	): Promise<FileProcessingResult[]> {
		const results: FileProcessingResult[] = [];

		for (const metadata of files) {
			try {
				const result = await this.processFile(metadata, options);
				results.push(result);
			} catch (error) {
				logger.error(
					"Error processing file",
					error instanceof Error ? error : new Error(String(error)),
					{
						filepath: metadata.filepath,
					},
				);

				results.push({
					jobId: this.generateJobId(metadata.filepath, metadata.platform),
					status: FileProcessingStatus.FAILED,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}

		return results;
	}

	/**
	 * Get processing statistics
	 */
	async getProcessingStatistics() {
		// This method doesn't exist in JobsService yet, so we'll skip it for now
		return { message: "Statistics not available yet" };
	}

	/**
	 * Generate deterministic job ID
	 */
	private generateJobId(filepath: string, platform: Platform): string {
		const hash = createHash("md5")
			.update(`${filepath}-${platform}`)
			.digest("hex");
		return `job-${hash}`;
	}

	/**
	 * Update job progress (non-blocking)
	 */
	private async updateJobProgress(
		jobId: string,
		stats: Partial<ProcessingStats>,
	) {
		try {
			// Only update if we have meaningful progress
			if (stats.totalRecords && stats.validRecords !== undefined) {
				await this.jobsService.updateProcessingJobStatus(jobId, {
					status: "processing",
					totalRecords: stats.totalRecords,
					validRecords: stats.validRecords,
					invalidRecords: stats.invalidRecords || 0,
					processingTimeMs: stats.processingTimeMs,
				});
			}
		} catch (error) {
			// Don't fail the main process for progress updates
			logger.warn(
				"Failed to update job progress",
				error instanceof Error ? error : new Error(String(error)),
			);
		}
	}
}
