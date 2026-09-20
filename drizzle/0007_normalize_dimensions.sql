UPDATE `catalog_products`
SET `content_json` = json_set(
  `content_json`, '$.dimensions', json_array(
    json_object('icon', 'arrows-vertical', 'title', 'Alto', 'value', COALESCE(json_extract(`content_json`, '$.dimensions.height'), '')),
    json_object('icon', 'arrows', 'title', 'Ancho', 'value', COALESCE(json_extract(`content_json`, '$.dimensions.width'), '')),
    json_object('icon', 'box', 'title', 'Profundidad', 'value', COALESCE(json_extract(`content_json`, '$.dimensions.depth'), ''))
  )
)
WHERE json_type(`content_json`, '$.dimensions') = 'object';
