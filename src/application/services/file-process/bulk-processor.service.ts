import { db } from "../../../infrastructure/database/connection";
import { hotels, reviews } from "../../../infrastructure/database/schema";
import { logger } from "../../../utils/logger";
import { sql } from "drizzle-orm";

export interface ProcessingStats {
	totalRecords: number;
	validRecords: number;
	invalidRecords: number;
	processingTimeMs: number;
	hotelsInserted: number;
	reviewsInserted: number;
}

export interface BulkProcessorOptions {
	batchSize?: number;
	onProgress?: (stats: Partial<ProcessingStats>) => void;
}

export class BulkProcessorService {
	private readonly DEFAULT_BATCH_SIZE = 100;

	/**
	 * Process records in batches for optimal performance
	 */
	async processRecords(
		records: any[],
		processingJobId: string,
		options: BulkProcessorOptions = {},
	): Promise<ProcessingStats> {
		const startTime = Date.now();
		const batchSize = options.batchSize || this.DEFAULT_BATCH_SIZE;

		let totalRecords = records.length;
		let validRecords = 0;
		let invalidRecords = 0;
		let hotelsInserted = 0;
		let reviewsInserted = 0;

		// Process records in batches
		for (let i = 0; i < records.length; i += batchSize) {
			const batch = records.slice(i, i + batchSize);

			try {
				const batchResult = await this.processBatch(batch, processingJobId);

				validRecords += batchResult.validRecords;
				invalidRecords += batchResult.invalidRecords;
				hotelsInserted += batchResult.hotelsInserted;
				reviewsInserted += batchResult.reviewsInserted;

				// Report progress
				if (options.onProgress) {
					options.onProgress({
						totalRecords,
						validRecords,
						invalidRecords,
						processingTimeMs: Date.now() - startTime,
						hotelsInserted,
						reviewsInserted,
					});
				}

				logger.debug(
					`Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(records.length / batchSize)}`,
					{
						batchSize: batch.length,
						validRecords: batchResult.validRecords,
						invalidRecords: batchResult.invalidRecords,
					},
				);
			} catch (error) {
				logger.error(
					"Error processing batch",
					error instanceof Error ? error : new Error(String(error)),
					{
						batchIndex: Math.floor(i / batchSize),
						batchSize: batch.length,
					},
				);

				// Continue with next batch instead of failing completely
				invalidRecords += batch.length;
			}
		}

		const processingTimeMs = Date.now() - startTime;

		logger.info("Bulk processing completed", {
			totalRecords,
			validRecords,
			invalidRecords,
			processingTimeMs,
			hotelsInserted,
			reviewsInserted,
		});

		return {
			totalRecords,
			validRecords,
			invalidRecords,
			processingTimeMs,
			hotelsInserted,
			reviewsInserted,
		};
	}

