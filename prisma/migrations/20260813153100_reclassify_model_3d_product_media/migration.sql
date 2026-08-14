-- Los .glb/.usdz que habían quedado como PRIMARY o GALLERY pasan a AR_MODEL
-- para no mezclarlos con la imagen 2D de listado.
UPDATE "product_media" AS pm
SET "role" = 'AR_MODEL'
FROM "media_assets" AS ma
WHERE pm."media_asset_id" = ma."id"
  AND ma."file_type" = 'MODEL_3D'
  AND pm."role" IN ('PRIMARY', 'GALLERY');
