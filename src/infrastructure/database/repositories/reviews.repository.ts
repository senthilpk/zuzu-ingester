import { db } from "../connection";
import { reviews, hotels, reviewers } from "../schema";
import { logger } from "../../../utils/logger";
import { eq, and, desc, asc, count, gte, lte, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";

export interface Review {
	id: number;
	hotelReviewId: number;
	hotelId: number;
	reviewerId: number | null;
	platform: string;
	rating: string; // Decimal is stored as string in DB
	ratingText: string | null;
	reviewTitle: string | null;
	reviewComments: string | null;
	reviewPositives: string | null;
	reviewNegatives: string | null;
	reviewDate: Date;
	checkInDateMonthAndYear: string | null;
	isShowReviewResponse: boolean | null;
	responderName: string | null;
	responseDateText: string | null;
	translateSource: string | null;
	translateTarget: string | null;
	encryptedReviewData: string | null;
	providerId: number | null;
	reviewProviderText: string | null;
	processingJobId: string | null;
	createdAt: Date | null;
	updatedAt: Date | null;
}

export interface CreateReviewData {
	hotelReviewId: number;
	hotelId: number;
	reviewerId?: number;
	platform: string;
	rating: number; // Accept number, convert to string for DB
	ratingText?: string;
	reviewTitle?: string;
	reviewComments?: string;
	reviewPositives?: string;
	reviewNegatives?: string;
	reviewDate: Date;
	checkInDateMonthAndYear?: string;
	isShowReviewResponse?: boolean;
	responderName?: string;
	responseDateText?: string;
	translateSource?: string;
	translateTarget?: string;
	encryptedReviewData?: string;
	providerId?: number;
	reviewProviderText?: string;
	processingJobId?: string;
}

export interface ReviewFilters {
	hotelId?: number;
	platform?: string;
	rating?: {
		min?: number;
		max?: number;
	};
	reviewDate?: {
		from?: Date;
		to?: Date;
	};
	hasResponse?: boolean;
	processingJobId?: string;
}

export class ReviewsRepository {
	/**
	 * Find review by hotel review ID
	 */
	async findByHotelReviewId(hotelReviewId: number): Promise<Review | null> {
		try {
			const result = await db
				.select()
				.from(reviews)
				.where(eq(reviews.hotelReviewId, hotelReviewId))
				.limit(1);

			return result[0] || null;
		} catch (error) {
			logger.error(
				"Error finding review by hotel review ID",
				error instanceof Error ? error : new Error(String(error)),
				{ hotelReviewId },
			);
			return null;
		}
	}

	/**
	 * Find reviews by hotel ID
	 */
	async findByHotelId(hotelId: number, limit: number = 50): Promise<Review[]> {
		try {
			const result = await db
				.select()
				.from(reviews)
				.where(eq(reviews.hotelId, hotelId))
				.orderBy(desc(reviews.reviewDate))
				.limit(limit);

			return result;
		} catch (error) {
			logger.error(
				"Error finding reviews by hotel ID",
				error instanceof Error ? error : new Error(String(error)),
				{ hotelId },
			);
			return [];
		}
	}

	/**
	 * Find reviews by platform
	 */
	async findByPlatform(
		platform: string,
		limit: number = 50,
	): Promise<Review[]> {
		try {
			const result = await db
				.select()
				.from(reviews)
				.where(eq(reviews.platform, platform))
				.orderBy(desc(reviews.reviewDate))
				.limit(limit);

			return result;
		} catch (error) {
			logger.error(
				"Error finding reviews by platform",
				error instanceof Error ? error : new Error(String(error)),
				{ platform },
			);
			return [];
		}
	}

	/**
	 * Create a new review
	 */
	async createReview(reviewData: CreateReviewData): Promise<Review> {
		try {
			// Check if review already exists
			const existing = await this.findByHotelReviewId(reviewData.hotelReviewId);
			if (existing) {
				logger.debug("Review already exists, skipping", {
					hotelReviewId: reviewData.hotelReviewId,
				});
				return existing;
			}

			const [review] = await db
				.insert(reviews)
				.values({
					hotelReviewId: reviewData.hotelReviewId,
					hotelId: reviewData.hotelId,
					reviewerId: reviewData.reviewerId,
					platform: reviewData.platform,
					rating: reviewData.rating.toString(), // Convert number to string
					ratingText: reviewData.ratingText,
					reviewTitle: reviewData.reviewTitle,
					reviewComments: reviewData.reviewComments,
					reviewPositives: reviewData.reviewPositives,
					reviewNegatives: reviewData.reviewNegatives,
					reviewDate: reviewData.reviewDate,
					checkInDateMonthAndYear: reviewData.checkInDateMonthAndYear,
					isShowReviewResponse: reviewData.isShowReviewResponse || false,
					responderName: reviewData.responderName,
					responseDateText: reviewData.responseDateText,
					translateSource: reviewData.translateSource,
					translateTarget: reviewData.translateTarget,
					encryptedReviewData: reviewData.encryptedReviewData,
					providerId: reviewData.providerId,
					reviewProviderText: reviewData.reviewProviderText,
					processingJobId: reviewData.processingJobId,
				})
				.returning();

			logger.info("Review created", {
				hotelReviewId: review.hotelReviewId,
				hotelId: review.hotelId,
			});
			return review;
		} catch (error) {
			logger.error(
				"Error creating review",
				error instanceof Error ? error : new Error(String(error)),
				{ reviewData },
			);
			throw error;
		}
	}
}
