import { z } from "zod";
import {
	ValidationServiceInterface,
	ValidationResult,
} from "../interfaces/validation-service.interface";

export class ValidationService implements ValidationServiceInterface {
	/**
	 * Validates hotel review data against business rules
	 */
	validate(review: any): ValidationResult {
		const errors: string[] = [];

		// Business validation rules
		if (review.rating < 0 || review.rating > 10) {
			errors.push("Rating must be between 0 and 10");
		}

		if (!review.hotelId) {
			errors.push("Hotel ID is required");
		}

		if (!review.platform || review.platform.trim().length === 0) {
			errors.push("Platform is required");
		}

		return {
			isValid: errors.length === 0,
			errors,
		};
	}
}
