// Development stages: how the mentor adapts tone, guidance and challenge
// difficulty to a skill's current score. Guidance ranges, not labels — the
// mentor always combines them with real evidence about the person.

export type StageKey = "foundation" | "beginner" | "developing" | "improving" | "advanced";

export interface Stage {
  key: StageKey;
  name: string;
  min: number; // inclusive
  max: number; // inclusive
  /** Challenge difficulty (1–5) that fits this stage when there's no history yet. */
  baseDifficulty: number;
  /** How the mentor should coach at this stage (sent to the AI). */
  guidance: string;
}

export const STAGES: Stage[] = [
  {
    key: "foundation",
    name: "Foundation",
    min: 0,
    max: 20,
    baseDifficulty: 1,
    guidance:
      "Be supportive and patient. Find the main difficulty with simple questions. Give very small, achievable actions focused on getting past the first barrier. Never overwhelm.",
  },
  {
    key: "beginner",
    name: "Beginner",
    min: 21,
    max: 40,
    baseDifficulty: 2,
    guidance:
      "Pin down specific weaknesses and build consistency. Give guided real-world tasks with clear steps and example words. Raise difficulty gradually. Explain how to approach hard moments.",
  },
  {
    key: "developing",
    name: "Developing",
    min: 41,
    max: 60,
    baseDifficulty: 3,
    guidance:
      "Work on individual subskills. Use moderately challenging situations. Encourage the person to make their own decisions and point out repeated patterns.",
  },
  {
    key: "improving",
    name: "Improving",
    min: 61,
    max: 80,
    baseDifficulty: 4,
    guidance:
      "Use complex real-life situations. Focus on consistency and adaptability, push beyond familiar settings, and keep hand-holding to a minimum.",
  },
  {
    key: "advanced",
    name: "Advanced",
    min: 81,
    max: 100,
    baseDifficulty: 5,
    guidance:
      "Give complex, unfamiliar, high-responsibility challenges focused on mastery, leadership and independent application. Never repeat beginner-level tasks.",
  },
];

export function stageForScore(score: number | null | undefined): Stage {
  const s = Math.max(0, Math.min(100, Math.round(score ?? 40)));
  return STAGES.find((st) => s <= st.max) ?? STAGES[STAGES.length - 1];
}
