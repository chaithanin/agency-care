-- Add new enum values
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'impersonate';

-- Add super_admin to UserRole enum
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'super_admin';

-- Add activeRole column (defaults to each user's current role)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "active_role" "UserRole" NOT NULL DEFAULT 'sales';
UPDATE "users" SET "active_role" = "role";

-- Add additionalRoles column
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "additional_roles" TEXT[] NOT NULL DEFAULT '{}';
