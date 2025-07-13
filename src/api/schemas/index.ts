// Common schemas
export * from "./common.schemas";

// Processing schemas
export * from "./processing.schemas";

// Re-export commonly used types from common schemas
export type {
	ErrorResponse,
	SuccessResponse,
	PaginationQuery,
	PaginationResponse,
	HealthResponse,
	IdParam,
} from "./common.schemas";

// Re-export commonly used types from processing schemas
export type {
	ProcessFileRequest,
	ProcessFolderRequest,
	ProcessFileResponse,
	ProcessFolderResponse,
	JobStatusResponse,
	ListJobsResponse,
	ProcessingStats,
	FileProcessingResult,
} from "./processing.schemas";
