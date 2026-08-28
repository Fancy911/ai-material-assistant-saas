CREATE TYPE "TenantActivationStatus" AS ENUM ('UNUSED', 'ACTIVATED', 'REVOKED');

ALTER TABLE "Tenant" ADD COLUMN "publicCode" TEXT;
UPDATE "Tenant" SET "publicCode" = CASE "id"
  WHEN 'tenant-demo-a' THEN 'baoxiaoyin'
  WHEN 'tenant-demo-b' THEN 'demo-b'
  ELSE 'tenant-' || "id"
END;
ALTER TABLE "Tenant" ALTER COLUMN "publicCode" SET NOT NULL;
CREATE UNIQUE INDEX "Tenant_publicCode_key" ON "Tenant"("publicCode");

CREATE TABLE "TenantActivationCode" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "codeHint" TEXT NOT NULL,
  "status" "TenantActivationStatus" NOT NULL DEFAULT 'UNUSED',
  "createdById" TEXT NOT NULL,
  "activatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "activatedAt" TIMESTAMP(3),
  CONSTRAINT "TenantActivationCode_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TenantActivationCode_codeHash_key" ON "TenantActivationCode"("codeHash");
CREATE INDEX "TenantActivationCode_tenantId_status_createdAt_idx" ON "TenantActivationCode"("tenantId", "status", "createdAt");
ALTER TABLE "TenantActivationCode" ADD CONSTRAINT "TenantActivationCode_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
