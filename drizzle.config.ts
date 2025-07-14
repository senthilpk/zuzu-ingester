import { defineConfig } from "drizzle-kit";

export default defineConfig({
	schema: "./src/infrastructure/database/schema.ts",
	out: "./src/infrastructure/database/migrations",
	dialect: "postgresql",
	dbCredentials: {
		url:
			process.env.DATABASE_URL ||
			"postgresql://postgres:password@localhost:5433/zuzu_ingester",
	},
	verbose: true,
	strict: true,
});
