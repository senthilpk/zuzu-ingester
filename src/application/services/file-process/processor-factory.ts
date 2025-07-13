import {
	FileProcessor,
	ProcessingMetadata,
	StorageProvider,
} from "../../interfaces/file-processor.interface";
import { LocalProcessor } from "../../../infrastructure/local/local-processor";
import { S3Processor } from "../../../infrastructure/s3/s3-processor";
import { S3Client } from "bun";

export function getProcessor(meta: ProcessingMetadata): FileProcessor {
	// Default options
	const defaultOptions = {
		chunkSize: 128 * 1024, // 128KB buffer
		showValidRecords: false,
		showInvalidRecords: false,
		validateRecords: true,
		storeToDatabase: meta.options?.storeToDatabase || false,
	};

	// Merge with provided options
	const options = { ...defaultOptions, ...meta.options };

	switch (meta.storageProvider) {
		case StorageProvider.S3:
			// Create S3 client with environment variables
			const s3Client = new S3Client({
				region: process.env.S3_REGION || "us-east-1",
				accessKeyId: process.env.S3_ACCESS_KEY || "",
				secretAccessKey: process.env.S3_SECRET_KEY || "",
				bucket: process.env.S3_BUCKET || "",
			});
			return new S3Processor(s3Client, undefined, options);
		case StorageProvider.LOCAL:
			return new LocalProcessor(undefined, options);
		default:
			throw new Error(`Unsupported storage provider: ${meta.storageProvider}`);
	}
}
