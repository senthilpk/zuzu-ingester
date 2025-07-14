import {
	pgTable,
	serial,
	varchar,
	integer,
	decimal,
	text,
	timestamp,
	boolean,
	jsonb,
	primaryKey,
	index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Processing Jobs table for idempotency
export const processingJobs = pgTable(
	"processing_jobs",
	{
		id: serial("id").primaryKey(),
		jobId: varchar("job_id", { length: 255 }).notNull().unique(), // Unique identifier for idempotency
		filepath: varchar("filepath", { length: 500 }).notNull(),
		platform: varchar("platform", { length: 50 }).notNull(),
		storageProvider: varchar("storage_provider", { length: 50 }).notNull(),
		status: varchar("status", { length: 50 }).notNull().default("pending"), // pending, processing, completed, failed
		totalRecords: integer("total_records").default(0),
		validRecords: integer("valid_records").default(0),
		invalidRecords: integer("invalid_records").default(0),
		processingTimeMs: integer("processing_time_ms").default(0),
		errors: jsonb("errors").default([]),
		metadata: jsonb("metadata"), // Additional processing metadata
		startedAt: timestamp("started_at").defaultNow(),
		completedAt: timestamp("completed_at"),
		createdAt: timestamp("created_at").defaultNow(),
		updatedAt: timestamp("updated_at").defaultNow(),
	},
	(table) => ({
		// Indexes for processing jobs
		jobIdIdx: index("idx_processing_jobs_job_id").on(table.jobId),
		filepathIdx: index("idx_processing_jobs_filepath").on(table.filepath),
		statusIdx: index("idx_processing_jobs_status").on(table.status),
		createdAtIdx: index("idx_processing_jobs_created_at").on(table.createdAt),
		platformIdx: index("idx_processing_jobs_platform").on(table.platform),
	}),
);

// Hotels table
export const hotels = pgTable(
	"hotels",
	{
		id: serial("id").primaryKey(),
		hotelId: integer("hotel_id").notNull().unique(), // Original hotel ID from platform
		platform: varchar("platform", { length: 50 }).notNull(),
		hotelName: varchar("hotel_name", { length: 500 }),
		overallScore: decimal("overall_score", { precision: 3, scale: 1 }),
		reviewCount: integer("review_count").default(0),
		grades: jsonb("grades"), // Store grades as JSON
		createdAt: timestamp("created_at").defaultNow(),
		updatedAt: timestamp("updated_at").defaultNow(),
	},
	(table) => ({
		// Indexes for hotels
		hotelIdIdx: index("idx_hotels_hotel_id").on(table.hotelId),
		platformIdx: index("idx_hotels_platform").on(table.platform),
		overallScoreIdx: index("idx_hotels_overall_score").on(table.overallScore),
		reviewCountIdx: index("idx_hotels_review_count").on(table.reviewCount),
	}),
);

// Reviewers table
export const reviewers = pgTable(
	"reviewers",
	{
		id: serial("id").primaryKey(),
		displayMemberName: varchar("display_member_name", { length: 255 }),
		countryName: varchar("country_name", { length: 100 }),
		countryId: integer("country_id"),
		flagName: varchar("flag_name", { length: 10 }),
		reviewGroupName: varchar("review_group_name", { length: 100 }),
		roomTypeName: varchar("room_type_name", { length: 200 }),
		lengthOfStay: integer("length_of_stay"),
		reviewerReviewedCount: integer("reviewer_reviewed_count").default(0),
		isExpertReviewer: boolean("is_expert_reviewer").default(false),
		createdAt: timestamp("created_at").defaultNow(),
	},
	(table) => ({
		// Indexes for reviewers
		countryIdIdx: index("idx_reviewers_country_id").on(table.countryId),
		reviewGroupNameIdx: index("idx_reviewers_review_group_name").on(
			table.reviewGroupName,
		),
		displayMemberNameIdx: index("idx_reviewers_display_member_name").on(
			table.displayMemberName,
		),
		isExpertReviewerIdx: index("idx_reviewers_is_expert_reviewer").on(
			table.isExpertReviewer,
		),
	}),
);

// Reviews table
export const reviews = pgTable(
	"reviews",
	{
		id: serial("id").primaryKey(),
		hotelReviewId: integer("hotel_review_id").notNull().unique(), // Original review ID from platform
		hotelId: integer("hotel_id").notNull(), // Reference to hotels table
		reviewerId: integer("reviewer_id"), // Reference to reviewers table
		platform: varchar("platform", { length: 50 }).notNull(),

		// Review details
		rating: decimal("rating", { precision: 3, scale: 1 }).notNull(),
		ratingText: varchar("rating_text", { length: 100 }),
		reviewTitle: varchar("review_title", { length: 500 }),
		reviewComments: text("review_comments"),
		reviewPositives: text("review_positives"),
		reviewNegatives: text("review_negatives"),

		// Dates
		reviewDate: timestamp("review_date").notNull(),
		checkInDateMonthAndYear: varchar("check_in_date_month_and_year", {
			length: 50,
		}),

		// Response information
		isShowReviewResponse: boolean("is_show_review_response").default(false),
		responderName: varchar("responder_name", { length: 255 }),
		responseDateText: varchar("response_date_text", { length: 100 }),

		// Translation info
		translateSource: varchar("translate_source", { length: 10 }),
		translateTarget: varchar("translate_target", { length: 10 }),

		// Additional data
		encryptedReviewData: varchar("encrypted_review_data", { length: 255 }),
		providerId: integer("provider_id"),
		reviewProviderText: varchar("review_provider_text", { length: 100 }),

		// Processing metadata
		processingJobId: varchar("processing_job_id", { length: 255 }), // Reference to processing_jobs table

		createdAt: timestamp("created_at").defaultNow(),
		updatedAt: timestamp("updated_at").defaultNow(),
	},
	(table) => ({
		// Indexes for reviews
		hotelReviewIdIdx: index("idx_reviews_hotel_review_id").on(
			table.hotelReviewId,
		),
		hotelIdIdx: index("idx_reviews_hotel_id").on(table.hotelId),
		reviewerIdIdx: index("idx_reviews_reviewer_id").on(table.reviewerId),
		platformIdx: index("idx_reviews_platform").on(table.platform),
		ratingIdx: index("idx_reviews_rating").on(table.rating),
		reviewDateIdx: index("idx_reviews_review_date").on(table.reviewDate),
		processingJobIdIdx: index("idx_reviews_processing_job_id").on(
			table.processingJobId,
		),
		providerIdIdx: index("idx_reviews_provider_id").on(table.providerId),
		isShowReviewResponseIdx: index("idx_reviews_is_show_review_response").on(
			table.isShowReviewResponse,
		),
		// Composite indexes for common query patterns
		hotelPlatformIdx: index("idx_reviews_hotel_platform").on(
			table.hotelId,
			table.platform,
		),
		ratingDateIdx: index("idx_reviews_rating_date").on(
			table.rating,
			table.reviewDate,
		),
	}),
);

// Relations
export const hotelsRelations = relations(hotels, ({ many }) => ({
	reviews: many(reviews),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
	hotel: one(hotels, {
		fields: [reviews.hotelId],
		references: [hotels.hotelId],
	}),
	reviewer: one(reviewers, {
		fields: [reviews.reviewerId],
		references: [reviewers.id],
	}),
	processingJob: one(processingJobs, {
		fields: [reviews.processingJobId],
		references: [processingJobs.id],
	}),
}));

export const reviewersRelations = relations(reviewers, ({ many }) => ({
	reviews: many(reviews),
}));

export const processingJobsRelations = relations(
	processingJobs,
	({ many }) => ({
		reviews: many(reviews),
	}),
);
