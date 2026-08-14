-- AlterEnum
ALTER TYPE "RoleType" ADD VALUE 'PLATFORM_ADMIN';

-- AlterTable
ALTER TABLE "role_assignments" ALTER COLUMN "tenant_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "tenant_id" DROP NOT NULL;
