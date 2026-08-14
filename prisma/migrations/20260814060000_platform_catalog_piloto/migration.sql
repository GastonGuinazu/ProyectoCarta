-- Catálogo mínimo para el primer deploy (docs/produccion-checklist.md §5).
-- Sin esto, POST /admin/platform/tenants responde 422 PLAN_NOT_CONFIGURED.
-- Idempotente: el seed local usa el mismo id de Plan y los mismos codes.

INSERT INTO "plans" (
  "id",
  "name",
  "price_cents",
  "currency",
  "billing_period",
  "max_branches",
  "max_products",
  "max_storage_mb",
  "max_languages",
  "web_ar_enabled",
  "custom_domain_enabled",
  "advanced_analytics_enabled",
  "rate_limit_per_minute",
  "created_at",
  "updated_at"
) VALUES (
  '00000000-0000-0000-0000-0000000000f1',
  'Piloto',
  0,
  'ARS',
  'MONTHLY',
  3,
  100,
  1024,
  2,
  true,
  false,
  false,
  120,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "allergens" ("id", "code", "name") VALUES
  (
    '00000000-0000-0000-0000-0000000000e1',
    'TACC',
    '{"es":"TACC (Gluten)","en":"Gluten"}'::jsonb
  ),
  (
    '00000000-0000-0000-0000-0000000000e2',
    'LACTEOS',
    '{"es":"Lácteos","en":"Dairy"}'::jsonb
  )
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "dietary_tags" ("id", "code", "name") VALUES
  (
    '00000000-0000-0000-0000-0000000000e3',
    'VEGANO',
    '{"es":"Vegano","en":"Vegan"}'::jsonb
  )
ON CONFLICT ("code") DO NOTHING;
