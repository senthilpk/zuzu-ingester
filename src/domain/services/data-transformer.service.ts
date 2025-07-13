import { logger } from "../../utils/logger";

export interface RawHotelReview {
	hotelId: number;
	platform: string;
	hotelName: string | null;
	comment: {
		hotelReviewId: number;
		providerId: number;
		rating: number;
		ratingText: string;
		reviewTitle: string;
		reviewComments: string;
		reviewDate: string;
		checkInDateMonthAndYear: string;
		isShowReviewResponse: boolean;
		responderName: string;
		responseDateText: string;
		translateSource: string;
		translateTarget: string;
		encryptedReviewData: string;
		reviewProviderText: string;
		reviewPositives?: string;
		reviewNegatives?: string;
		reviewerInfo?: {
			countryName: string;
			displayMemberName: string;
			flagName: string;
			reviewGroupName: string;
			roomTypeName: string;
			countryId: number;
			lengthOfStay: number;
			reviewGroupId: number;
			roomTypeId: number;
			reviewerReviewedCount: number;
			isExpertReviewer: boolean;
			isShowGlobalIcon: boolean;
			isShowReviewedCount: boolean;
		};
	};
	overallByProviders?: Array<{
		providerId: number;
		provider: string;
		overallScore: number;
		reviewCount: number;
		grades: Record<string, number>;
	}>;
}

export interface TransformedHotelReview {
	hotelId: number;
	platform: string;
	hotelName: string | null;
	hotelReviewId: number;
	providerId: number;
	rating: number;
	ratingText: string;
	reviewTitle: string;
	reviewComments: string;
	reviewDate: string;
	checkInDateMonthAndYear: string;
	isShowReviewResponse: boolean;
	responderName: string;
	responseDateText: string;
	translateSource: string;
	translateTarget: string;
	encryptedReviewData: string;
	reviewProviderText: string;
	reviewPositives?: string;
	reviewNegatives?: string;
	reviewerInfo?: {
		countryName: string;
		displayMemberName: string;
		flagName: string;
		reviewGroupName: string;
		roomTypeName: string;
		countryId: number;
		lengthOfStay: number;
		reviewGroupId: number;
		roomTypeId: number;
		reviewerReviewedCount: number;
		isExpertReviewer: boolean;
		isShowGlobalIcon: boolean;
		isShowReviewedCount: boolean;
	};
	overallByProviders?: Array<{
		providerId: number;
		provider: string;
		overallScore: number;
		reviewCount: number;
		grades: Record<string, number>;
	}>;
}

export class DataTransformerService {
	/**
	 * Transform raw hotel review data to flattened structure
	 */
	static transformHotelReview(rawData: RawHotelReview): TransformedHotelReview {
		try {
			const transformed: TransformedHotelReview = {
				// Top-level fields
				hotelId: rawData.hotelId,
				platform: rawData.platform,
				hotelName: rawData.hotelName,

				// Flatten comment fields
				hotelReviewId: rawData.comment.hotelReviewId,
				providerId: rawData.comment.providerId,
				rating: rawData.comment.rating,
				ratingText: rawData.comment.ratingText,
				reviewTitle: rawData.comment.reviewTitle,
				reviewComments: rawData.comment.reviewComments,
				reviewDate: rawData.comment.reviewDate,
				checkInDateMonthAndYear: rawData.comment.checkInDateMonthAndYear,
				isShowReviewResponse: rawData.comment.isShowReviewResponse,
				responderName: rawData.comment.responderName,
				responseDateText: rawData.comment.responseDateText,
				translateSource: rawData.comment.translateSource,
				translateTarget: rawData.comment.translateTarget,
				encryptedReviewData: rawData.comment.encryptedReviewData,
				reviewProviderText: rawData.comment.reviewProviderText,
				reviewPositives: rawData.comment.reviewPositives,
				reviewNegatives: rawData.comment.reviewNegatives,
				reviewerInfo: rawData.comment.reviewerInfo,

				// Keep other fields as-is
				overallByProviders: rawData.overallByProviders,
			};

			return transformed;
		} catch (error) {
			logger.error("Failed to transform hotel review data", error as Error, {
				rawData,
			});
			throw new Error(
				`Data transformation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * Transform a batch of raw hotel review data
	 */
	static transformHotelReviews(
		rawDataList: RawHotelReview[],
	): TransformedHotelReview[] {
		return rawDataList.map((rawData) => this.transformHotelReview(rawData));
	}

	/**
	 * Check if data is in raw format (has nested comment structure)
	 */
	static isRawFormat(data: any): data is RawHotelReview {
		return (
			data &&
			typeof data === "object" &&
			"comment" in data &&
			typeof data.comment === "object" &&
			"rating" in data.comment
		);
	}

	/**
	 * Transform data if it's in raw format, otherwise return as-is
	 */
	static transformIfNeeded(data: any): TransformedHotelReview | any {
		if (this.isRawFormat(data)) {
			return this.transformHotelReview(data);
		}
		return data;
	}
}
