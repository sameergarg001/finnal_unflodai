-- AlterTable
ALTER TABLE "AiAnalysis" ADD COLUMN "dimensions" JSONB;
ALTER TABLE "AiAnalysis" ADD COLUMN "performance" REAL;
ALTER TABLE "AiAnalysis" ADD COLUMN "reviewNote" TEXT;
ALTER TABLE "AiAnalysis" ADD COLUMN "reviewedAt" DATETIME;
ALTER TABLE "AiAnalysis" ADD COLUMN "tier" TEXT;

-- AlterTable
ALTER TABLE "Challenge" ADD COLUMN "alternative" TEXT;
ALTER TABLE "Challenge" ADD COLUMN "feedbackQuestions" JSONB;
ALTER TABLE "Challenge" ADD COLUMN "targetInsightId" TEXT;

-- AlterTable
ALTER TABLE "SkillScore" ADD COLUMN "baselineScore" REAL;

-- CreateTable
CREATE TABLE "SubskillScore" (
    "userId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "subskill" TEXT NOT NULL,
    "score" REAL NOT NULL,
    "baseline" REAL NOT NULL,
    "evidenceCount" INTEGER NOT NULL DEFAULT 0,
    "confidence" REAL NOT NULL DEFAULT 0.2,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("userId", "skillId", "subskill")
);

-- CreateTable
CREATE TABLE "UserSituation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "skillId" TEXT,
    "conversationId" TEXT,
    "summary" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserSituation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SkillScoreEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "delta" REAL NOT NULL,
    "previousScore" REAL,
    "newScore" REAL NOT NULL,
    "source" TEXT NOT NULL,
    "sourceId" TEXT,
    "reason" TEXT,
    "evidence" JSONB,
    "subskill" TEXT NOT NULL DEFAULT '',
    "confidence" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SkillScoreEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SkillScoreEvent_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_SkillScoreEvent" ("createdAt", "delta", "evidence", "id", "newScore", "previousScore", "reason", "skillId", "source", "sourceId", "userId") SELECT "createdAt", "delta", "evidence", "id", "newScore", "previousScore", "reason", "skillId", "source", "sourceId", "userId" FROM "SkillScoreEvent";
DROP TABLE "SkillScoreEvent";
ALTER TABLE "new_SkillScoreEvent" RENAME TO "SkillScoreEvent";
CREATE INDEX "SkillScoreEvent_userId_skillId_createdAt_idx" ON "SkillScoreEvent"("userId", "skillId", "createdAt");
CREATE UNIQUE INDEX "SkillScoreEvent_source_sourceId_skillId_subskill_key" ON "SkillScoreEvent"("source", "sourceId", "skillId", "subskill");
CREATE TABLE "new_UserInsight" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "skillId" TEXT,
    "kind" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "strength" REAL NOT NULL DEFAULT 0.5,
    "subskill" TEXT,
    "evidence" JSONB,
    "situations" JSONB,
    "count" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'hypothesis',
    "confidence" REAL NOT NULL DEFAULT 0.3,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserInsight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserInsight_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_UserInsight" ("createdAt", "id", "kind", "lastSeenAt", "skillId", "strength", "text", "userId") SELECT "createdAt", "id", "kind", "lastSeenAt", "skillId", "strength", "text", "userId" FROM "UserInsight";
DROP TABLE "UserInsight";
ALTER TABLE "new_UserInsight" RENAME TO "UserInsight";
CREATE INDEX "UserInsight_userId_skillId_idx" ON "UserInsight"("userId", "skillId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "UserSituation_userId_lastSeenAt_idx" ON "UserSituation"("userId", "lastSeenAt");

-- Backfill: the baseline is the user's first self-assessment (never overwritten afterwards).
UPDATE "SkillScore" SET "baselineScore" = (
  SELECT e."newScore" FROM "SkillScoreEvent" e
  WHERE e."userId" = "SkillScore"."userId" AND e."skillId" = "SkillScore"."skillId" AND e."source" = 'assessment'
  ORDER BY e."createdAt" ASC LIMIT 1
) WHERE "baselineScore" IS NULL;
UPDATE "SkillScore" SET "baselineScore" = "selfScore" WHERE "baselineScore" IS NULL;
-- Existing memory items become early guesses until new evidence confirms them.
UPDATE "UserInsight" SET "status" = 'hypothesis' WHERE "status" IS NULL;
