-- Data: Problem-solving and Adaptability are no longer core skills (Time management is).
-- Remove them from users' dashboards unless the user already worked on them (history is kept).
UPDATE "UserSkill" SET "isActive" = false, "removedAt" = CURRENT_TIMESTAMP
WHERE "skillId" IN (SELECT "id" FROM "Skill" WHERE "slug" IN ('problem-solving', 'adaptability'))
  AND NOT EXISTS (
    SELECT 1 FROM "Challenge" c
    WHERE c."userId" = "UserSkill"."userId" AND c."skillId" = "UserSkill"."skillId" AND c."status" IN ('active', 'done', 'abandoned')
  );
