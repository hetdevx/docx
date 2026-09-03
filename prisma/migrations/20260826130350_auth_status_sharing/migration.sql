-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "is_public" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN     "status_reason" TEXT;

-- AlterTable (temporary default backfills existing rows; real hashes set by prisma db seed)
ALTER TABLE "users" ADD COLUMN     "password_hash" TEXT NOT NULL DEFAULT '';
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP DEFAULT;
