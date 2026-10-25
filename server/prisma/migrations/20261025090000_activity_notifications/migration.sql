-- Activity and its notification commit together. No sample or historical activity is inserted.
BEGIN;
CREATE FUNCTION gora_emit_notification(recipient uuid, actor uuid, kind "NotificationType", context jsonb DEFAULT '{}') RETURNS void
LANGUAGE sql AS $$
  INSERT INTO "Notification" ("id","userId","actorId","type","gameId","postId","reelId","storyId","friendshipId","messageId","joinRequestId","badgeId")
  SELECT gen_random_uuid(), recipient, actor, kind,
    (context->>'gameId')::uuid, (context->>'postId')::uuid, (context->>'reelId')::uuid,
    (context->>'storyId')::uuid, (context->>'friendshipId')::uuid, (context->>'messageId')::uuid,
    (context->>'joinRequestId')::uuid, (context->>'badgeId')::uuid
  WHERE recipient IS NOT NULL AND recipient IS DISTINCT FROM actor
    AND EXISTS (SELECT 1 FROM "User" WHERE "id"=recipient AND "isActive")
    AND (actor IS NULL OR EXISTS (SELECT 1 FROM "User" WHERE "id"=actor AND "isActive"))
    AND NOT EXISTS (SELECT 1 FROM "Friendship" WHERE "status"='BLOCKED' AND
      (("requesterId"=recipient AND "receiverId"=actor) OR ("receiverId"=recipient AND "requesterId"=actor)));
$$;

CREATE FUNCTION gora_activity_notifications() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  row_data jsonb := to_jsonb(NEW);
  previous jsonb := '{}';
  recipient uuid;
  host_id uuid;
  context jsonb;
  kind "NotificationType";
