import {
	HotelsRepository,
	CreateHotelData,
} from "../../../infrastructure/database/repositories/hotels.repository";
import { logger } from "../../../utils/logger";

export class HotelsService {
	private hotelsRepository: HotelsRepository;

	constructor() {
		this.hotelsRepository = new HotelsRepository();
	}

	/**
	 * Get hotel by hotel ID
	 */
	async getHotelById(hotelId: number) {
		try {
			return await this.hotelsRepository.findByHotelId(hotelId);
		} catch (error) {
			logger.error(
				"Error getting hotel by ID",
				error instanceof Error ? error : new Error(String(error)),
				{ hotelId },
			);
			throw error;
		}
	}

	/**
	 * Get hotels by platform
	 */
	async getHotelsByPlatform(platform: string, limit: number = 50) {
		try {
			return await this.hotelsRepository.findByPlatform(platform, limit);
		} catch (error) {
			logger.error(
				"Error getting hotels by platform",
				error instanceof Error ? error : new Error(String(error)),
				{ platform },
			);
			throw error;
		}
	}

	/**
	 * Create or update hotel
	 */
	async upsertHotel(hotelData: CreateHotelData) {
		try {
			return await this.hotelsRepository.upsertHotel(hotelData);
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
