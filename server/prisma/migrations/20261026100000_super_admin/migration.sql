ALTER TYPE "UserRole" ADD VALUE 'SUPER_ADMIN';

CREATE TABLE "AdminAuditLog" (
  "id" UUID NOT NULL,
  "actorId" UUID NOT NULL,
  "action" TEXT NOT NULL,
  "targetId" UUID NOT NULL,
  "details" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT timezone('UTC', now()),
  CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AdminAuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");
