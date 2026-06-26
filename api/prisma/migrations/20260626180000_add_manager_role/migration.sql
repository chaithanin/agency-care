-- Add 'manager' value to UserRole enum (must be done before the existing values)
-- PostgreSQL requires adding enum values in a transaction-safe way
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'manager' BEFORE 'super_admin';
