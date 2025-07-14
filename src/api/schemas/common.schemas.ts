import { z } from "zod";

// Common error response schema
export const ErrorResponseSchema = z.object({
	success: z.boolean(),
	error: z.string(),
	message: z.string(),
});

// Common success response schema
export const SuccessResponseSchema = z.object({
	success: z.boolean(),
	message: z.string(),
});

// Pagination schemas
export const PaginationQuerySchema = z.object({
	limit: z
		.string()
		.transform(Number)
		.optional()
		.describe("Number of items to return"),
	offset: z
		.string()
		.transform(Number)
		.optional()
		.describe("Number of items to skip"),
	page: z
		.string()
		.transform(Number)
		.optional()
		.describe("Page number (alternative to offset)"),
});

export const PaginationResponseSchema = z.object({
	total: z.number(),
	limit: z.number(),
	offset: z.number(),
	page: z.number().optional(),
	totalPages: z.number().optional(),
});

// Health check schemas
export const HealthResponseSchema = z.object({
	status: z.enum(["healthy", "unhealthy"]),
	timestamp: z.string(),
	version: z.string().optional(),
	uptime: z.number().optional(),
});

// Generic ID parameter schema
export const IdParamSchema = z.object({
	id: z.string().describe("Resource ID"),
});

// Generic list response schema
export const ListResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
	z.object({
		success: z.boolean(),
		items: z.array(itemSchema),
		...PaginationResponseSchema.shape,
	});

// Type exports
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
export type SuccessResponse = z.infer<typeof SuccessResponseSchema>;
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;
export type PaginationResponse = z.infer<typeof PaginationResponseSchema>;
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
export type IdParam = z.infer<typeof IdParamSchema>;
