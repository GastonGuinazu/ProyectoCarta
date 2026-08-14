-- AlterTable
ALTER TABLE "products" ADD COLUMN "served_start_minute_of_day" INTEGER;
ALTER TABLE "products" ADD COLUMN "served_end_minute_of_day" INTEGER;

ALTER TABLE "products"
  ADD CONSTRAINT "products_serving_hours_pair_check"
  CHECK (
    ("served_start_minute_of_day" IS NULL AND "served_end_minute_of_day" IS NULL)
    OR (
      "served_start_minute_of_day" IS NOT NULL
      AND "served_end_minute_of_day" IS NOT NULL
      AND "served_start_minute_of_day" <> "served_end_minute_of_day"
      AND "served_start_minute_of_day" >= 0
      AND "served_start_minute_of_day" <= 1439
      AND "served_end_minute_of_day" >= 0
      AND "served_end_minute_of_day" <= 1439
    )
  );
