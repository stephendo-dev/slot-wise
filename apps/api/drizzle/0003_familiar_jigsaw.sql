CREATE TYPE "public"."booking_status" AS ENUM('confirmed', 'cancelled');--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"staff_id" uuid NOT NULL,
	"service_id" uuid NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"customer_name" text NOT NULL,
	"customer_email" text NOT NULL,
	"customer_phone" text NOT NULL,
	"status" "booking_status" DEFAULT 'confirmed' NOT NULL,
	"manage_token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bookings_manage_token_hash_unique" UNIQUE("manage_token_hash"),
	CONSTRAINT "bookings_range" CHECK ("bookings"."start_at" < "bookings"."end_at")
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_business_id_businesses_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."businesses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bookings_staff_start_idx" ON "bookings" USING btree ("staff_id","start_at");--> statement-breakpoint
CREATE INDEX "bookings_business_start_idx" ON "bookings" USING btree ("business_id","start_at");