import { db } from "../connection";
import { logger } from "../../../utils/logger";
import { eq, desc, asc, count } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";

export interface PaginationOptions {
	page?: number;
	limit?: number;
	offset?: number;
}

export interface QueryOptions {
	pagination?: PaginationOptions;
	orderBy?: {
		column: string;
		direction: "asc" | "desc";
	};
}

export abstract class BaseRepository {
	protected abstract table: PgTable;

	/**
	 * Find a record by ID
	 */
	async findById(id: number): Promise<any | null> {
		try {
			const result = await db
				.select()
				.from(this.table)
				.where(eq((this.table as any).id, id))
				.limit(1);

			return result[0] || null;
		} catch (error) {
			logger.error(
				"Error finding record by ID",
				error instanceof Error ? error : new Error(String(error)),
				{ id },
			);
			return null;
		}
	}

	/**
	 * Find all records with optional pagination
	 */
	async findAll(options?: QueryOptions): Promise<any[]> {
		try {
			let query = db.select().from(this.table);

			// Apply ordering first
			if (options?.orderBy) {
				const { column, direction } = options.orderBy;
				const orderColumn = (this.table as any)[column];
				if (orderColumn) {
					query =
						direction === "desc"
							? (query as any).orderBy(desc(orderColumn))
							: (query as any).orderBy(asc(orderColumn));
				}
			}

			// Apply pagination last
			if (options?.pagination) {
				const { page = 1, limit = 10, offset } = options.pagination;
				const actualOffset = offset ?? (page - 1) * limit;
				query = (query as any).limit(limit).offset(actualOffset);
			}

			return await query;
		} catch (error) {
			logger.error(
				"Error finding all records",
				error instanceof Error ? error : new Error(String(error)),
			);
			return [];
		}
	}

	/**
	 * Count total records
	 */
	async count(): Promise<number> {
		try {
			const result = await db.select({ count: count() }).from(this.table);
			return result[0]?.count || 0;
		} catch (error) {
			logger.error(
				"Error counting records",
				error instanceof Error ? error : new Error(String(error)),
			);
			return 0;
		}
	}
}
