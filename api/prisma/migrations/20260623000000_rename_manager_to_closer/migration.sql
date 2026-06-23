-- Add 'closer' value to UserRole enum
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'closer';

-- Migrate existing manager users to closer
UPDATE "User" SET role = 'closer'::"UserRole" WHERE role = 'manager'::"UserRole";
