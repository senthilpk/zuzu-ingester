CREATE TABLE "hotels" (
	"id" serial PRIMARY KEY NOT NULL,
	"hotel_id" integer NOT NULL,
	"platform" varchar(50) NOT NULL,
	"hotel_name" varchar(500),
	"overall_score" numeric(3, 1),
	"review_count" integer DEFAULT 0,
	"grades" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "hotels_hotel_id_unique" UNIQUE("hotel_id")
);
--> statement-breakpoint
CREATE TABLE "processing_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" varchar(255) NOT NULL,
	"filepath" varchar(500) NOT NULL,
	"platform" varchar(50) NOT NULL,
	"storage_provider" varchar(50) NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"total_records" integer DEFAULT 0,
	"valid_records" integer DEFAULT 0,
	"invalid_records" integer DEFAULT 0,
	"processing_time_ms" integer DEFAULT 0,
	"errors" jsonb DEFAULT '[]'::jsonb,
	"metadata" jsonb,
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "processing_jobs_job_id_unique" UNIQUE("job_id")
);
--> statement-breakpoint
CREATE TABLE "reviewers" (
	"id" serial PRIMARY KEY NOT NULL,
	"display_member_name" varchar(255),
	"country_name" varchar(100),
	"country_id" integer,
	"flag_name" varchar(10),
	"review_group_name" varchar(100),
	"room_type_name" varchar(200),
	"length_of_stay" integer,
	"reviewer_reviewed_count" integer DEFAULT 0,
	"is_expert_reviewer" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"hotel_review_id" integer NOT NULL,
	"hotel_id" integer NOT NULL,
	"reviewer_id" integer,
	"platform" varchar(50) NOT NULL,
	"rating" numeric(3, 1) NOT NULL,
	"rating_text" varchar(100),
	"review_title" varchar(500),
	"review_comments" text,
	"review_positives" text,
	"review_negatives" text,
	"review_date" timestamp NOT NULL,
	"check_in_date_month_and_year" varchar(50),
	"is_show_review_response" boolean DEFAULT false,
	"responder_name" varchar(255),
	"response_date_text" varchar(100),
	"translate_source" varchar(10),
	"translate_target" varchar(10),
	"encrypted_review_data" varchar(255),
	"provider_id" integer,
	"review_provider_text" varchar(100),
	"processing_job_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "reviews_hotel_review_id_unique" UNIQUE("hotel_review_id")
);
