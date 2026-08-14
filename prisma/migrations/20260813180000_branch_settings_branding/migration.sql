-- AlterTable
ALTER TABLE "branches" ADD COLUMN "instagram" TEXT;
ALTER TABLE "branches" ADD COLUMN "banner_media_asset_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "branches_banner_media_asset_id_key" ON "branches"("banner_media_asset_id");

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_banner_media_asset_id_fkey" FOREIGN KEY ("banner_media_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
