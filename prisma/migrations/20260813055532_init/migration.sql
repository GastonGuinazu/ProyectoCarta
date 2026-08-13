-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'TRIAL', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BillingPeriod" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INVITED', 'DISABLED');

-- CreateEnum
CREATE TYPE "RoleType" AS ENUM ('OWNER', 'ADMIN', 'STAFF');

-- CreateEnum
CREATE TYPE "BranchOperationalStatus" AS ENUM ('OPEN', 'CLOSED_TEMPORARILY', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "AvailabilityStatus" AS ENUM ('AVAILABLE', 'OUT_OF_STOCK', 'DISCONTINUED');

-- CreateEnum
CREATE TYPE "VariantSelectionType" AS ENUM ('SINGLE', 'MULTIPLE');

-- CreateEnum
CREATE TYPE "PromoDiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT', 'FIXED_PRICE');

-- CreateEnum
CREATE TYPE "PromoStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "MediaFileType" AS ENUM ('IMAGE', 'VIDEO');

-- CreateEnum
CREATE TYPE "MediaPipelineStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'ERROR');

-- CreateEnum
CREATE TYPE "MediaVariantPurpose" AS ENUM ('THUMBNAIL', 'DETAIL', 'AR_CUTOUT');

-- CreateEnum
CREATE TYPE "MediaVariantFormat" AS ENUM ('WEBP', 'AVIF', 'PNG');

-- CreateEnum
CREATE TYPE "MediaRole" AS ENUM ('PRIMARY', 'GALLERY');

-- CreateEnum
CREATE TYPE "InteractionType" AS ENUM ('CATEGORY_VIEW', 'PRODUCT_DETAIL_VIEW', 'AR_VIEW_CLICK', 'ALLERGEN_FILTER_APPLIED', 'LANGUAGE_CHANGED', 'PROMO_CLICK');

-- CreateEnum
CREATE TYPE "AnalyticsEntityType" AS ENUM ('PRODUCT', 'CATEGORY', 'PROMO', 'HAPPY_HOUR');

-- CreateEnum
CREATE TYPE "AggregationDimensionType" AS ENUM ('BRANCH', 'PRODUCT', 'CATEGORY', 'PROMO');

-- CreateEnum
CREATE TYPE "AggregationPeriodType" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateTable
CREATE TABLE "plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "billing_period" "BillingPeriod" NOT NULL,
    "max_branches" INTEGER NOT NULL,
    "max_products" INTEGER NOT NULL,
    "max_storage_mb" INTEGER NOT NULL,
    "max_languages" INTEGER NOT NULL,
    "web_ar_enabled" BOOLEAN NOT NULL DEFAULT false,
    "custom_domain_enabled" BOOLEAN NOT NULL DEFAULT false,
    "advanced_analytics_enabled" BOOLEAN NOT NULL DEFAULT false,
    "rate_limit_per_minute" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "custom_domain" TEXT,
    "default_language" TEXT NOT NULL DEFAULT 'es',
    "status" "TenantStatus" NOT NULL DEFAULT 'TRIAL',
    "plan_id" TEXT NOT NULL,
    "brand_primary_color" TEXT,
    "logo_media_asset_id" TEXT,
    "next_billing_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'INVITED',
    "preferred_language" TEXT NOT NULL DEFAULT 'es',
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_assignments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "role" "RoleType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "whatsapp" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
    "default_language" TEXT,
    "operational_status" "BranchOperationalStatus" NOT NULL DEFAULT 'OPEN',
    "schedule_json" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qr_codes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qr_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "slug" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "description" JSONB,
    "image_media_asset_id" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "available_in_all_branches" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_branch_availabilities" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,

    CONSTRAINT "category_branch_availabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "description" JSONB,
    "base_price_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "sku" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "availability" "AvailabilityStatus" NOT NULL DEFAULT 'AVAILABLE',
    "available_in_all_branches" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_branch_availabilities" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,

    CONSTRAINT "product_branch_availabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variant_groups" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "selection_type" "VariantSelectionType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "variant_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "variant_options" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "variant_group_id" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "price_delta_cents" INTEGER NOT NULL DEFAULT 0,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "variant_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "combos" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "description" JSONB,
    "price_cents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "image_media_asset_id" TEXT,
    "availability" "AvailabilityStatus" NOT NULL DEFAULT 'AVAILABLE',
    "available_in_all_branches" BOOLEAN NOT NULL DEFAULT true,
    "start_at" TIMESTAMP(3),
    "end_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "combos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "combo_items" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "combo_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "combo_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "combo_branch_availabilities" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "combo_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,

    CONSTRAINT "combo_branch_availabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allergens" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "icon_url" TEXT,

    CONSTRAINT "allergens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dietary_tags" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "icon_url" TEXT,

    CONSTRAINT "dietary_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_allergens" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "allergen_id" TEXT NOT NULL,

    CONSTRAINT "product_allergens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_dietary_tags" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "dietary_tag_id" TEXT NOT NULL,

    CONSTRAINT "product_dietary_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promos" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "description" JSONB,
    "discount_type" "PromoDiscountType" NOT NULL,
    "discount_percentage_bp" INTEGER,
    "discount_amount_cents" INTEGER,
    "fixed_price_cents" INTEGER,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" "PromoStatus" NOT NULL DEFAULT 'SCHEDULED',
    "available_in_all_branches" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "promos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo_product_targets" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "promo_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,

    CONSTRAINT "promo_product_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo_category_targets" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "promo_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,

    CONSTRAINT "promo_category_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo_combo_targets" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "promo_id" TEXT NOT NULL,
    "combo_id" TEXT NOT NULL,

    CONSTRAINT "promo_combo_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo_branches" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "promo_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,

    CONSTRAINT "promo_branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "happy_hours" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "discount_type" "PromoDiscountType" NOT NULL,
    "discount_percentage_bp" INTEGER,
    "discount_amount_cents" INTEGER,
    "fixed_price_cents" INTEGER,
    "days_of_week" "DayOfWeek"[],
    "start_minute_of_day" INTEGER NOT NULL,
    "end_minute_of_day" INTEGER NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "available_in_all_branches" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "happy_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "happy_hour_product_targets" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "happy_hour_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,

    CONSTRAINT "happy_hour_product_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "happy_hour_category_targets" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "happy_hour_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,

    CONSTRAINT "happy_hour_category_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "happy_hour_combo_targets" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "happy_hour_id" TEXT NOT NULL,
    "combo_id" TEXT NOT NULL,

    CONSTRAINT "happy_hour_combo_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "happy_hour_branches" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "happy_hour_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,

    CONSTRAINT "happy_hour_branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "uploaded_by_user_id" TEXT,
    "file_type" "MediaFileType" NOT NULL,
    "original_url" TEXT NOT NULL,
    "file_size_bytes" INTEGER NOT NULL,
    "pipeline_status" "MediaPipelineStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processed_variants" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "media_asset_id" TEXT NOT NULL,
    "purpose" "MediaVariantPurpose" NOT NULL,
    "format" "MediaVariantFormat" NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_media" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "media_asset_id" TEXT NOT NULL,
    "role" "MediaRole" NOT NULL DEFAULT 'GALLERY',
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_events" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "qr_code_id" TEXT,
    "session_id" TEXT NOT NULL,
    "device_type" TEXT,
    "user_agent" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scan_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interaction_events" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "scan_event_id" TEXT,
    "session_id" TEXT NOT NULL,
    "interaction_type" "InteractionType" NOT NULL,
    "entity_type" "AnalyticsEntityType",
    "entity_id" TEXT,
    "view_duration_ms" INTEGER,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interaction_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aggregated_metrics" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "branch_id" TEXT,
    "dimension_type" "AggregationDimensionType" NOT NULL,
    "dimension_id" TEXT,
    "period_type" "AggregationPeriodType" NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "total_scans" INTEGER NOT NULL DEFAULT 0,
    "total_product_views" INTEGER NOT NULL DEFAULT 0,
    "interaction_rate_bp" INTEGER NOT NULL DEFAULT 0,
    "top_product_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "aggregated_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_custom_domain_key" ON "tenants"("custom_domain");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_logo_media_asset_id_key" ON "tenants"("logo_media_asset_id");

-- CreateIndex
CREATE INDEX "tenants_status_idx" ON "tenants"("status");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");

-- CreateIndex
CREATE INDEX "role_assignments_tenant_id_branch_id_idx" ON "role_assignments"("tenant_id", "branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "role_assignments_user_id_tenant_id_branch_id_key" ON "role_assignments"("user_id", "tenant_id", "branch_id");

-- CreateIndex
CREATE INDEX "branches_tenant_id_operational_status_idx" ON "branches"("tenant_id", "operational_status");

-- CreateIndex
CREATE UNIQUE INDEX "branches_tenant_id_slug_key" ON "branches"("tenant_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "qr_codes_code_key" ON "qr_codes"("code");

-- CreateIndex
CREATE INDEX "qr_codes_tenant_id_branch_id_idx" ON "qr_codes"("tenant_id", "branch_id");

-- CreateIndex
CREATE INDEX "categories_tenant_id_parent_id_idx" ON "categories"("tenant_id", "parent_id");

-- CreateIndex
CREATE INDEX "categories_tenant_id_order_idx" ON "categories"("tenant_id", "order");

-- CreateIndex
CREATE UNIQUE INDEX "categories_tenant_id_slug_key" ON "categories"("tenant_id", "slug");

-- CreateIndex
CREATE INDEX "category_branch_availabilities_tenant_id_branch_id_idx" ON "category_branch_availabilities"("tenant_id", "branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "category_branch_availabilities_category_id_branch_id_key" ON "category_branch_availabilities"("category_id", "branch_id");

-- CreateIndex
CREATE INDEX "products_tenant_id_category_id_idx" ON "products"("tenant_id", "category_id");

-- CreateIndex
CREATE INDEX "products_tenant_id_availability_idx" ON "products"("tenant_id", "availability");

-- CreateIndex
CREATE UNIQUE INDEX "products_tenant_id_sku_key" ON "products"("tenant_id", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "products_tenant_id_slug_key" ON "products"("tenant_id", "slug");

-- CreateIndex
CREATE INDEX "product_branch_availabilities_tenant_id_branch_id_idx" ON "product_branch_availabilities"("tenant_id", "branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_branch_availabilities_product_id_branch_id_key" ON "product_branch_availabilities"("product_id", "branch_id");

-- CreateIndex
CREATE INDEX "variant_groups_tenant_id_product_id_idx" ON "variant_groups"("tenant_id", "product_id");

-- CreateIndex
CREATE INDEX "variant_options_tenant_id_variant_group_id_idx" ON "variant_options"("tenant_id", "variant_group_id");

-- CreateIndex
CREATE INDEX "combos_tenant_id_availability_idx" ON "combos"("tenant_id", "availability");

-- CreateIndex
CREATE UNIQUE INDEX "combos_tenant_id_slug_key" ON "combos"("tenant_id", "slug");

-- CreateIndex
CREATE INDEX "combo_items_tenant_id_combo_id_idx" ON "combo_items"("tenant_id", "combo_id");

-- CreateIndex
CREATE UNIQUE INDEX "combo_items_combo_id_product_id_key" ON "combo_items"("combo_id", "product_id");

-- CreateIndex
CREATE INDEX "combo_branch_availabilities_tenant_id_branch_id_idx" ON "combo_branch_availabilities"("tenant_id", "branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "combo_branch_availabilities_combo_id_branch_id_key" ON "combo_branch_availabilities"("combo_id", "branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "allergens_code_key" ON "allergens"("code");

-- CreateIndex
CREATE UNIQUE INDEX "dietary_tags_code_key" ON "dietary_tags"("code");

-- CreateIndex
CREATE INDEX "product_allergens_tenant_id_allergen_id_idx" ON "product_allergens"("tenant_id", "allergen_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_allergens_product_id_allergen_id_key" ON "product_allergens"("product_id", "allergen_id");

-- CreateIndex
CREATE INDEX "product_dietary_tags_tenant_id_dietary_tag_id_idx" ON "product_dietary_tags"("tenant_id", "dietary_tag_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_dietary_tags_product_id_dietary_tag_id_key" ON "product_dietary_tags"("product_id", "dietary_tag_id");

-- CreateIndex
CREATE INDEX "promos_tenant_id_status_idx" ON "promos"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "promos_tenant_id_start_at_end_at_idx" ON "promos"("tenant_id", "start_at", "end_at");

-- CreateIndex
CREATE INDEX "promo_product_targets_tenant_id_product_id_idx" ON "promo_product_targets"("tenant_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "promo_product_targets_promo_id_product_id_key" ON "promo_product_targets"("promo_id", "product_id");

-- CreateIndex
CREATE INDEX "promo_category_targets_tenant_id_category_id_idx" ON "promo_category_targets"("tenant_id", "category_id");

-- CreateIndex
CREATE UNIQUE INDEX "promo_category_targets_promo_id_category_id_key" ON "promo_category_targets"("promo_id", "category_id");

-- CreateIndex
CREATE INDEX "promo_combo_targets_tenant_id_combo_id_idx" ON "promo_combo_targets"("tenant_id", "combo_id");

-- CreateIndex
CREATE UNIQUE INDEX "promo_combo_targets_promo_id_combo_id_key" ON "promo_combo_targets"("promo_id", "combo_id");

-- CreateIndex
CREATE INDEX "promo_branches_tenant_id_branch_id_idx" ON "promo_branches"("tenant_id", "branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "promo_branches_promo_id_branch_id_key" ON "promo_branches"("promo_id", "branch_id");

-- CreateIndex
CREATE INDEX "happy_hours_tenant_id_enabled_idx" ON "happy_hours"("tenant_id", "enabled");

-- CreateIndex
CREATE INDEX "happy_hour_product_targets_tenant_id_product_id_idx" ON "happy_hour_product_targets"("tenant_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "happy_hour_product_targets_happy_hour_id_product_id_key" ON "happy_hour_product_targets"("happy_hour_id", "product_id");

-- CreateIndex
CREATE INDEX "happy_hour_category_targets_tenant_id_category_id_idx" ON "happy_hour_category_targets"("tenant_id", "category_id");

-- CreateIndex
CREATE UNIQUE INDEX "happy_hour_category_targets_happy_hour_id_category_id_key" ON "happy_hour_category_targets"("happy_hour_id", "category_id");

-- CreateIndex
CREATE INDEX "happy_hour_combo_targets_tenant_id_combo_id_idx" ON "happy_hour_combo_targets"("tenant_id", "combo_id");

-- CreateIndex
CREATE UNIQUE INDEX "happy_hour_combo_targets_happy_hour_id_combo_id_key" ON "happy_hour_combo_targets"("happy_hour_id", "combo_id");

-- CreateIndex
CREATE INDEX "happy_hour_branches_tenant_id_branch_id_idx" ON "happy_hour_branches"("tenant_id", "branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "happy_hour_branches_happy_hour_id_branch_id_key" ON "happy_hour_branches"("happy_hour_id", "branch_id");

-- CreateIndex
CREATE INDEX "media_assets_tenant_id_pipeline_status_idx" ON "media_assets"("tenant_id", "pipeline_status");

-- CreateIndex
CREATE INDEX "processed_variants_tenant_id_media_asset_id_purpose_idx" ON "processed_variants"("tenant_id", "media_asset_id", "purpose");

-- CreateIndex
CREATE INDEX "product_media_tenant_id_product_id_role_idx" ON "product_media"("tenant_id", "product_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "product_media_product_id_media_asset_id_key" ON "product_media"("product_id", "media_asset_id");

-- CreateIndex
CREATE INDEX "scan_events_tenant_id_branch_id_occurred_at_idx" ON "scan_events"("tenant_id", "branch_id", "occurred_at");

-- CreateIndex
CREATE INDEX "scan_events_tenant_id_session_id_idx" ON "scan_events"("tenant_id", "session_id");

-- CreateIndex
CREATE INDEX "interaction_events_tenant_id_branch_id_occurred_at_idx" ON "interaction_events"("tenant_id", "branch_id", "occurred_at");

-- CreateIndex
CREATE INDEX "interaction_events_tenant_id_entity_type_entity_id_idx" ON "interaction_events"("tenant_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "interaction_events_tenant_id_session_id_idx" ON "interaction_events"("tenant_id", "session_id");

-- CreateIndex
CREATE INDEX "aggregated_metrics_tenant_id_branch_id_period_type_period_s_idx" ON "aggregated_metrics"("tenant_id", "branch_id", "period_type", "period_start");

-- CreateIndex
CREATE UNIQUE INDEX "aggregated_metrics_tenant_id_dimension_type_dimension_id_pe_key" ON "aggregated_metrics"("tenant_id", "dimension_type", "dimension_id", "period_type", "period_start");

-- AddForeignKey
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_logo_media_asset_id_fkey" FOREIGN KEY ("logo_media_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qr_codes" ADD CONSTRAINT "qr_codes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qr_codes" ADD CONSTRAINT "qr_codes_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_image_media_asset_id_fkey" FOREIGN KEY ("image_media_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_branch_availabilities" ADD CONSTRAINT "category_branch_availabilities_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_branch_availabilities" ADD CONSTRAINT "category_branch_availabilities_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_branch_availabilities" ADD CONSTRAINT "category_branch_availabilities_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_branch_availabilities" ADD CONSTRAINT "product_branch_availabilities_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_branch_availabilities" ADD CONSTRAINT "product_branch_availabilities_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_branch_availabilities" ADD CONSTRAINT "product_branch_availabilities_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_groups" ADD CONSTRAINT "variant_groups_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_groups" ADD CONSTRAINT "variant_groups_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_options" ADD CONSTRAINT "variant_options_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "variant_options" ADD CONSTRAINT "variant_options_variant_group_id_fkey" FOREIGN KEY ("variant_group_id") REFERENCES "variant_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "combos" ADD CONSTRAINT "combos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "combos" ADD CONSTRAINT "combos_image_media_asset_id_fkey" FOREIGN KEY ("image_media_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "combo_items" ADD CONSTRAINT "combo_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "combo_items" ADD CONSTRAINT "combo_items_combo_id_fkey" FOREIGN KEY ("combo_id") REFERENCES "combos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "combo_items" ADD CONSTRAINT "combo_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "combo_branch_availabilities" ADD CONSTRAINT "combo_branch_availabilities_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "combo_branch_availabilities" ADD CONSTRAINT "combo_branch_availabilities_combo_id_fkey" FOREIGN KEY ("combo_id") REFERENCES "combos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "combo_branch_availabilities" ADD CONSTRAINT "combo_branch_availabilities_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_allergens" ADD CONSTRAINT "product_allergens_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_allergens" ADD CONSTRAINT "product_allergens_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_allergens" ADD CONSTRAINT "product_allergens_allergen_id_fkey" FOREIGN KEY ("allergen_id") REFERENCES "allergens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_dietary_tags" ADD CONSTRAINT "product_dietary_tags_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_dietary_tags" ADD CONSTRAINT "product_dietary_tags_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_dietary_tags" ADD CONSTRAINT "product_dietary_tags_dietary_tag_id_fkey" FOREIGN KEY ("dietary_tag_id") REFERENCES "dietary_tags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promos" ADD CONSTRAINT "promos_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_product_targets" ADD CONSTRAINT "promo_product_targets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_product_targets" ADD CONSTRAINT "promo_product_targets_promo_id_fkey" FOREIGN KEY ("promo_id") REFERENCES "promos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_product_targets" ADD CONSTRAINT "promo_product_targets_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_category_targets" ADD CONSTRAINT "promo_category_targets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_category_targets" ADD CONSTRAINT "promo_category_targets_promo_id_fkey" FOREIGN KEY ("promo_id") REFERENCES "promos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_category_targets" ADD CONSTRAINT "promo_category_targets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_combo_targets" ADD CONSTRAINT "promo_combo_targets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_combo_targets" ADD CONSTRAINT "promo_combo_targets_promo_id_fkey" FOREIGN KEY ("promo_id") REFERENCES "promos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_combo_targets" ADD CONSTRAINT "promo_combo_targets_combo_id_fkey" FOREIGN KEY ("combo_id") REFERENCES "combos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_branches" ADD CONSTRAINT "promo_branches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_branches" ADD CONSTRAINT "promo_branches_promo_id_fkey" FOREIGN KEY ("promo_id") REFERENCES "promos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_branches" ADD CONSTRAINT "promo_branches_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "happy_hours" ADD CONSTRAINT "happy_hours_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "happy_hour_product_targets" ADD CONSTRAINT "happy_hour_product_targets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "happy_hour_product_targets" ADD CONSTRAINT "happy_hour_product_targets_happy_hour_id_fkey" FOREIGN KEY ("happy_hour_id") REFERENCES "happy_hours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "happy_hour_product_targets" ADD CONSTRAINT "happy_hour_product_targets_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "happy_hour_category_targets" ADD CONSTRAINT "happy_hour_category_targets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "happy_hour_category_targets" ADD CONSTRAINT "happy_hour_category_targets_happy_hour_id_fkey" FOREIGN KEY ("happy_hour_id") REFERENCES "happy_hours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "happy_hour_category_targets" ADD CONSTRAINT "happy_hour_category_targets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "happy_hour_combo_targets" ADD CONSTRAINT "happy_hour_combo_targets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "happy_hour_combo_targets" ADD CONSTRAINT "happy_hour_combo_targets_happy_hour_id_fkey" FOREIGN KEY ("happy_hour_id") REFERENCES "happy_hours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "happy_hour_combo_targets" ADD CONSTRAINT "happy_hour_combo_targets_combo_id_fkey" FOREIGN KEY ("combo_id") REFERENCES "combos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "happy_hour_branches" ADD CONSTRAINT "happy_hour_branches_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "happy_hour_branches" ADD CONSTRAINT "happy_hour_branches_happy_hour_id_fkey" FOREIGN KEY ("happy_hour_id") REFERENCES "happy_hours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "happy_hour_branches" ADD CONSTRAINT "happy_hour_branches_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processed_variants" ADD CONSTRAINT "processed_variants_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processed_variants" ADD CONSTRAINT "processed_variants_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_events" ADD CONSTRAINT "scan_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_events" ADD CONSTRAINT "scan_events_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_events" ADD CONSTRAINT "scan_events_qr_code_id_fkey" FOREIGN KEY ("qr_code_id") REFERENCES "qr_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interaction_events" ADD CONSTRAINT "interaction_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interaction_events" ADD CONSTRAINT "interaction_events_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interaction_events" ADD CONSTRAINT "interaction_events_scan_event_id_fkey" FOREIGN KEY ("scan_event_id") REFERENCES "scan_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aggregated_metrics" ADD CONSTRAINT "aggregated_metrics_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aggregated_metrics" ADD CONSTRAINT "aggregated_metrics_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
