import { OpenAPIHono } from "@hono/zod-openapi";
import { z } from "zod";
import {
	FileProcessingOrchestratorService,
	FileProcessingStatus,
} from "../../application/services/file-process/file-processing-orchestrator.service";
import { ProcessingMetadata } from "../../application/interfaces/file-processor.interface";
import { logger } from "../../utils/logger";
import { JobsService } from "../../application/services/jobs/jobs.service";
import { FileProcessingService } from "../../application/services/file-process/file-processing.service";
import { BulkProcessorService } from "../../application/services/file-process/bulk-processor.service";
import {
	ProcessFileRequestSchema,
	ProcessFileResponseSchema,
	JobStatusResponseSchema,
	ListJobsQuerySchema,
	ErrorResponseSchema,
} from "../schemas";
import { ListJobsResponseSchema } from "../schemas/processing.schemas";

const processingRoute = new OpenAPIHono();

// Initialize services
const jobsService = new JobsService();
const bulkProcessor = new BulkProcessorService();
const fileProcessingService = new FileProcessingService(bulkProcessor);
const orchestrator = new FileProcessingOrchestratorService(
	jobsService,
	fileProcessingService,
	bulkProcessor,
);

// Process single file endpoint
processingRoute.openapi(
	{
		method: "post",
		path: "/process-file",
		request: {
			body: {
				content: {
					"application/json": {
						schema: ProcessFileRequestSchema,
					},
				},
			},
		},
		responses: {
			200: {
				content: {
					"application/json": {
						schema: ProcessFileResponseSchema,
					},
				},
				description: "File processing started successfully",
			},
			400: {
				content: {
					"application/json": {
						schema: ErrorResponseSchema,
					},
				},
				description: "Bad request - invalid input",
			},
			500: {
				content: {
					"application/json": {
						schema: ErrorResponseSchema,
					},
				},
				description: "Internal server error",
			},
		},
		tags: ["File Processing"],
		summary: "Process a single file",
		description:
			"Process a hotel review file with validation and optional database storage",
	},
	async (c) => {
		try {
			const body = await c.req.json();
			const validatedData = ProcessFileRequestSchema.parse(body);

			const metadata: ProcessingMetadata = {
				filepath: validatedData.filepath,
				platform: validatedData.platform,
				storageProvider: validatedData.storageProvider,
				options: validatedData.options,
			};

			const result = await orchestrator.startFileProcessing(metadata);

			return c.json({
				success: true,
				result,
				message:
					result.status === "completed"
						? "File processing completed successfully"
						: "File processing started asynchronously",
			});
		} catch (error) {
			logger.error(
				"Error processing file",
				error instanceof Error ? error : new Error(String(error)),
			);

			if (error instanceof z.ZodError) {
				return c.json(
					{
						success: false,
						error: "VALIDATION_ERROR",
						message: "Invalid request data",
					},
					400,
				);
			}

			return c.json(
				{
					success: false,
					error: "PROCESSING_ERROR",
					message:
						error instanceof Error ? error.message : "Unknown error occurred",
				},
				500,
			);
		}
	},
);

// Get job status endpoint
processingRoute.openapi(
	{
		method: "get",
		path: "/job/{jobId}",
		request: {
			params: z.object({
				jobId: z.string().describe("The job ID to get status for"),
			}),
		},
		responses: {
			200: {
				content: {
					"application/json": {
						schema: JobStatusResponseSchema,
					},
				},
				description: "Job status retrieved successfully",
			},
			400: {
				content: {
					"application/json": {
						schema: ErrorResponseSchema,
					},
				},
				description: "Bad request - missing job ID",
			},
			404: {
				content: {
					"application/json": {
						schema: ErrorResponseSchema,
					},
				},
				description: "Job not found",
			},
		},
		tags: ["Job Management"],
		summary: "Get job status",
		description: "Retrieve the status and details of a processing job",
	},
	async (c) => {
		try {
			const { jobId } = c.req.valid("param");

			const job = await jobsService.getProcessingJob(jobId);

			if (!job) {
				return c.json(
					{
						success: false,
						error: "JOB_NOT_FOUND",
						message: "Job not found",
					},
					404,
				);
			}

			return c.json(job);
		} catch (error) {
			logger.error(
				"Error getting job status",
				error instanceof Error ? error : new Error(String(error)),
			);

			return c.json(
				{
					success: false,
					error: "JOB_NOT_FOUND",
					message: "Job not found",
				},
				404,
			);
		}
	},
);

// List jobs endpoint
processingRoute.openapi(
	{
		method: "get",
		path: "/jobs",
		request: {
			query: ListJobsQuerySchema,
		},
		responses: {
			200: {
				content: {
					"application/json": {
						schema: ListJobsResponseSchema,
					},
				},
				description: "Jobs retrieved successfully",
			},
			500: {
				content: {
					"application/json": {
						schema: ErrorResponseSchema,
					},
				},
				description: "Internal server error",
			},
		},
		tags: ["Job Management"],
		summary: "List jobs",
		description: "Retrieve a list of processing jobs with optional filtering",
	},
	async (c) => {
		try {
			const query = c.req.valid("query");

			// Get jobs by status if provided, otherwise get all jobs
			const jobs = query.status
				? await jobsService.getJobsByStatus(query.status, query.limit || 10)
				: await jobsService.getAllJobs(query.limit || 10, query.offset || 0);
			const total = jobs.length;

			return c.json({
				success: true,
				jobs,
				total,
				limit: query.limit || 10,
				offset: query.offset || 0,
			});
		} catch (error) {
			logger.error(
				"Error listing jobs",
				error instanceof Error ? error : new Error(String(error)),
			);

			return c.json(
				{
					success: false,
					error: "LIST_ERROR",
					message:
						error instanceof Error ? error.message : "Unknown error occurred",
				},
				500,
			);
		}
	},
);

export default processingRoute;
