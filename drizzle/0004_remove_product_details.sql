UPDATE `catalog_products`
SET `content_json` = json_remove(`content_json`, '$.details')
WHERE json_type(`content_json`, '$.details') IS NOT NULL;
