-- ROOT is a studio-wide account (tenantId NULL). Staff stay scoped to a tenant.
ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_role_studio_check";

ALTER TABLE "User" ADD CONSTRAINT "User_role_studio_check" CHECK (
  ("role" = 'ROOT' AND "tenantId" IS NULL)
  OR
  ("role" IN ('ADMIN', 'OPERATOR') AND "tenantId" IS NOT NULL)
);
