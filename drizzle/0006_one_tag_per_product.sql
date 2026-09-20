DELETE FROM `product_tags`
WHERE EXISTS (
  SELECT 1 FROM `product_tags` other
  WHERE other.product_id = product_tags.product_id AND other.tag_id < product_tags.tag_id
);
