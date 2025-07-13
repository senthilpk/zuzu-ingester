import { z } from "zod";
import {
	Platform,
	StorageProvider,
} from "../../application/interfaces/file-processor.interface";
import { FileProcessingStatus } from "../../application/services/file-process/file-processing-orchestrator.service";

// Request schemas
export const ProcessFileRequestSchema = z.object({
	filepath: z.string().describe("Path to the file to process"),
	platform: z.nativeEnum(Platform).describe("Platform the data is from"),
	storageProvider: z
		.nativeEnum(StorageProvider)
		.describe("Storage provider for the file"),
	options: z
		.object({
			chunkSize: z
				.number()
				.optional()
				.describe("Size of chunks to process (default: 128KB)"),
			showValidRecords: z
				.boolean()
				.optional()
				.describe("Show valid records in response"),
			showInvalidRecords: z
				.boolean()
				.optional()
				.describe("Show invalid records in response"),
			validateRecords: z
				.boolean()
				.optional()
				.describe("Validate records during processing"),
			storeToDatabase: z
				.boolean()
				.optional()
				.describe("Store processed records to database"),
			dbBatchSize: z
				.number()
				.optional()
				.describe("Database batch size for inserts"),
		})
		.optional(),
});

export const ProcessFolderRequestSchema = z.object({
	folderPath: z
		.string()
		.describe("Path to the folder containing files to process"),
	platform: z.nativeEnum(Platform).describe("Platform the data is from"),
	storageProvider: z
		.nativeEnum(StorageProvider)
		.describe("Storage provider for the files"),
	filePattern: z
		.string()
		.optional()
		.describe("File pattern to match (e.g., '*.jl')"),
	options: z
		.object({
			chunkSize: z
				.number()
				.optional()
				.describe("Size of chunks to process (default: 128KB)"),
			showValidRecords: z
				.boolean()
				.optional()
				.describe("Show valid records in response"),
			showInvalidRecords: z
				.boolean()
				.optional()
				.describe("Show invalid records in response"),
			validateRecords: z
				.boolean()
				.optional()
				.describe("Validate records during processing"),
			storeToDatabase: z
				.boolean()
				.optional()
				.describe("Store processed records to database"),
			dbBatchSize: z
				.number()
				.optional()
				.describe("Database batch size for inserts"),
		})
		.optional(),
});

// Response schemas
export const ProcessingStatsSchema = z.object({
	totalRecords: z.number(),
	validRecords: z.number(),
	invalidRecords: z.number(),
	processingTimeMs: z.number(),
	hotelsInserted: z.number(),
	reviewsInserted: z.number(),
});

export const FileProcessingResultSchema = z.object({
	jobId: z.string(),
	status: z.nativeEnum(FileProcessingStatus),
	stats: ProcessingStatsSchema.optional(),
	error: z.string().optional(),
});

export const ProcessFileResponseSchema = z.object({
	success: z.boolean(),
	result: FileProcessingResultSchema,
	message: z.string(),
});

export const ProcessFolderResponseSchema = z.object({
	success: z.boolean(),
	results: z.array(FileProcessingResultSchema),
	totalFiles: z.number(),
	successfulFiles: z.number(),
	failedFiles: z.number(),
	message: z.string(),
});

export const JobStatusResponseSchema = z.object({
	id: z.number().optional(),
	jobId: z.string(),
	status: z.string(),
	filepath: z.string(),
	platform: z.string(),
	storageProvider: z.string(),
	createdAt: z.string().nullable(),
	updatedAt: z.string().nullable(),
	startedAt: z.string().nullable(),
	completedAt: z.string().nullable(),
	totalRecords: z.number().nullable(),
	validRecords: z.number().nullable(),
	invalidRecords: z.number().nullable(),
	processingTimeMs: z.number().nullable(),
	errors: z.array(z.string()).nullable(),
	metadata: z.any().nullable(),
});

export const ListJobsResponseSchema = z.object({
	success: z.boolean(),
	jobs: z.array(JobStatusResponseSchema),
	total: z.number(),
	limit: z.number(),
	offset: z.number(),
});

// Error response schema - imported from common schemas
import { ErrorResponseSchema } from "./common.schemas";

// Query parameter schemas
export const JobStatusQuerySchema = z.object({
	jobId: z.string().describe("Job ID to get status for"),
});

export const ListJobsQuerySchema = z.object({
	status: z.string().optional().describe("Filter by job status"),
	platform: z.string().optional().describe("Filter by platform"),
	limit: z
		.string()
		.transform(Number)
		.optional()
		.describe("Number of jobs to return"),
	offset: z
		.string()
		.transform(Number)
		.optional()
		.describe("Number of jobs to skip"),
});

// Type exports for use in other files
export type ProcessFileRequest = z.infer<typeof ProcessFileRequestSchema>;
export type ProcessFolderRequest = z.infer<typeof ProcessFolderRequestSchema>;
export type ProcessFileResponse = z.infer<typeof ProcessFileResponseSchema>;
export type ProcessFolderResponse = z.infer<typeof ProcessFolderResponseSchema>;
export type JobStatusResponse = z.infer<typeof JobStatusResponseSchema>;
export type ListJobsResponse = z.infer<typeof ListJobsResponseSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
export type ProcessingStats = z.infer<typeof ProcessingStatsSchema>;
export type FileProcessingResult = z.infer<typeof FileProcessingResultSchema>;
