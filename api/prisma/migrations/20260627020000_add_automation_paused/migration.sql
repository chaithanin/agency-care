-- AlterTable: add automation_paused to agencies
ALTER TABLE "agencies" ADD COLUMN "automation_paused" BOOLEAN NOT NULL DEFAULT false;
