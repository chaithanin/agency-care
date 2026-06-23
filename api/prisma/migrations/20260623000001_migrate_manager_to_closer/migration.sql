-- Migrate existing manager users to closer (must be separate transaction from ADD VALUE)
UPDATE "users" SET role = 'closer'::"UserRole" WHERE role = 'manager'::"UserRole";
