import { db } from "../connection";
import { processingJobs } from "../schema";
import { logger } from "../../../utils/logger";
import { eq, and, desc, asc, count, sql } from "drizzle-orm";

export interface ProcessingJob {
	id: number;
	jobId: string;
	filepath: string;
	platform: string;
	storageProvider: string;
	status: string; // String from DB, can be "pending", "processing", "completed", "failed"
	totalRecords: number | null;
	validRecords: number | null;
	invalidRecords: number | null;
	processingTimeMs: number | null;
	errors: any;
	metadata: any;
	startedAt: Date | null;
	completedAt: Date | null;
	createdAt: Date | null;
	updatedAt: Date | null;
}

export interface CreateJobData {
	jobId: string;
	filepath: string;
	platform: string;
	storageProvider: string;
	metadata?: any;
}

export interface UpdateJobStatusData {
	status: "pending" | "processing" | "completed" | "failed";
	totalRecords?: number;
	validRecords?: number;
	invalidRecords?: number;
	processingTimeMs?: number;
	errors?: string[];
}

export class JobsRepository {
	/**
	 * Check if a processing job already exists (idempotency check)
	 */
	async isJobProcessed(jobId: string): Promise<boolean> {
		try {
			const result = await db
				.select({ id: processingJobs.id, status: processingJobs.status })
				.from(processingJobs)
				.where(eq(processingJobs.jobId, jobId))
				.limit(1);

			return result.length > 0 && result[0].status === "completed";
		} catch (error) {
			logger.error(
				"Error checking job status",
				error instanceof Error ? error : new Error(String(error)),
				{ jobId },
			);
			return false;
		}
	}

	/**
	 * Get existing processing job
	 */
	async getProcessingJob(jobId: string): Promise<ProcessingJob | null> {
		try {
			const result = await db
				.select()
				.from(processingJobs)
				.where(eq(processingJobs.jobId, jobId))
				.limit(1);

			return result[0] || null;
		} catch (error) {
			logger.error(
				"Error getting processing job",
				error instanceof Error ? error : new Error(String(error)),
				{ jobId },
			);
			return null;
		}
	}

	/**
	 * Create a new processing job
	 */
	async createProcessingJob(jobData: CreateJobData): Promise<ProcessingJob> {
		try {
			const [job] = await db
				.insert(processingJobs)
				.values({
					jobId: jobData.jobId,
					filepath: jobData.filepath,
					platform: jobData.platform,
					storageProvider: jobData.storageProvider,
					status: "pending",
					metadata: jobData.metadata,
				})
				.returning();

			logger.info("Processing job created", { jobId: job.jobId });
			return job;
		} catch (error) {
			logger.error(
				"Error creating processing job",
				error instanceof Error ? error : new Error(String(error)),
				{ jobData },
			);
			throw error;
		}
	}

	/**
	 * Update processing job status
	 */
	async updateProcessingJobStatus(
		jobId: string,
		updateData: UpdateJobStatusData,
	): Promise<ProcessingJob | null> {
		try {
			const updateValues: any = {
				status: updateData.status,
				updatedAt: new Date(),
			};

			if (updateData.status === "processing") {
				updateValues.startedAt = new Date();
			} else if (
				updateData.status === "completed" ||
				updateData.status === "failed"
			) {
				updateValues.completedAt = new Date();
				if (updateData.totalRecords !== undefined)
					updateValues.totalRecords = updateData.totalRecords;
				if (updateData.validRecords !== undefined)
					updateValues.validRecords = updateData.validRecords;
				if (updateData.invalidRecords !== undefined)
					updateValues.invalidRecords = updateData.invalidRecords;
				if (updateData.processingTimeMs !== undefined)
					updateValues.processingTimeMs = updateData.processingTimeMs;
				if (updateData.errors !== undefined)
					updateValues.errors = updateData.errors;
			}

			const [job] = await db
				.update(processingJobs)
				.set(updateValues)
				.where(eq(processingJobs.jobId, jobId))
				.returning();

			logger.info("Processing job status updated", {
				jobId,
				status: updateData.status,
			});
			return job || null;
		} catch (error) {
			logger.error(
				"Error updating processing job status",
				error instanceof Error ? error : new Error(String(error)),
				{ jobId, updateData },
			);
			throw error;
		}
	}

	/**
	 * Get jobs by status
	 */
	async getJobsByStatus(
		status: string,
		limit: number = 10,
	): Promise<ProcessingJob[]> {
		try {
			const result = await db
				.select()
				.from(processingJobs)
				.where(eq(processingJobs.status, status))
				.orderBy(desc(processingJobs.createdAt))
				.limit(limit);

			return result;
		} catch (error) {
			logger.error(
				"Error getting jobs by status",
				error instanceof Error ? error : new Error(String(error)),
				{ status },
			);
			return [];
		}
	}

	/**
	 * Get all jobs with pagination
	 */
	async getAllJobs(
		limit: number = 10,
		offset: number = 0,
	): Promise<ProcessingJob[]> {
		try {
			const result = await db
				.select()
				.from(processingJobs)
				.orderBy(desc(processingJobs.createdAt))
				.limit(limit)
				.offset(offset);

			return result;
		} catch (error) {
			logger.error(
				"Error getting all jobs",
				error instanceof Error ? error : new Error(String(error)),
			);
			return [];
		}
	}
}
