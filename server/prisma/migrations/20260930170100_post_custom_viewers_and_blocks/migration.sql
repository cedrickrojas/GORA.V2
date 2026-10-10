-- AlterTable
ALTER TABLE "Friendship" ADD COLUMN     "blockedById" UUID;

-- CreateTable
CREATE TABLE "PostCustomViewer" (
    "id" UUID NOT NULL,
    "postId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostCustomViewer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PostCustomViewer_postId_idx" ON "PostCustomViewer"("postId");

-- CreateIndex
CREATE INDEX "PostCustomViewer_userId_idx" ON "PostCustomViewer"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PostCustomViewer_postId_userId_key" ON "PostCustomViewer"("postId", "userId");

-- CreateIndex
CREATE INDEX "Friendship_blockedById_idx" ON "Friendship"("blockedById");

-- CreateIndex
CREATE INDEX "Post_visibility_idx" ON "Post"("visibility");

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_blockedById_fkey" FOREIGN KEY ("blockedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostCustomViewer" ADD CONSTRAINT "PostCustomViewer_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostCustomViewer" ADD CONSTRAINT "PostCustomViewer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A BLOCKED friendship records who blocked (one of the two users); no other status may carry a blocker.
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_blocked_by_check" CHECK (
  ("status" = 'BLOCKED') = ("blockedById" IS NOT NULL)
  AND ("blockedById" IS NULL OR "blockedById" = "requesterId" OR "blockedById" = "receiverId")
);

-- The author always sees their own post, so they are never stored as a custom viewer.
CREATE FUNCTION "post_custom_viewer_not_author"() RETURNS trigger AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Post" WHERE "id" = NEW."postId" AND "userId" = NEW."userId") THEN
    RAISE EXCEPTION 'A post author cannot be a custom viewer of their own post'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PostCustomViewer_not_author"
  BEFORE INSERT OR UPDATE ON "PostCustomViewer"
  FOR EACH ROW EXECUTE FUNCTION "post_custom_viewer_not_author"();
