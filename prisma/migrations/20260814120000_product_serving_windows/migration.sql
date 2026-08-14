-- Franjas extra de horario de servicio (almuerzo + cena, etc.).
-- Las columnas start/end siguen siendo la primera franja (check SQL intacto).
ALTER TABLE "products" ADD COLUMN "served_windows" JSONB;

UPDATE "products"
SET "served_windows" = jsonb_build_array(
  jsonb_build_object(
    'startMinuteOfDay', "served_start_minute_of_day",
    'endMinuteOfDay', "served_end_minute_of_day"
  )
)
WHERE "served_start_minute_of_day" IS NOT NULL
  AND "served_end_minute_of_day" IS NOT NULL;