BEGIN
  IF TG_OP='UPDATE' THEN previous := to_jsonb(OLD); END IF;
  CASE TG_TABLE_NAME
    WHEN 'JoinRequest' THEN
      IF previous->>'status' IS NOT DISTINCT FROM row_data->>'status' THEN RETURN NULL; END IF;
      SELECT "hostId" INTO host_id FROM "Game" WHERE "id"=NEW."gameId";
      context := jsonb_build_object('gameId',NEW."gameId",'joinRequestId',NEW."id");
      IF NEW."status"='PENDING' THEN
        PERFORM gora_emit_notification(host_id,NEW."userId",'GAME_JOIN_REQUEST',context);
      ELSIF NEW."status" IN ('ACCEPTED','REJECTED') THEN
        kind := CASE WHEN NEW."status"='ACCEPTED' THEN 'GAME_JOIN_ACCEPTED'::"NotificationType" ELSE 'GAME_JOIN_REJECTED'::"NotificationType" END;
        PERFORM gora_emit_notification(NEW."userId",host_id,kind,context);
      END IF;
    WHEN 'Friendship' THEN
      IF previous->>'status' IS NOT DISTINCT FROM row_data->>'status' THEN RETURN NULL; END IF;
      context := jsonb_build_object('friendshipId',NEW."id");
      IF NEW."status"='PENDING' THEN
        PERFORM gora_emit_notification(NEW."receiverId",NEW."requesterId",'FRIEND_REQUEST',context);
      ELSIF NEW."status"='ACCEPTED' THEN
        PERFORM gora_emit_notification(NEW."requesterId",NEW."receiverId",'FRIEND_ACCEPTED',context);
      END IF;
    WHEN 'UserFollow' THEN
      IF TG_OP='INSERT' THEN PERFORM gora_emit_notification(NEW."followingId",NEW."followerId",'NEW_FOLLOWER'); END IF;
    WHEN 'PostLike', 'PostComment' THEN
      IF TG_OP='INSERT' THEN
        SELECT "userId" INTO recipient FROM "Post" WHERE "id"=NEW."postId" AND "deletedAt" IS NULL;
        kind := CASE WHEN TG_TABLE_NAME='PostLike' THEN 'POST_LIKE'::"NotificationType" ELSE 'POST_COMMENT'::"NotificationType" END;
        PERFORM gora_emit_notification(recipient,NEW."userId",kind,jsonb_build_object('postId',NEW."postId"));
      END IF;
    WHEN 'ReelLike', 'ReelComment' THEN
      IF TG_OP='INSERT' THEN
        SELECT "userId" INTO recipient FROM "Reel" WHERE "id"=NEW."reelId" AND "deletedAt" IS NULL;
        kind := CASE WHEN TG_TABLE_NAME='ReelLike' THEN 'REEL_LIKE'::"NotificationType" ELSE 'REEL_COMMENT'::"NotificationType" END;
        PERFORM gora_emit_notification(recipient,NEW."userId",kind,jsonb_build_object('reelId',NEW."reelId"));
      END IF;
    WHEN 'Game' THEN
      IF previous->>'status' IS NOT DISTINCT FROM row_data->>'status' THEN RETURN NULL; END IF;
      context := jsonb_build_object('gameId',NEW."id");
      IF NEW."status"='FULL' THEN
        PERFORM gora_emit_notification(NEW."hostId",NULL,'GAME_FULL',context);
      ELSIF NEW."status" IN ('CANCELLED','COMPLETED') THEN
        kind := CASE WHEN NEW."status"='CANCELLED' THEN 'GAME_CANCELLED'::"NotificationType" ELSE 'GAME_COMPLETED'::"NotificationType" END;
        FOR recipient IN
          SELECT "userId" FROM "GameParticipant" WHERE "gameId"=NEW."id" AND "status" IN ('ACTIVE','COMPLETED')
          UNION SELECT "userId" FROM "JoinRequest" WHERE "gameId"=NEW."id" AND "status"='PENDING' AND NEW."status"='CANCELLED'
        LOOP PERFORM gora_emit_notification(recipient,NEW."hostId",kind,context); END LOOP;
      END IF;
    WHEN 'UserBadge' THEN
      IF NEW."unlocked" AND COALESCE((previous->>'unlocked')::boolean,false)=false THEN
        PERFORM gora_emit_notification(NEW."userId",NULL,'BADGE_UNLOCKED',jsonb_build_object('badgeId',NEW."badgeId"));
      END IF;
    WHEN 'MessageRequest' THEN
      IF NEW."status"='PENDING' AND previous->>'status' IS DISTINCT FROM 'PENDING' THEN
        PERFORM gora_emit_notification(NEW."receiverId",NEW."senderId",'MESSAGE_REQUEST');
      END IF;
    WHEN 'Message' THEN
      IF TG_OP='INSERT' AND NEW."deletedAt" IS NULL THEN
        context := jsonb_build_object('messageId',NEW."id");
        FOR recipient IN
          SELECT p."userId" FROM "ConversationParticipant" p JOIN "Conversation" c ON c."id"=p."conversationId"
            WHERE c."id"=NEW."conversationId" AND c."type"<>'CLUB'
              AND NOT EXISTS (SELECT 1 FROM "MessageRequest" r WHERE r."conversationId"=c."id" AND r."status"<>'ACCEPTED')
          UNION
          SELECT m."userId" FROM "ClubMember" m JOIN "Conversation" c ON c."clubId"=m."clubId"
            JOIN "Club" club ON club."id"=m."clubId" AND club."isActive"
            WHERE c."id"=NEW."conversationId" AND c."type"='CLUB' AND m."status"='ACTIVE'
        LOOP PERFORM gora_emit_notification(recipient,NEW."senderId",'NEW_MESSAGE',context); END LOOP;
      END IF;
    ELSE NULL;
  END CASE;
  RETURN NULL;
END;
$$;

DO $$ DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['JoinRequest','Friendship','UserFollow','PostLike','PostComment','ReelLike','ReelComment','Game','UserBadge','MessageRequest','Message']
  LOOP
    EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION gora_activity_notifications()',t || '_notifications',t);
  END LOOP;
END;
$$;

COMMIT;
