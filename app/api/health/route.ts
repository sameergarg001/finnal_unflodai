import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAiProvider } from "@/ai/client";

export const dynamic = "force-dynamic";

/** GET /api/health — checks database and AI configuration. */
export async function GET() {
  let database: string;
  let skills = 0;
  try {
    skills = await db.skill.count();
    database = "ok";
  } catch (e) {
    database = `error: ${(e as Error).message.split("\n")[0]}`;
  }

  const ai = getAiProvider();
  return NextResponse.json({
    database,
    skills,
    ai: ai ? `configured (${ai.name})` : "not configured — set GEMINI_API_KEY in .env",
  });
}
