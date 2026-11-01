// Canonical skill catalog. Seeded into the `Skill` table.
// Each skill has 3 rubric dimensions used by assessment scoring and AI analysis.

export type SkillCategory = "core" | "specific";

// `type` (not `interface`) so it is assignable to Prisma's JSON input type.
export type RubricDimension = {
  key: string;
  label: string;
};

export interface SkillDefinition {
  slug: string;
  name: string;
  category: SkillCategory;
  description: string;
  rubric: RubricDimension[];
}

const d = (key: string, label: string): RubricDimension => ({ key, label });

export const CORE_SKILLS: SkillDefinition[] = [
  {
    slug: "communication",
    name: "Communication",
    category: "core",
    description: "Expressing ideas clearly and adapting the message to the listener.",
    rubric: [d("clarity", "Clarity"), d("adaptation", "Audience adaptation"), d("listening", "Two-way exchange")],
  },
  {
    slug: "confidence",
    name: "Confidence",
    category: "core",
    description: "Acting despite uncertainty and trusting your own judgement.",
    rubric: [d("initiative", "Taking initiative"), d("self_trust", "Self-trust"), d("recovery", "Recovering from setbacks")],
  },
  {
    slug: "critical-thinking",
    name: "Critical Thinking",
    category: "core",
    description: "Questioning assumptions and evaluating evidence before concluding.",
    rubric: [d("assumptions", "Questioning assumptions"), d("evidence", "Weighing evidence"), d("perspectives", "Considering perspectives")],
  },
  {
    slug: "problem-solving",
    name: "Problem Solving",
    category: "core",
    description: "Breaking problems down and working systematically toward solutions.",
    rubric: [d("framing", "Framing the problem"), d("options", "Generating options"), d("execution", "Testing and iterating")],
  },
  {
    slug: "decision-making",
    name: "Decision Making",
    category: "core",
    description: "Choosing well and in time, with incomplete information.",
    rubric: [d("criteria", "Clear criteria"), d("timeliness", "Deciding in time"), d("ownership", "Owning outcomes")],
  },
  {
    slug: "emotional-intelligence",
    name: "Emotional Intelligence",
    category: "core",
    description: "Recognising and managing your emotions and responding to others'.",
    rubric: [d("self_awareness", "Self-awareness"), d("regulation", "Self-regulation"), d("empathy", "Empathy")],
  },
  {
    slug: "self-discipline",
    name: "Self-Discipline",
    category: "core",
    description: "Doing what matters consistently, even when you don't feel like it.",
    rubric: [d("consistency", "Consistency"), d("impulse_control", "Resisting distractions"), d("follow_through", "Follow-through")],
  },
  {
    slug: "time-management",
    name: "Time Management",
    category: "core",
    description: "Prioritising and planning so time goes to what matters most.",
    rubric: [d("prioritisation", "Prioritisation"), d("planning", "Planning"), d("estimation", "Realistic estimation")],
  },
  {
    slug: "adaptability",
    name: "Adaptability",
    category: "core",
    description: "Adjusting quickly and calmly when plans or circumstances change.",
    rubric: [d("openness", "Openness to change"), d("composure", "Composure"), d("adjustment", "Adjusting approach")],
  },
  {
    slug: "learning-ability",
    name: "Learning Ability",
    category: "core",
    description: "Picking up new knowledge and skills efficiently and applying them.",
    rubric: [d("curiosity", "Curiosity"), d("method", "Learning method"), d("application", "Applying what was learned")],
  },
  {
    slug: "creativity",
    name: "Creativity",
    category: "core",
    description: "Generating original ideas and new approaches to familiar things.",
    rubric: [d("fluency", "Idea generation"), d("originality", "Originality"), d("experimentation", "Willingness to experiment")],
  },
  {
    slug: "relationship-building",
    name: "Relationship Building",
    category: "core",
    description: "Building trust and maintaining meaningful connections with people.",
    rubric: [d("trust", "Building trust"), d("maintenance", "Staying in touch"), d("reciprocity", "Giving value")],
  },
];

export const SPECIFIC_SKILLS: SkillDefinition[] = [
  {
    slug: "public-speaking",
    name: "Public Speaking",
    category: "specific",
    description: "Speaking to groups with structure, presence and impact.",
    rubric: [d("structure", "Structure"), d("delivery", "Delivery"), d("presence", "Stage presence")],
  },
  {
    slug: "networking",
    name: "Networking",
    category: "specific",
    description: "Starting and growing professional relationships.",
    rubric: [d("outreach", "Outreach"), d("conversation", "Conversation quality"), d("follow_up", "Follow-up")],
  },
  {
    slug: "leadership",
    name: "Leadership",
    category: "specific",
    description: "Setting direction and helping others perform at their best.",
    rubric: [d("vision", "Setting direction"), d("influence", "Influence"), d("accountability", "Accountability")],
  },
  {
    slug: "negotiation",
    name: "Negotiation",
    category: "specific",
    description: "Reaching agreements that serve your interests and preserve relationships.",
    rubric: [d("preparation", "Preparation"), d("asking", "Asking for what you want"), d("value_creation", "Creating value")],
  },
  {
    slug: "sales",
    name: "Sales",
    category: "specific",
    description: "Understanding needs and persuading people of real value.",
    rubric: [d("discovery", "Discovering needs"), d("pitch", "Value pitch"), d("closing", "Closing")],
  },
  {
    slug: "entrepreneurship",
    name: "Entrepreneurship",
    category: "specific",
    description: "Spotting opportunities and turning ideas into action.",
    rubric: [d("opportunity", "Spotting opportunities"), d("validation", "Validating ideas"), d("bias_to_action", "Bias to action")],
  },
  {
    slug: "team-management",
    name: "Team Management",
    category: "specific",
    description: "Organising, delegating to and developing a team.",
    rubric: [d("delegation", "Delegation"), d("feedback", "Giving feedback"), d("coordination", "Coordination")],
  },
  {
    slug: "interview-skills",
    name: "Interview Skills",
    category: "specific",
    description: "Presenting your experience compellingly in interviews.",
    rubric: [d("preparation", "Preparation"), d("storytelling", "Answer structure"), d("composure", "Composure")],
  },
  {
    slug: "personal-branding",
    name: "Personal Branding",
    category: "specific",
    description: "Shaping how others perceive your expertise and values.",
    rubric: [d("positioning", "Positioning"), d("visibility", "Visibility"), d("consistency", "Consistency")],
  },
  {
    slug: "storytelling",
    name: "Storytelling",
    category: "specific",
    description: "Using narrative to make ideas memorable and persuasive.",
    rubric: [d("structure", "Narrative structure"), d("detail", "Vivid detail"), d("purpose", "Clear point")],
  },
  {
    slug: "active-listening",
    name: "Active Listening",
    category: "specific",
    description: "Fully understanding others before responding.",
    rubric: [d("attention", "Attention"), d("questions", "Clarifying questions"), d("reflection", "Reflecting back")],
  },
  {
    slug: "conflict-resolution",
    name: "Conflict Resolution",
    category: "specific",
    description: "Turning disagreements into constructive outcomes.",
    rubric: [d("de_escalation", "De-escalation"), d("understanding", "Understanding positions"), d("resolution", "Finding resolution")],
  },
];

export const ALL_SKILLS: SkillDefinition[] = [...CORE_SKILLS, ...SPECIFIC_SKILLS];
