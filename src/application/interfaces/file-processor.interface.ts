export enum Platform {
	AGODA = "agoda",
	BOOKING = "booking",
	EXPEDIA = "expedia",
	HOTELS = "hotels",
	TRIPADVISOR = "tripadvisor",
}

export enum StorageProvider {
	LOCAL = "local",
	S3 = "s3",
}

export interface FileConfig {
	platform: Platform;
	filepath: string;
	storageProvider: StorageProvider;
}

export interface ProcessingMetadata {
	filepath: string;
	platform: Platform;
	storageProvider: StorageProvider;
	processingJobId?: string; // Job ID for database insertion
	options?: {
		chunkSize?: number;
		showValidRecords?: boolean;
		showInvalidRecords?: boolean;
		validateRecords?: boolean;
		// Database storage options
		storeToDatabase?: boolean;
		dbBatchSize?: number;
	};
}

export interface FileProcessorResult {
	success: boolean;
	totalRecords: number;
	validRecords: number;
	invalidRecords: number;
	processingTimeMs: number;
	errors: string[];
	records?: any[]; // Valid records for database storage
}

export interface FileProcessor {
	processFile(config: FileConfig): Promise<FileProcessorResult>;
	isFileValid(config: FileConfig): boolean | Promise<boolean>;
	isFileProcessed(config: FileConfig): boolean | Promise<boolean>;
}
