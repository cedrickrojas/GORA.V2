CREATE TYPE "PostFeedback" AS ENUM ('INTERESTED', 'NOT_INTERESTED');

CREATE TABLE "PostPreference" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "postId" UUID NOT NULL,
    "feedback" "PostFeedback",
    "savedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PostPreference_userId_postId_key" ON "PostPreference"("userId", "postId");
CREATE INDEX "PostPreference_userId_savedAt_idx" ON "PostPreference"("userId", "savedAt");
CREATE INDEX "PostPreference_postId_feedback_idx" ON "PostPreference"("postId", "feedback");

ALTER TABLE "PostPreference" ADD CONSTRAINT "PostPreference_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostPreference" ADD CONSTRAINT "PostPreference_postId_fkey"
  FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
