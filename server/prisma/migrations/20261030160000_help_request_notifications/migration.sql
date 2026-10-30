ALTER TYPE "NotificationType" ADD VALUE 'HELP_REQUEST_RECEIVED';
ALTER TYPE "NotificationType" ADD VALUE 'HELP_REQUEST_UPDATED';

ALTER TABLE "Notification"
  ADD COLUMN "reportId" UUID,
  ADD COLUMN "reportStatus" "ReportStatus";

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_reportId_fkey"
  FOREIGN KEY ("reportId") REFERENCES "Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "Notification_reportId_idx" ON "Notification"("reportId");
