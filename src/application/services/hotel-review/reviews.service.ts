import {
	ReviewsRepository,
	CreateReviewData,
} from "../../../infrastructure/database/repositories/reviews.repository";
import { logger } from "../../../utils/logger";

export class ReviewsService {
	private reviewsRepository: ReviewsRepository;

	constructor() {
		this.reviewsRepository = new ReviewsRepository();
	}

	/**
	 * Get review by hotel review ID
	 */
	async getReviewByHotelReviewId(hotelReviewId: number) {
		try {
			return await this.reviewsRepository.findByHotelReviewId(hotelReviewId);
		} catch (error) {
			logger.error(
				"Error getting review by hotel review ID",
				error instanceof Error ? error : new Error(String(error)),
				{ hotelReviewId },
			);
			throw error;
		}
	}

	/**
	 * Get reviews by hotel ID
	 */
	async getReviewsByHotelId(hotelId: number, limit: number = 50) {
		try {
			return await this.reviewsRepository.findByHotelId(hotelId, limit);
		} catch (error) {
			logger.error(
				"Error getting reviews by hotel ID",
				error instanceof Error ? error : new Error(String(error)),
				{ hotelId },
			);
			throw error;
		}
	}

	/**
	 * Get reviews by platform
	 */
	async getReviewsByPlatform(platform: string, limit: number = 50) {
		try {
			return await this.reviewsRepository.findByPlatform(platform, limit);
		} catch (error) {
			logger.error(
				"Error getting reviews by platform",
				error instanceof Error ? error : new Error(String(error)),
				{ platform },
			);
			throw error;
		}
	}

	/**
	 * Create review
	 */
	async createReview(reviewData: CreateReviewData) {
		try {
			return await this.reviewsRepository.createReview(reviewData);
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
