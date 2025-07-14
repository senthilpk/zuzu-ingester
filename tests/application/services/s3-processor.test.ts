import { describe, it, expect, beforeAll } from "vitest";
import { S3Client } from "bun";
import { S3Processor } from "../../../src/infrastructure/s3/s3-processor";
import {
	FileConfig,
	Platform,
	StorageProvider,
} from "../../../src/application/interfaces/file-processor.interface";
import { logger } from "../../../src/utils/logger";
import * as fs from "fs";

// S3 Configuration from environment variables
const S3_BUCKET = process.env.S3_BUCKET || "test-bucket";
const S3_REGION = process.env.S3_REGION || "us-east-1";
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY || "minioadmin";
const S3_SECRET_KEY = process.env.S3_SECRET_KEY || "minioadmin";

const TEST_FILE_KEY = "agoda/agoda_com_2025-04-10.jl";

describe("S3Processor Integration Tests", () => {
	let s3Client: S3Client;
	let processor: S3Processor;

	beforeAll(async () => {
		// Initialize Bun S3 client
		s3Client = new S3Client({
			region: S3_REGION,
			accessKeyId: S3_ACCESS_KEY,
			secretAccessKey: S3_SECRET_KEY,
		});

		processor = new S3Processor(s3Client);
	});

	it("should process a valid S3 file", async () => {
		const config: FileConfig = {
			platform: Platform.AGODA,
			filepath: `${TEST_FILE_KEY}`,
			storageProvider: StorageProvider.S3,
		};
		logger.debug("Processing S3 file", { config });

		const result = await processor.processFile(config);

		expect(result.success).toBe(true);
		expect(result.totalRecords).toBe(56);
		expect(result.validRecords).toBe(56);
		expect(result.invalidRecords).toBe(0);
		expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
	});

	it("should check if file is valid", async () => {
		const config: FileConfig = {
			platform: Platform.AGODA,
			filepath: `${TEST_FILE_KEY}`,
			storageProvider: StorageProvider.S3,
		};

		const isValid = await processor.isFileValid(config);
		expect(isValid).toBe(true);
	});

	it("should check if file is processed", async () => {
		const config: FileConfig = {
			platform: Platform.AGODA,
			filepath: `${TEST_FILE_KEY}`,
			storageProvider: StorageProvider.S3,
		};

		const isProcessed = await processor.isFileProcessed(config);
		expect(typeof isProcessed).toBe("boolean");
	});

	it("should handle non-existent S3 file", async () => {
		const config: FileConfig = {
			platform: Platform.AGODA,
			filepath: `nonexistent-file.jl`,
			storageProvider: StorageProvider.S3,
		};

		const result = await processor.processFile(config);

		expect(result.success).toBe(false);
		expect(result.totalRecords).toBe(0);
		expect(result.validRecords).toBe(0);
		expect(result.invalidRecords).toBe(0);
		expect(result.errors.length).toBeGreaterThan(0);
	});
});
