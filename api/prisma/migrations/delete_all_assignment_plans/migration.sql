-- Delete all assignment plans (safely)
DELETE FROM "assignment_plan" WHERE id IS NOT NULL;
