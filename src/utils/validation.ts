import { z } from "zod";

export class ValidationError extends Error {
	constructor(
		message: string,
		public errors: z.ZodError,
	) {
		super(message);
		this.name = "ValidationError";
	}
}

export class ValidationService {
	/**
	 * Validates data against a Zod schema
	 */
	static validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
		try {
			return schema.parse(data);
		} catch (error) {
			if (error instanceof z.ZodError) {
				throw new ValidationError("Validation failed", error);
			}
			throw error;
		}
	}
}
