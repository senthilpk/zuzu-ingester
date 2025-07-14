export interface ValidationResult {
	isValid: boolean;
	errors: string[];
}

export interface ValidationServiceInterface {
	validate(data: any): ValidationResult;
}
