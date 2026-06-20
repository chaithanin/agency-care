-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'manager', 'sales');

-- CreateEnum
CREATE TYPE "AgencyLevel" AS ENUM ('A', 'B', 'C', 'D');

-- CreateEnum
CREATE TYPE "AgencyStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('pending', 'done', 'postponed', 'cancelled');

-- CreateEnum
CREATE TYPE "PhotoPhase" AS ENUM ('before', 'during', 'after');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('create', 'update', 'delete', 'login');

-- CreateEnum
CREATE TYPE "ModelStatus" AS ENUM ('in_stock', 'deployed', 'repair', 'lost');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'sales',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "zone" TEXT,
    "line_user_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agencies" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "level" "AgencyLevel" NOT NULL DEFAULT 'C',
    "status" "AgencyStatus" NOT NULL DEFAULT 'active',
    "province" TEXT,
    "zone" TEXT,
    "owner_name" TEXT,
    "manager_name" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "line_id" TEXT,
    "classification" TEXT,
    "grade_quality" TEXT,
    "grade_relationship" TEXT,
    "priority" TEXT,
    "source" TEXT,
    "tags" TEXT,
    "last_visit_at" TIMESTAMP(3),
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "geocode_source" TEXT,
    "photo_front" TEXT,
    "photo_inside" TEXT,
    "logo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agency_assignments" (
    "id" TEXT NOT NULL,
    "agency_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agency_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visit_plans" (
    "id" TEXT NOT NULL,
    "agency_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "plan_date" DATE NOT NULL,
    "status" "VisitStatus" NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visit_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visit_checkins" (
    "id" TEXT NOT NULL,
    "visit_plan_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "checkin_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "distance_meters" INTEGER NOT NULL,
    "within_radius" BOOLEAN NOT NULL,

    CONSTRAINT "visit_checkins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visit_photos" (
    "id" TEXT NOT NULL,
    "checkin_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "phase" "PhotoPhase" NOT NULL DEFAULT 'during',
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "taken_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visit_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visit_reports" (
    "id" TEXT NOT NULL,
    "visit_plan_id" TEXT NOT NULL,
    "purposes" TEXT[],
    "summary" TEXT,
    "problems" TEXT,
    "action_plan" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visit_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posm_items" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'ชิ้น',
    "stock_qty" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "posm_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posm_transactions" (
    "id" TEXT NOT NULL,
    "visit_plan_id" TEXT NOT NULL,
    "posm_item_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "posm_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_activities" (
    "id" TEXT NOT NULL,
    "visit_plan_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "qty_offered" INTEGER NOT NULL DEFAULT 0,
    "qty_sold" INTEGER NOT NULL DEFAULT 0,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "models" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "status" "ModelStatus" NOT NULL DEFAULT 'in_stock',
    "current_agency_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_transactions" (
    "id" TEXT NOT NULL,
    "model_id" TEXT NOT NULL,
    "agency_id" TEXT,
    "visit_plan_id" TEXT,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" "AuditAction" NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "employees_user_id_key" ON "employees"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "employees_code_key" ON "employees"("code");

-- CreateIndex
CREATE INDEX "employees_zone_idx" ON "employees"("zone");

-- CreateIndex
CREATE UNIQUE INDEX "agencies_code_key" ON "agencies"("code");

-- CreateIndex
CREATE INDEX "agencies_zone_idx" ON "agencies"("zone");

-- CreateIndex
CREATE INDEX "agencies_province_idx" ON "agencies"("province");

-- CreateIndex
CREATE INDEX "agencies_status_idx" ON "agencies"("status");

-- CreateIndex
CREATE INDEX "agency_assignments_employee_id_idx" ON "agency_assignments"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "agency_assignments_agency_id_employee_id_key" ON "agency_assignments"("agency_id", "employee_id");

-- CreateIndex
CREATE INDEX "visit_plans_employee_id_plan_date_idx" ON "visit_plans"("employee_id", "plan_date");

-- CreateIndex
CREATE INDEX "visit_plans_agency_id_plan_date_idx" ON "visit_plans"("agency_id", "plan_date");

-- CreateIndex
CREATE INDEX "visit_plans_plan_date_status_idx" ON "visit_plans"("plan_date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "visit_checkins_visit_plan_id_key" ON "visit_checkins"("visit_plan_id");

-- CreateIndex
CREATE INDEX "visit_checkins_employee_id_checkin_at_idx" ON "visit_checkins"("employee_id", "checkin_at");

-- CreateIndex
CREATE INDEX "visit_photos_checkin_id_idx" ON "visit_photos"("checkin_id");

-- CreateIndex
CREATE UNIQUE INDEX "visit_reports_visit_plan_id_key" ON "visit_reports"("visit_plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "posm_items_code_key" ON "posm_items"("code");

-- CreateIndex
CREATE INDEX "posm_transactions_visit_plan_id_idx" ON "posm_transactions"("visit_plan_id");

-- CreateIndex
CREATE INDEX "posm_transactions_posm_item_id_idx" ON "posm_transactions"("posm_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_code_key" ON "products"("code");

-- CreateIndex
CREATE INDEX "sales_activities_visit_plan_id_idx" ON "sales_activities"("visit_plan_id");

-- CreateIndex
CREATE INDEX "sales_activities_product_id_idx" ON "sales_activities"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "models_code_key" ON "models"("code");

-- CreateIndex
CREATE INDEX "models_status_idx" ON "models"("status");

-- CreateIndex
CREATE INDEX "models_current_agency_id_idx" ON "models"("current_agency_id");

-- CreateIndex
CREATE INDEX "model_transactions_model_id_idx" ON "model_transactions"("model_id");

-- CreateIndex
CREATE INDEX "model_transactions_agency_id_idx" ON "model_transactions"("agency_id");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_idx" ON "audit_logs"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entity_id_idx" ON "audit_logs"("entity", "entity_id");

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_assignments" ADD CONSTRAINT "agency_assignments_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agency_assignments" ADD CONSTRAINT "agency_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_plans" ADD CONSTRAINT "visit_plans_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_plans" ADD CONSTRAINT "visit_plans_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_checkins" ADD CONSTRAINT "visit_checkins_visit_plan_id_fkey" FOREIGN KEY ("visit_plan_id") REFERENCES "visit_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_checkins" ADD CONSTRAINT "visit_checkins_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_photos" ADD CONSTRAINT "visit_photos_checkin_id_fkey" FOREIGN KEY ("checkin_id") REFERENCES "visit_checkins"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visit_reports" ADD CONSTRAINT "visit_reports_visit_plan_id_fkey" FOREIGN KEY ("visit_plan_id") REFERENCES "visit_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posm_transactions" ADD CONSTRAINT "posm_transactions_visit_plan_id_fkey" FOREIGN KEY ("visit_plan_id") REFERENCES "visit_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posm_transactions" ADD CONSTRAINT "posm_transactions_posm_item_id_fkey" FOREIGN KEY ("posm_item_id") REFERENCES "posm_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_activities" ADD CONSTRAINT "sales_activities_visit_plan_id_fkey" FOREIGN KEY ("visit_plan_id") REFERENCES "visit_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_activities" ADD CONSTRAINT "sales_activities_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "models" ADD CONSTRAINT "models_current_agency_id_fkey" FOREIGN KEY ("current_agency_id") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_transactions" ADD CONSTRAINT "model_transactions_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "models"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_transactions" ADD CONSTRAINT "model_transactions_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_transactions" ADD CONSTRAINT "model_transactions_visit_plan_id_fkey" FOREIGN KEY ("visit_plan_id") REFERENCES "visit_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

