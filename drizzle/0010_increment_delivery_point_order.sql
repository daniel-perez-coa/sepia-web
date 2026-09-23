WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY sort_order, name, id) - 1 AS position
  FROM delivery_points
)
UPDATE delivery_points
SET sort_order = (SELECT position FROM ranked WHERE ranked.id = delivery_points.id);
