-- AlterEnum
ALTER TYPE "InteractionType" ADD VALUE 'DIETARY_FILTER_APPLIED';
ALTER TYPE "InteractionType" ADD VALUE 'SEARCH_APPLIED';
ALTER TYPE "InteractionType" ADD VALUE 'SESSION_DWELL';

-- AlterTable
ALTER TABLE "interaction_events" ADD COLUMN "payload" JSONB;

-- CreateIndex
CREATE UNIQUE INDEX "scan_events_tenant_id_branch_id_session_id_key" ON "scan_events"("tenant_id", "branch_id", "session_id");
