import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { logger } from "../../utils/logger";

// Database configuration
const DATABASE_URL =
	process.env.DATABASE_URL || "postgresql://localhost:5433/zuzu_ingester";
const MAX_CONNECTIONS = parseInt(process.env.DB_MAX_CONNECTIONS || "10");
const IDLE_TIMEOUT = parseInt(process.env.DB_IDLE_TIMEOUT || "20");

// Create postgres client
const client = postgres(DATABASE_URL, {
	max: MAX_CONNECTIONS,
	idle_timeout: IDLE_TIMEOUT,
	connect_timeout: 10,
	ssl:
		process.env.NODE_ENV === "production"
			? { rejectUnauthorized: false }
			: false,
});

// Create drizzle instance
export const db = drizzle(client, {
	logger: process.env.NODE_ENV === "development",
});

// Health check function
export async function checkDatabaseConnection(): Promise<boolean> {
	try {
		await client`SELECT 1`;
		logger.info("Database connection successful");
		return true;
	} catch (error) {
		logger.error(
			"Database connection failed",
			error instanceof Error ? error : new Error(String(error)),
		);
		return false;
	}
}

// Graceful shutdown
export async function closeDatabaseConnection(): Promise<void> {
	try {
		await client.end();
		logger.info("Database connection closed");
	} catch (error) {
		logger.error(
			"Error closing database connection",
			error instanceof Error ? error : new Error(String(error)),
		);
	}
}

// Export client for raw queries if needed
export { client };
