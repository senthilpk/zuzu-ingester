import { db } from "../connection";
import { hotels } from "../schema";
import { logger } from "../../../utils/logger";
import { eq, and, desc, asc, count, gte, lte } from "drizzle-orm";
import { sql } from "drizzle-orm";

export interface Hotel {
	id: number;
	hotelId: number;
	platform: string;
	hotelName: string | null;
	overallScore: string | null; // Decimal is stored as string in DB
	reviewCount: number | null;
	grades: any;
	createdAt: Date | null;
	updatedAt: Date | null;
}

export interface CreateHotelData {
	hotelId: number;
	platform: string;
	hotelName?: string;
	overallScore?: number; // Accept number, convert to string for DB
	reviewCount?: number;
	grades?: any;
}

export interface UpdateHotelData {
	hotelName?: string;
	overallScore?: number; // Accept number, convert to string for DB
	reviewCount?: number;
	grades?: any;
}

export interface HotelFilters {
	platform?: string;
	overallScore?: {
		min?: number;
		max?: number;
	};
	reviewCount?: {
		min?: number;
		max?: number;
	};
}

export class HotelsRepository {
	/**
	 * Find hotel by hotel ID
	 */
	async findByHotelId(hotelId: number): Promise<Hotel | null> {
		try {
			const result = await db
				.select()
				.from(hotels)
				.where(eq(hotels.hotelId, hotelId))
				.limit(1);

			return result[0] || null;
		} catch (error) {
			logger.error(
				"Error finding hotel by hotel ID",
				error instanceof Error ? error : new Error(String(error)),
				{ hotelId },
			);
			return null;
		}
	}

	/**
	 * Find hotels by platform
	 */
	async findByPlatform(platform: string, limit: number = 50): Promise<Hotel[]> {
		try {
			const result = await db
				.select()
				.from(hotels)
				.where(eq(hotels.platform, platform))
				.orderBy(desc(hotels.reviewCount))
				.limit(limit);

			return result;
		} catch (error) {
			logger.error(
				"Error finding hotels by platform",
				error instanceof Error ? error : new Error(String(error)),
				{ platform },
			);
			return [];
		}
	}

	/**
	 * Create or update a hotel (upsert)
	 */
	async upsertHotel(hotelData: CreateHotelData): Promise<Hotel> {
		try {
			const [hotel] = await db
				.insert(hotels)
				.values({
					hotelId: hotelData.hotelId,
					platform: hotelData.platform,
					hotelName: hotelData.hotelName,
					overallScore: hotelData.overallScore?.toString(), // Convert number to string
					reviewCount: hotelData.reviewCount || 0,
					grades: hotelData.grades,
				})
				.onConflictDoUpdate({
					target: hotels.hotelId,
					set: {
						hotelName: hotelData.hotelName,
						overallScore: hotelData.overallScore?.toString(), // Convert number to string
						reviewCount: hotelData.reviewCount,
						grades: hotelData.grades,
						updatedAt: new Date(),
					},
				})
				.returning();

			logger.info("Hotel upserted", {
				hotelId: hotel.hotelId,
				platform: hotel.platform,
			});
			return hotel;
		} catch (error) {
			logger.error(
				"Error upserting hotel",
				error instanceof Error ? error : new Error(String(error)),
				{ hotelData },
			);
			throw error;
		}
	}
}