	/**
	 * Process a single batch of records
	 */
	private async processBatch(records: any[], processingJobId: string) {
		const hotelBatch = [];
		const reviewBatch = [];
		let validRecords = 0;
		let invalidRecords = 0;

		// Prepare batch data
		for (const record of records) {
			try {
				if (this.isValidRecord(record)) {
					// Prepare hotel data (flattened structure)
					if (record.hotelId && record.hotelName) {
						hotelBatch.push({
							hotelId: record.hotelId,
							platform: record.platform,
							hotelName: record.hotelName,
							overallScore:
								record.overallByProviders?.[0]?.overallScore !== undefined &&
								record.overallByProviders[0].overallScore !== null
									? String(record.overallByProviders[0].overallScore)
									: null,
							reviewCount:
								record.overallByProviders?.[0]?.reviewCount !== undefined
									? Number(record.overallByProviders[0].reviewCount)
									: 0,
							grades: record.overallByProviders?.[0]?.grades || {},
						});
					}

					// Prepare review data (flattened structure)
					if (record.hotelReviewId && record.rating) {
						reviewBatch.push({
							hotelReviewId: record.hotelReviewId,
							hotelId: record.hotelId,
							platform: record.platform,
							rating:
								typeof record.rating === "string"
									? parseFloat(record.rating)
									: record.rating,
							ratingText: record.ratingText,
							reviewTitle: record.reviewTitle,
							reviewComments: record.reviewComments,
							reviewPositives: record.reviewPositives,
							reviewNegatives: record.reviewNegatives,
							reviewDate: record.reviewDate
								? new Date(record.reviewDate)
								: new Date(0),
							checkInDateMonthAndYear: record.checkInDateMonthAndYear,
							isShowReviewResponse: !!record.isShowReviewResponse,
							responderName: record.responderName,
							responseDateText: record.responseDateText,
							translateSource: record.translateSource,
							translateTarget: record.translateTarget,
							encryptedReviewData: record.encryptedReviewData,
							providerId:
								record.providerId !== undefined && record.providerId !== null
									? Number(record.providerId)
									: null,
							reviewProviderText: record.reviewProviderText,
							processingJobId,
						});
					}

					validRecords++;
				} else {
					invalidRecords++;
				}
			} catch (error) {
				logger.warn("Invalid record, skipping", {
					record,
					error: error instanceof Error ? error.message : String(error),
				});
				invalidRecords++;
			}
		}

		// Bulk insert hotels (upsert)
		let hotelsInserted = 0;
		if (hotelBatch.length > 0) {
			try {
				const result = await db
					.insert(hotels)
					.values(hotelBatch)
					.onConflictDoUpdate({
						target: hotels.hotelId,
						set: {
							hotelName: sql`EXCLUDED.hotel_name`,
							overallScore: sql`EXCLUDED.overall_score`,
							reviewCount: sql`EXCLUDED.review_count`,
							grades: sql`EXCLUDED.grades`,
							updatedAt: new Date(),
						},
					})
					.returning();

				hotelsInserted = result.length;
			} catch (error) {
				logger.error(
					"Error bulk upserting hotels",
					error instanceof Error ? error : new Error(String(error)),
				);
				// Fallback to individual inserts
				hotelsInserted = await this.fallbackHotelInserts(hotelBatch);
			}
		}

		// Bulk insert reviews
		let reviewsInserted = 0;
		if (reviewBatch.length > 0) {
			try {
				const result = await db
					.insert(reviews)
					.values(reviewBatch)
					.onConflictDoNothing() // Skip duplicates
					.returning();

				reviewsInserted = result.length;
			} catch (error) {
				logger.error(
					"Error bulk inserting reviews",
					error instanceof Error ? error : new Error(String(error)),
				);
				// Fallback to individual inserts
				reviewsInserted = await this.fallbackReviewInserts(reviewBatch);
			}
		}

		return {
			validRecords,
			invalidRecords,
			hotelsInserted,
			reviewsInserted,
		};
	}

	/**
	 * Validate record structure (flattened format)
	 */
	private isValidRecord(record: any): boolean {
		return (
			record &&
			record.platform &&
			record.hotelId &&
			record.hotelReviewId &&
			record.rating !== undefined
		);
	}

	/**
	 * Fallback to individual hotel inserts
	 */
	private async fallbackHotelInserts(hotelBatch: any[]): Promise<number> {
		let inserted = 0;
		for (const hotel of hotelBatch) {
			try {
				await db
					.insert(hotels)
					.values(hotel)
					.onConflictDoUpdate({
						target: hotels.hotelId,
						set: {
							hotelName: hotel.hotelName,
							overallScore: hotel.overallScore,
							reviewCount: hotel.reviewCount,
							grades: hotel.grades,
							updatedAt: new Date(),
						},
					});
				inserted++;
			} catch (error) {
				logger.warn("Failed to insert individual hotel", {
					hotel,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}
		return inserted;
	}

	/**
	 * Fallback to individual review inserts
	 */
	private async fallbackReviewInserts(reviewBatch: any[]): Promise<number> {
		let inserted = 0;
		for (const review of reviewBatch) {
			try {
				await db.insert(reviews).values(review).onConflictDoNothing();
				inserted++;
			} catch (error) {
				logger.warn("Failed to insert individual review", {
					review,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}
		return inserted;
	}
}
