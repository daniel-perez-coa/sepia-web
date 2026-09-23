CREATE TABLE `delivery_points` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`schedule` text NOT NULL,
	`latitude` text NOT NULL,
	`longitude` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_by` text NOT NULL,
	`deactivated_at` text,
	`deactivated_by` text,
	`version` integer DEFAULT 1 NOT NULL,
	CONSTRAINT "delivery_points_latitude" CHECK(CAST("delivery_points"."latitude" AS REAL) BETWEEN -90 AND 90),
	CONSTRAINT "delivery_points_longitude" CHECK(CAST("delivery_points"."longitude" AS REAL) BETWEEN -180 AND 180)
);
--> statement-breakpoint
CREATE INDEX `idx_delivery_points_active_order` ON `delivery_points` (`active`,`sort_order`);
