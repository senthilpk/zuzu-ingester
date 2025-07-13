import { FileProcessingService } from "../application/services/file-process/file-processing.service";
import {
	Platform,
	StorageProvider,
	ProcessingMetadata,
} from "../application/interfaces/file-processor.interface";
import { logger } from "../utils/logger";

// Create the service (no constructor needed)
const processingService = new FileProcessingService();

// Example: Process a local file
async function processLocalFile() {
	const metadata: ProcessingMetadata = {
		filepath: "./data/agoda_com_2025-04-10.jl",
		platform: Platform.AGODA,
		storageProvider: StorageProvider.LOCAL,
		options: {
			chunkSize: 64 * 1024,
			showValidRecords: false,
			showInvalidRecords: true,
			validateRecords: true,
		},
	};

	try {
		const result = await processingService.processFile(metadata);

		if (result.success) {
			logger.info("File processed successfully", {
				totalRecords: result.totalRecords,
				validRecords: result.validRecords,
				invalidRecords: result.invalidRecords,
				processingTimeMs: result.processingTimeMs,
			});
		} else {
			logger.error("File processing failed", undefined, {
				errors: result.errors,
			});
		}
	} catch (error) {
		logger.error(
			"Unexpected error",
			error instanceof Error ? error : new Error(String(error)),
		);
	}
}

// Example: Process an S3 file
async function processS3File() {
	const metadata: ProcessingMetadata = {
		filepath: "agoda/agoda_com_2025-04-10.jl",
		platform: Platform.AGODA,
		storageProvider: StorageProvider.S3,
		options: {
			chunkSize: 128 * 1024,
			showValidRecords: false,
			showInvalidRecords: false,
			validateRecords: true,
		},
	};

	try {
		const result = await processingService.processFile(metadata);

		if (result.success) {
			logger.info("S3 file processed successfully", {
				totalRecords: result.totalRecords,
				validRecords: result.validRecords,
				invalidRecords: result.invalidRecords,
				processingTimeMs: result.processingTimeMs,
			});
		} else {
			logger.error("S3 file processing failed", undefined, {
				errors: result.errors,
			});
		}
	} catch (error) {
		logger.error(
			"Unexpected error",
			error instanceof Error ? error : new Error(String(error)),
		);
	}
}

// Example: CLI usage
async function processFromCLI() {
	// Parse CLI arguments (simplified)
	const args = process.argv.slice(2);
	const filepath = args[0];
	const storageType = args[1] || "local"; // 'local' or 's3'
	const platform = args[2] || "agoda"; // 'agoda' or 'booking'

	const metadata: ProcessingMetadata = {
		filepath,
		platform: platform as Platform,
		storageProvider: storageType as StorageProvider,
		options: {
			chunkSize: 64 * 1024,
			showValidRecords: false,
			showInvalidRecords: true,
			validateRecords: true,
		},
	};

	try {
		const result = await processingService.processFile(metadata);

		if (result.success) {
			logger.info("File processed successfully", {
				totalRecords: result.totalRecords,
				validRecords: result.validRecords,
				invalidRecords: result.invalidRecords,
				processingTimeMs: result.processingTimeMs,
			});
		} else {
			logger.error("File processing failed", undefined, {
				errors: result.errors,
			});
		}
	} catch (error) {
		logger.error(
			"Unexpected error",
			error instanceof Error ? error : new Error(String(error)),
		);
	}
}

export { processLocalFile, processS3File, processFromCLI };
