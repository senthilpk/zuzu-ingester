#!/usr/bin/env bun

/**
 * Debug script to test streaming processing step by step
 */

import { FileProcessingService } from "../application/services/file-process/file-processing.service";
import { BulkProcessorService } from "../application/services/file-process/bulk-processor.service";
import {
	Platform,
	StorageProvider,
} from "../application/interfaces/file-processor.interface";
import { logger } from "../utils/logger";

logger.info("🐛 Debugging Streaming Processing");
logger.info("=".repeat(50));

async function debugStreaming() {
	logger.info("1. Initializing services...");

	// Initialize services
	const bulkProcessor = new BulkProcessorService();
	const fileProcessingService = new FileProcessingService(bulkProcessor);

	logger.info("Services initialized");

	// Test file path
	const testFile = "data/agoda_com_2025-04-10.jl";
	logger.info(`2. Test file: ${testFile}`);

	// Test 1: Simple processing without database
	logger.info("\n3. Testing simple processing (no database)...");

	try {
		const simpleResult = await fileProcessingService.processFile({
			filepath: testFile,
			platform: Platform.AGODA,
			storageProvider: StorageProvider.LOCAL,
			options: {
				storeToDatabase: false, // No database
			},
		});

		logger.info("Simple processing completed:", {
			totalRecords: simpleResult.totalRecords,
			validRecords: simpleResult.validRecords,
			processingTimeMs: simpleResult.processingTimeMs,
		});
	} catch (error) {
		logger.error("Simple processing failed:", error);
		return;
	}

	// Test 2: With database (streaming)
	logger.info("\n4. Testing streaming with database...");

	try {
		logger.info("   Starting streaming processing...");

		const streamingResult = await fileProcessingService.processFile({
			filepath: testFile,
			platform: Platform.AGODA,
			storageProvider: StorageProvider.LOCAL,
			options: {
				storeToDatabase: true, // This should trigger streaming
				dbBatchSize: 10, // Very small batch for testing
			},
		});

		logger.info("Streaming processing completed:", {
			totalRecords: streamingResult.totalRecords,
			validRecords: streamingResult.validRecords,
			processingTimeMs: streamingResult.processingTimeMs,
			hotelsInserted: streamingResult.databaseStats?.hotelsInserted || 0,
			reviewsInserted: streamingResult.databaseStats?.reviewsInserted || 0,
		});
	} catch (error) {
		logger.error("Streaming processing failed:", error);
	}
}

// Run with timeout
const timeout = setTimeout(() => {
	logger.error("Test timed out after 30 seconds");
	process.exit(1);
}, 30000);

debugStreaming()
	.then(() => {
		clearTimeout(timeout);
		logger.info("\n Debug completed!");
		process.exit(0);
	})
	.catch((error) => {
		clearTimeout(timeout);
		logger.error("\n Debug failed:", error);
		process.exit(1);
	});
