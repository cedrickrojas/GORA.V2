-- Preserve the already-applied activity migration while making trigger timestamps
-- independent of the database session's timezone (Prisma stores UTC timestamps).
CREATE OR REPLACE FUNCTION gora_emit_notification(recipient uuid, actor uuid, kind "NotificationType", context jsonb DEFAULT '{}') RETURNS void
LANGUAGE sql AS $$
  INSERT INTO "Notification" ("id","userId","actorId","type","gameId","postId","reelId","storyId","friendshipId","messageId","joinRequestId","badgeId","createdAt")
  SELECT gen_random_uuid(), recipient, actor, kind,
    (context->>'gameId')::uuid, (context->>'postId')::uuid, (context->>'reelId')::uuid,
    (context->>'storyId')::uuid, (context->>'friendshipId')::uuid, (context->>'messageId')::uuid,
    (context->>'joinRequestId')::uuid, (context->>'badgeId')::uuid, timezone('UTC', now())
  WHERE recipient IS NOT NULL AND recipient IS DISTINCT FROM actor
    AND EXISTS (SELECT 1 FROM "User" WHERE "id"=recipient AND "isActive")
    AND (actor IS NULL OR EXISTS (SELECT 1 FROM "User" WHERE "id"=actor AND "isActive"))
    AND NOT EXISTS (SELECT 1 FROM "Friendship" WHERE "status"='BLOCKED' AND
      (("requesterId"=recipient AND "receiverId"=actor) OR ("receiverId"=recipient AND "requesterId"=actor)));
$$;
