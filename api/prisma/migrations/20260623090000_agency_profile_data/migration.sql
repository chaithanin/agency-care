-- Agency Information Form structured data
ALTER TABLE "agencies" ADD COLUMN IF NOT EXISTS "profile_data" JSONB;
