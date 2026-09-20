CREATE TABLE `catalog_tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
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
CREATE UNIQUE INDEX `idx_catalog_tags_name` ON `catalog_tags` (`name`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_catalog_tags_slug` ON `catalog_tags` (`slug`);
--> statement-breakpoint
CREATE INDEX `idx_catalog_tags_active_order` ON `catalog_tags` (`active`,`sort_order`,`name`);
--> statement-breakpoint
CREATE TABLE `product_tags` (
	`product_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	PRIMARY KEY(`product_id`, `tag_id`),
	FOREIGN KEY (`product_id`) REFERENCES `catalog_products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `catalog_tags`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_product_tags_tag` ON `product_tags` (`tag_id`,`product_id`);
--> statement-breakpoint
INSERT INTO `catalog_tags` (`name`, `slug`, `sort_order`, `active`, `created_by`, `updated_by`)
SELECT DISTINCT trim(j.value), 'tag-' || lower(hex(CAST(trim(j.value) AS blob))), 0, 1, 'migration:tags', 'migration:tags'
FROM `catalog_products` p, json_each(p.`content_json`, '$.badges') j
WHERE json_type(p.`content_json`, '$.badges') = 'array' AND trim(j.value) <> '';
--> statement-breakpoint
INSERT INTO `product_tags` (`product_id`, `tag_id`)
SELECT DISTINCT p.id, t.id
FROM `catalog_products` p, json_each(p.`content_json`, '$.badges') j
JOIN `catalog_tags` t ON t.name = trim(j.value)
WHERE json_type(p.`content_json`, '$.badges') = 'array';
--> statement-breakpoint
UPDATE `catalog_products`
SET `content_json` = json_remove(
	`content_json`,
	'$.story',
	'$.edition',
	'$.badges',
	'$.relatedProducts',
	'$.dimensionsMaterialsAlt'
);
