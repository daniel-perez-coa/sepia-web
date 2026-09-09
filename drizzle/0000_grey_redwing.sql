CREATE TABLE `admin_audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor_id` text NOT NULL,
	`actor_email` text,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`action` text NOT NULL,
	`before_json` text,
	`after_json` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "admin_audit_before_json_check" CHECK("admin_audit_log"."before_json" is null or json_valid("admin_audit_log"."before_json")),
	CONSTRAINT "admin_audit_after_json_check" CHECK("admin_audit_log"."after_json" is null or json_valid("admin_audit_log"."after_json"))
);
--> statement-breakpoint
CREATE INDEX `idx_admin_audit_entity` ON `admin_audit_log` (`entity_type`,`entity_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `catalog_tabs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`label` text NOT NULL,
	`target_type` text DEFAULT 'all' NOT NULL,
	`category_id` integer,
	`collection_id` integer,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "catalog_tabs_target_type_check" CHECK("catalog_tabs"."target_type" in ('all', 'category', 'collection')),
	CONSTRAINT "catalog_tabs_target_check" CHECK(
    ("catalog_tabs"."target_type" = 'all' and "catalog_tabs"."category_id" is null and "catalog_tabs"."collection_id" is null)
    or ("catalog_tabs"."target_type" = 'category' and "catalog_tabs"."category_id" is not null and "catalog_tabs"."collection_id" is null)
    or ("catalog_tabs"."target_type" = 'collection' and "catalog_tabs"."collection_id" is not null and "catalog_tabs"."category_id" is null)
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_catalog_tabs_slug_unique` ON `catalog_tabs` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_catalog_tabs_active_order` ON `catalog_tabs` (`active`,`sort_order`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`parent_id` integer,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`image_url` text,
	`image_alt` text,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`deleted_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_categories_slug_unique` ON `categories` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_categories_parent_active_order` ON `categories` (`parent_id`,`active`,`sort_order`);--> statement-breakpoint
CREATE TABLE `collections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`image_url` text,
	`image_alt` text,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`deleted_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_collections_slug_unique` ON `collections` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_collections_active_order` ON `collections` (`active`,`sort_order`);--> statement-breakpoint
CREATE TABLE `display_presets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`component` text DEFAULT 'featured-title' NOT NULL,
	`config_json` text DEFAULT '{}' NOT NULL,
	`schema_version` integer DEFAULT 1 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "display_presets_config_json_check" CHECK(json_valid("display_presets"."config_json"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_display_presets_slug_unique` ON `display_presets` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_display_presets_component_active` ON `display_presets` (`component`,`active`);--> statement-breakpoint
CREATE TABLE `featured_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`legacy_id` text NOT NULL,
	`section_id` integer NOT NULL,
	`target_type` text NOT NULL,
	`product_id` integer,
	`category_id` integer,
	`collection_id` integer,
	`title1` text NOT NULL,
	`title1_preset_id` integer,
	`title2` text NOT NULL,
	`title2_preset_id` integer,
	`body` text,
	`image_url` text NOT NULL,
	`image_alt` text,
	`link_label` text,
	`link_url` text,
	`show_line` integer DEFAULT true NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`starts_at` text,
	`ends_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`section_id`) REFERENCES `featured_sections`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`title1_preset_id`) REFERENCES `display_presets`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`title2_preset_id`) REFERENCES `display_presets`(`id`) ON UPDATE no action ON DELETE restrict,
	CONSTRAINT "featured_items_target_type_check" CHECK("featured_items"."target_type" in ('product', 'category', 'collection')),
	CONSTRAINT "featured_items_target_check" CHECK(
    ("featured_items"."target_type" = 'product' and "featured_items"."product_id" is not null and "featured_items"."category_id" is null and "featured_items"."collection_id" is null)
    or ("featured_items"."target_type" = 'category' and "featured_items"."category_id" is not null and "featured_items"."product_id" is null and "featured_items"."collection_id" is null)
    or ("featured_items"."target_type" = 'collection' and "featured_items"."collection_id" is not null and "featured_items"."product_id" is null and "featured_items"."category_id" is null)
  )
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_featured_items_legacy_id_unique` ON `featured_items` (`legacy_id`);--> statement-breakpoint
CREATE INDEX `idx_featured_items_section_active_order` ON `featured_items` (`section_id`,`active`,`sort_order`);--> statement-breakpoint
CREATE TABLE `featured_sections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`autoplay_ms` integer DEFAULT 6500 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "featured_sections_autoplay_check" CHECK("featured_sections"."autoplay_ms" >= 3000)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_featured_sections_key_unique` ON `featured_sections` (`key`);--> statement-breakpoint
CREATE TABLE `product_categories` (
	`product_id` integer NOT NULL,
	`category_id` integer NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`product_id`, `category_id`),
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_product_categories_category` ON `product_categories` (`category_id`,`product_id`);--> statement-breakpoint
CREATE TABLE `product_collections` (
	`product_id` integer NOT NULL,
	`collection_id` integer NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`product_id`, `collection_id`),
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_product_collections_collection` ON `product_collections` (`collection_id`,`product_id`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`legacy_id` text NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`label` text,
	`short_description` text,
	`long_description` text,
	`price_minor` integer DEFAULT 0 NOT NULL,
	`currency` text DEFAULT 'MXN' NOT NULL,
	`stock` integer DEFAULT 0 NOT NULL,
	`primary_image_url` text,
	`primary_image_alt` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`content_json` text DEFAULT '{}' NOT NULL,
	`published_at` text,
	`deleted_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "products_status_check" CHECK("products"."status" in ('draft', 'published', 'archived')),
	CONSTRAINT "products_price_check" CHECK("products"."price_minor" >= 0),
	CONSTRAINT "products_stock_check" CHECK("products"."stock" >= 0),
	CONSTRAINT "products_content_json_check" CHECK(json_valid("products"."content_json"))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_products_legacy_id_unique` ON `products` (`legacy_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_products_slug_unique` ON `products` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_products_status_order` ON `products` (`status`,`sort_order`);