import {
	JobsRepository,
	CreateJobData,
	UpdateJobStatusData,
} from "../../../infrastructure/database/repositories/jobs.repository";
import { logger } from "../../../utils/logger";

export class JobsService {
	private jobsRepository: JobsRepository;

	constructor() {
		this.jobsRepository = new JobsRepository();
	}

	/**
	 * Check if job is already processed (idempotency)
	 */
	async isJobProcessed(jobId: string) {
		try {
			return await this.jobsRepository.isJobProcessed(jobId);
		} catch (error) {
			logger.error(
				"Error checking if job is processed",
				error instanceof Error ? error : new Error(String(error)),
				{ jobId },
			);
			throw error;
		}
	}

	/**
	 * Get processing job
	 */
	async getProcessingJob(jobId: string) {
		try {
			return await this.jobsRepository.getProcessingJob(jobId);
		} catch (error) {
			logger.error(
				"Error getting processing job",
				error instanceof Error ? error : new Error(String(error)),
				{ jobId },
			);
			throw error;
		}
	}

	/**
	 * Create processing job
	 */
	async createProcessingJob(jobData: CreateJobData) {
		try {
			return await this.jobsRepository.createProcessingJob(jobData);
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
	) {
		try {
			return await this.jobsRepository.updateProcessingJobStatus(
				jobId,
				updateData,
			);
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
	async getJobsByStatus(status: string, limit: number = 10) {
		try {
			return await this.jobsRepository.getJobsByStatus(status, limit);
		} catch (error) {
			logger.error(
				"Error getting jobs by status",
				error instanceof Error ? error : new Error(String(error)),
				{ status },
			);
			throw error;
		}
	}

	/**
	 * Get all jobs with pagination
	 */
	async getAllJobs(limit: number = 10, offset: number = 0) {
		try {
			return await this.jobsRepository.getAllJobs(limit, offset);
		} catch (error) {
			logger.error(
				"Error getting all jobs",
				error instanceof Error ? error : new Error(String(error)),
			);
			throw error;
		}
	}
}
