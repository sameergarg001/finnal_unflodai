-- AlterTable
ALTER TABLE "AiAnalysis" ADD COLUMN "report" JSONB;

-- AlterTable
ALTER TABLE "SkillScoreEvent" ADD COLUMN "evidence" JSONB;
ALTER TABLE "SkillScoreEvent" ADD COLUMN "previousScore" REAL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "age" INTEGER;
ALTER TABLE "User" ADD COLUMN "googleId" TEXT;
ALTER TABLE "User" ADD COLUMN "image" TEXT;

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "phase" TEXT NOT NULL DEFAULT 'understanding',
    "summary" TEXT,
    "context" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Conversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Conversation_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConversationMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'text',
    "content" TEXT NOT NULL,
    "challengeId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConversationMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Challenge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "conversationId" TEXT,
    "situation" TEXT,
    "struggle" TEXT,
    "previousId" TEXT,
    "stepNumber" INTEGER NOT NULL DEFAULT 1,
    "subskill" TEXT,
    "title" TEXT NOT NULL,
    "objective" TEXT,
    "instructions" TEXT NOT NULL,
    "steps" JSONB,
    "expectedOutcome" TEXT,
    "example" TEXT,
    "feedbackInstructions" TEXT,
    "successCriteria" JSONB NOT NULL,
    "whyThisChallenge" TEXT,
    "difficulty" INTEGER NOT NULL,
    "estimatedMinutes" INTEGER NOT NULL DEFAULT 15,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" DATETIME,
    "dueAt" DATETIME,
    "completedAt" DATETIME,
    "generationContext" JSONB,
    "modelVersion" TEXT,
    CONSTRAINT "Challenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Challenge_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Challenge_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Challenge_previousId_fkey" FOREIGN KEY ("previousId") REFERENCES "Challenge" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Challenge" ("assignedAt", "completedAt", "difficulty", "dueAt", "estimatedMinutes", "generationContext", "id", "instructions", "modelVersion", "previousId", "situation", "skillId", "status", "stepNumber", "successCriteria", "title", "userId", "whyThisChallenge") SELECT "assignedAt", "completedAt", "difficulty", "dueAt", "estimatedMinutes", "generationContext", "id", "instructions", "modelVersion", "previousId", "situation", "skillId", "status", "stepNumber", "successCriteria", "title", "userId", "whyThisChallenge" FROM "Challenge";
DROP TABLE "Challenge";
ALTER TABLE "new_Challenge" RENAME TO "Challenge";
CREATE INDEX "Challenge_userId_status_idx" ON "Challenge"("userId", "status");
CREATE INDEX "Challenge_userId_skillId_assignedAt_idx" ON "Challenge"("userId", "skillId", "assignedAt");
CREATE TABLE "new_Reflection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "challengeId" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL,
    "completionStatus" TEXT NOT NULL DEFAULT 'completed',
    "responses" JSONB,
    "selfRating" INTEGER,
    "perceivedDifficulty" INTEGER,
    "whatHappened" TEXT NOT NULL,
    "whatWasHard" TEXT,
    "whatLearned" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Reflection_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Reflection" ("challengeId", "completed", "createdAt", "id", "perceivedDifficulty", "selfRating", "whatHappened", "whatLearned", "whatWasHard") SELECT "challengeId", "completed", "createdAt", "id", "perceivedDifficulty", "selfRating", "whatHappened", "whatLearned", "whatWasHard" FROM "Reflection";
DROP TABLE "Reflection";
ALTER TABLE "new_Reflection" RENAME TO "Reflection";
CREATE UNIQUE INDEX "Reflection_challengeId_key" ON "Reflection"("challengeId");
CREATE TABLE "new_Skill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "rubric" JSONB NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "ownerId" TEXT,
    CONSTRAINT "Skill_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Skill" ("category", "description", "id", "name", "rubric", "slug", "sortOrder") SELECT "category", "description", "id", "name", "rubric", "slug", "sortOrder" FROM "Skill";
DROP TABLE "Skill";
ALTER TABLE "new_Skill" RENAME TO "Skill";
CREATE UNIQUE INDEX "Skill_slug_key" ON "Skill"("slug");
CREATE TABLE "new_SkillScore" (
    "userId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "score" REAL NOT NULL,
    "selfScore" REAL,
    "evidenceCount" INTEGER NOT NULL DEFAULT 0,
    "confidence" REAL NOT NULL DEFAULT 0.2,
    "difficulty" INTEGER NOT NULL DEFAULT 2,
    "startingLevel" INTEGER,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("userId", "skillId"),
    CONSTRAINT "SkillScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SkillScore_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_SkillScore" ("confidence", "difficulty", "score", "skillId", "startingLevel", "updatedAt", "userId") SELECT "confidence", "difficulty", "score", "skillId", "startingLevel", "updatedAt", "userId" FROM "SkillScore";
DROP TABLE "SkillScore";
ALTER TABLE "new_SkillScore" RENAME TO "SkillScore";
CREATE TABLE "new_UserProfile" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "occupation" TEXT,
    "goals" TEXT,
    "about" TEXT,
    "context" JSONB,
    "onboardingDone" BOOLEAN NOT NULL DEFAULT false,
    "assessmentDone" BOOLEAN NOT NULL DEFAULT false,
    "preferences" JSONB,
    "notificationsSeenAt" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_UserProfile" ("context", "goals", "occupation", "onboardingDone", "updatedAt", "userId") SELECT "context", "goals", "occupation", "onboardingDone", "updatedAt", "userId" FROM "UserProfile";
DROP TABLE "UserProfile";
ALTER TABLE "new_UserProfile" RENAME TO "UserProfile";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Conversation_userId_skillId_updatedAt_idx" ON "Conversation"("userId", "skillId", "updatedAt");

-- CreateIndex
CREATE INDEX "ConversationMessage_conversationId_createdAt_idx" ON "ConversationMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");


-- Data: map old step statuses to the new challenge lifecycle.
UPDATE "Challenge" SET "status" = 'active', "acceptedAt" = "assignedAt" WHERE "status" = 'assigned';
UPDATE "Challenge" SET "status" = 'done', "acceptedAt" = "assignedAt" WHERE "status" IN ('completed', 'skipped') AND "id" IN (SELECT "challengeId" FROM "Reflection");
UPDATE "Challenge" SET "status" = 'abandoned', "acceptedAt" = "assignedAt" WHERE "status" IN ('skipped', 'expired');
UPDATE "Reflection" SET "completionStatus" = CASE WHEN "completed" THEN 'completed' ELSE 'unsuccessful' END;
-- Old scores count as previous evidence; previous score is derivable from the ledger.
UPDATE "SkillScoreEvent" SET "previousScore" = "newScore" - "delta";
UPDATE "SkillScore" SET "evidenceCount" = (SELECT COUNT(*) FROM "SkillScoreEvent" e WHERE e."userId" = "SkillScore"."userId" AND e."skillId" = "SkillScore"."skillId" AND e."source" = 'challenge');
