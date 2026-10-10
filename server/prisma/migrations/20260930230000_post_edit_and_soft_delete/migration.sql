-- Edit Post and Delete Post. Both columns are nullable, so existing posts are untouched:
-- they stay visible (deletedAt NULL) and unedited (editedAt NULL). Nothing is dropped.
ALTER TABLE "Post" ADD COLUMN "editedAt" TIMESTAMP(3);
ALTER TABLE "Post" ADD COLUMN "deletedAt" TIMESTAMP(3);
