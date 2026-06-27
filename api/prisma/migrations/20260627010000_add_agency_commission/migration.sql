-- CreateTable
CREATE TABLE "agency_commissions" (
    "id" TEXT NOT NULL,
    "agency_id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'commission',
    "amount" DECIMAL(12,2) NOT NULL,
    "period_date" DATE NOT NULL,
    "description" TEXT,
    "recorded_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agency_commissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agency_commissions_agency_id_idx" ON "agency_commissions"("agency_id");

-- CreateIndex
CREATE INDEX "agency_commissions_period_date_idx" ON "agency_commissions"("period_date");

-- AddForeignKey
ALTER TABLE "agency_commissions" ADD CONSTRAINT "agency_commissions_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
