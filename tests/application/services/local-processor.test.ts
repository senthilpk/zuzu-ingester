import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { LocalProcessor } from "../../../src/infrastructure/local/local-processor";
import {
	FileConfig,
	Platform,
	StorageProvider,
} from "../../../src/application/interfaces/file-processor.interface";
import { ValidationService } from "../../../src/domain/services/validation-service";

describe("LocalProcessor Integration Tests", () => {
	let localProcessor: LocalProcessor;
	let validationService: ValidationService;

	beforeEach(() => {
		vi.clearAllMocks();

		// Use real validation service
		validationService = new ValidationService();

		// Create processor instance with real validation service
		localProcessor = new LocalProcessor(validationService, {
			chunkSize: 1024,
			showValidRecords: false,
			showInvalidRecords: false,
			validateRecords: true,
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("constructor", () => {
		it("should create instance with default dependencies", () => {
			const processor = new LocalProcessor();
			expect(processor).toBeInstanceOf(LocalProcessor);
		});

		it("should create instance with custom validation service", () => {
			const customValidationService = new ValidationService();
			const processor = new LocalProcessor(customValidationService);
			expect(processor).toBeInstanceOf(LocalProcessor);
		});
	});

	describe("isFileValid", () => {
		it("should return true for valid file path", () => {
			const config: FileConfig = {
				platform: Platform.AGODA,
				filepath: "./tests/data/valid-hotel-reviews.jl",
				storageProvider: StorageProvider.LOCAL,
			};

			const result = localProcessor.isFileValid(config);
			expect(result).toBe(true);
		});

		it("should return false for invalid file path", () => {
			const config: FileConfig = {
				platform: Platform.AGODA,
				filepath: "./tests/data/nonexistent-file.jl",
				storageProvider: StorageProvider.LOCAL,
			};

			const result = localProcessor.isFileValid(config);
			expect(result).toBe(false);
		});
	});

	describe("isFileProcessed", () => {
		it("should return false (not implemented)", () => {
			const config: FileConfig = {
				platform: Platform.AGODA,
				filepath: "./data/test.jl",
				storageProvider: StorageProvider.LOCAL,
			};

			const result = localProcessor.isFileProcessed(config);
			expect(result).toBe(false);
		});
	});

	describe("processFile", () => {
		it("should return error when file is not valid", async () => {
			const config: FileConfig = {
				platform: Platform.AGODA,
				filepath: "./tests/data/nonexistent-file.jl",
				storageProvider: StorageProvider.LOCAL,
			};

			const result = await localProcessor.processFile(config);

			expect(result.success).toBe(false);
			expect(result.errors).toContain("File is not valid");
			expect(result.totalRecords).toBe(0);
		});

		it("should process valid JSON lines successfully", async () => {
			const config: FileConfig = {
				platform: Platform.AGODA,
				filepath: "./tests/data/valid-hotel-reviews.jl",
				storageProvider: StorageProvider.LOCAL,
			};

			const result = await localProcessor.processFile(config);

			expect(result.success).toBe(true);
			expect(result.totalRecords).toBe(5);
			expect(result.validRecords).toBe(5);
			expect(result.invalidRecords).toBe(0);
			expect(result.processingTimeMs).toBeGreaterThan(0);
			expect(result.errors).toHaveLength(0);
		});

		it("should handle invalid JSON lines", async () => {
			const config: FileConfig = {
				platform: Platform.AGODA,
				filepath: "./tests/data/invalid-hotel-reviews.jl",
				storageProvider: StorageProvider.LOCAL,
			};

			const result = await localProcessor.processFile(config);

			expect(result.success).toBe(true);
			expect(result.totalRecords).toBe(6); // 6 total lines
			expect(result.validRecords).toBe(3); // 3 valid records (lines 1, 4, 6)
			expect(result.invalidRecords).toBe(3); // 3 invalid records (1 malformed JSON, 1 empty platform, 1 invalid rating)
		});

		it("should handle empty file", async () => {
			const config: FileConfig = {
				platform: Platform.AGODA,
				filepath: "./tests/data/empty-file.jl",
				storageProvider: StorageProvider.LOCAL,
			};

			const result = await localProcessor.processFile(config);

			expect(result.success).toBe(true);
			expect(result.totalRecords).toBe(0);
			expect(result.validRecords).toBe(0);
			expect(result.invalidRecords).toBe(0);
			// Processing time might be 0 for very fast operations
			expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
		});

		it("should process with validation disabled", async () => {
			const processorWithoutValidation = new LocalProcessor(validationService, {
				chunkSize: 1024,
				showValidRecords: false,
				showInvalidRecords: false,
				validateRecords: false,
			});

			const config: FileConfig = {
				platform: Platform.AGODA,
				filepath: "./tests/data/valid-hotel-reviews.jl",
				storageProvider: StorageProvider.LOCAL,
			};

			const result = await processorWithoutValidation.processFile(config);

			expect(result.success).toBe(true);
			expect(result.totalRecords).toBe(5);
			expect(result.validRecords).toBe(5);
			expect(result.invalidRecords).toBe(0);
			// Processing time might be 0 for very fast operations
			expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
		});

		it("should show valid records when configured", async () => {
			const processorWithDisplay = new LocalProcessor(validationService, {
				chunkSize: 1024,
				showValidRecords: true,
				showInvalidRecords: false,
				validateRecords: true,
			});

			const config: FileConfig = {
				platform: Platform.AGODA,
				filepath: "./tests/data/valid-hotel-reviews.jl",
				storageProvider: StorageProvider.LOCAL,
			};

			// Mock console.log to capture output
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

			const result = await processorWithDisplay.processFile(config);

			expect(result.success).toBe(true);
			expect(result.totalRecords).toBe(5);
			expect(result.validRecords).toBe(5);
			expect(result.invalidRecords).toBe(0);
			// Check that console.log was called for valid records
			expect(consoleSpy).toHaveBeenCalled();

			consoleSpy.mockRestore();
		});

		it("should show invalid records when configured", async () => {
			const processorWithDisplay = new LocalProcessor(validationService, {
				chunkSize: 1024,
				showValidRecords: false,
				showInvalidRecords: true,
				validateRecords: true,
			});

			const config: FileConfig = {
				platform: Platform.AGODA,
				filepath: "./tests/data/invalid-hotel-reviews.jl",
				storageProvider: StorageProvider.LOCAL,
			};

			// Mock console.log to capture output
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

			const result = await processorWithDisplay.processFile(config);

			expect(result.success).toBe(true);
			expect(result.totalRecords).toBe(6);
			expect(result.validRecords).toBe(3);
			expect(result.invalidRecords).toBe(3);
			// Check that console.log was called for invalid records
			expect(consoleSpy).toHaveBeenCalled();

			consoleSpy.mockRestore();
		});

		it("should handle file processing errors", async () => {
			const config: FileConfig = {
				platform: Platform.AGODA,
				filepath: "./tests/data/nonexistent-file.jl",
				storageProvider: StorageProvider.LOCAL,
			};

			const result = await localProcessor.processFile(config);

			expect(result.success).toBe(false);
			expect(result.totalRecords).toBe(0);
			expect(result.validRecords).toBe(0);
			expect(result.invalidRecords).toBe(0);
			expect(result.errors[0]).toContain("File is not valid");
		});
	});
});
