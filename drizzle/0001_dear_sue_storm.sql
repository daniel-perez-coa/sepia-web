CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor_id` text NOT NULL,
	`actor_email` text,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`action` text NOT NULL,
	`before_json` text,
	`after_json` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "audit_log_before_json" CHECK("audit_log"."before_json" IS NULL OR json_valid("audit_log"."before_json")),
	CONSTRAINT "audit_log_after_json" CHECK("audit_log"."after_json" IS NULL OR json_valid("audit_log"."after_json"))
);
--> statement-breakpoint
CREATE INDEX `idx_audit_log_entity_time` ON `audit_log` (`entity_type`,`entity_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `catalog_categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`image_url` text DEFAULT '' NOT NULL,
	`image_alt` text DEFAULT '' NOT NULL,
	`tab_label` text DEFAULT '' NOT NULL,
	`show_in_nav` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_by` text NOT NULL,
	`deactivated_at` text,
	`deactivated_by` text,
	`version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_catalog_categories_slug` ON `catalog_categories` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_catalog_categories_navigation` ON `catalog_categories` (`active`,`show_in_nav`,`sort_order`);--> statement-breakpoint
CREATE TABLE `catalog_collections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`image_url` text DEFAULT '' NOT NULL,
	`image_alt` text DEFAULT '' NOT NULL,
	`tab_label` text DEFAULT '' NOT NULL,
	`show_in_nav` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_by` text NOT NULL,
	`deactivated_at` text,
	`deactivated_by` text,
	`version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_catalog_collections_slug` ON `catalog_collections` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_catalog_collections_navigation` ON `catalog_collections` (`active`,`show_in_nav`,`sort_order`);--> statement-breakpoint
CREATE TABLE `catalog_products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`label` text DEFAULT '' NOT NULL,
	`short_description` text DEFAULT '' NOT NULL,
	`long_description` text DEFAULT '' NOT NULL,
	`price_minor` integer NOT NULL,
	`currency` text DEFAULT 'MXN' NOT NULL,
	`stock` integer DEFAULT 0 NOT NULL,
	`primary_image_url` text DEFAULT '' NOT NULL,
	`primary_image_alt` text DEFAULT '' NOT NULL,
	`content_json` text DEFAULT '{}' NOT NULL,
	`collection_id` integer NOT NULL,
	`category_id` integer NOT NULL,
	`subcategory_id` integer,
	`is_promotion` integer DEFAULT false NOT NULL,
	`promotion_label` text DEFAULT 'PROMOCIÓN' NOT NULL,
	`promotion_price_minor` integer,
	`promotion_starts_at` text,
	`promotion_ends_at` text,
	`is_featured` integer DEFAULT false NOT NULL,
	`featured_order` integer DEFAULT 0 NOT NULL,
	`featured_config_json` text DEFAULT '{}' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_by` text NOT NULL,
	`deactivated_at` text,
	`deactivated_by` text,
	`version` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`collection_id`) REFERENCES `catalog_collections`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`category_id`) REFERENCES `catalog_categories`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`category_id`,`subcategory_id`) REFERENCES `catalog_subcategories`(`category_id`,`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "catalog_products_price" CHECK("catalog_products"."price_minor" >= 0 AND "catalog_products"."stock" >= 0),
	CONSTRAINT "catalog_products_promotion_price" CHECK("catalog_products"."promotion_price_minor" IS NULL OR ("catalog_products"."promotion_price_minor" >= 0 AND "catalog_products"."promotion_price_minor" < "catalog_products"."price_minor")),
	CONSTRAINT "catalog_products_promotion_dates" CHECK(("catalog_products"."promotion_starts_at" IS NULL OR datetime("catalog_products"."promotion_starts_at") IS NOT NULL) AND ("catalog_products"."promotion_ends_at" IS NULL OR datetime("catalog_products"."promotion_ends_at") IS NOT NULL) AND ("catalog_products"."promotion_starts_at" IS NULL OR "catalog_products"."promotion_ends_at" IS NULL OR datetime("catalog_products"."promotion_starts_at") < datetime("catalog_products"."promotion_ends_at"))),
	CONSTRAINT "catalog_products_content" CHECK(json_valid("catalog_products"."content_json") AND json_type("catalog_products"."content_json") = 'object'),
	CONSTRAINT "catalog_products_featured_config" CHECK(json_valid("catalog_products"."featured_config_json") AND json_type("catalog_products"."featured_config_json") = 'object')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_catalog_products_code` ON `catalog_products` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_catalog_products_slug` ON `catalog_products` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_catalog_products_active_order` ON `catalog_products` (`active`,`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_catalog_products_collection` ON `catalog_products` (`collection_id`,`active`);--> statement-breakpoint
CREATE INDEX `idx_catalog_products_category` ON `catalog_products` (`category_id`,`subcategory_id`,`active`);--> statement-breakpoint
CREATE INDEX `idx_catalog_products_featured` ON `catalog_products` (`is_featured`,`active`,`featured_order`);--> statement-breakpoint
CREATE TABLE `catalog_subcategories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`image_url` text DEFAULT '' NOT NULL,
	`image_alt` text DEFAULT '' NOT NULL,
	`tab_label` text DEFAULT '' NOT NULL,
	`show_in_nav` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_by` text NOT NULL,
	`deactivated_at` text,
	`deactivated_by` text,
	`version` integer DEFAULT 1 NOT NULL,
	`category_id` integer NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `catalog_categories`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_catalog_subcategories_slug` ON `catalog_subcategories` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_catalog_subcategories_parent_id` ON `catalog_subcategories` (`category_id`,`id`);--> statement-breakpoint
CREATE INDEX `idx_catalog_subcategories_parent_active` ON `catalog_subcategories` (`category_id`,`active`,`sort_order`);--> statement-breakpoint
CREATE TABLE `site_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`value_json` text DEFAULT '{}' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_by` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_by` text NOT NULL,
	`deactivated_at` text,
	`deactivated_by` text,
	`version` integer DEFAULT 1 NOT NULL,
	CONSTRAINT "site_settings_json" CHECK(json_valid("site_settings"."value_json"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_site_settings_key` ON `site_settings` (`key`);