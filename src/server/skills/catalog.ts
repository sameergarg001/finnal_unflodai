import { EXTRA_SKILLS } from "./extraSkills";

// Canonical skill catalog, seeded into the `Skill` table.
// Every skill has its own development framework: subskills, assessment
// criteria, challenge categories, feedback questions and progression logic.
// Four core skills are fixed for every user; the rest can be added from "+".

export type SkillCategory = "core" | "specific" | "custom";

// `type` (not `interface`) so it is assignable to Prisma's JSON input type.
export type Subskill = { key: string; label: string };

/** The expert teacher who coaches this skill (a fictional AI persona). */
export type Teacher = {
  name: string;
  emoji: string;
  /** e.g. "Communication coach" */
  title: string;
  /** One line shown to users. */
  tagline: string;
  /** How this teacher coaches — fed to the AI. */
  style: string;
};

export type SkillFramework = {
  teacher?: Teacher;
  /** Group shown in "Add skill" (see SKILL_GROUPS). */
  group?: string;
  /** Extra search words, e.g. degrees and professions. */
  tags?: string[];
  subskills: Subskill[];
  /** What the coach looks for when judging an attempt. */
  criteria: string[];
  /** Kinds of real-life challenges for this skill. */
  categories: string[];
  /** Questions asked after a challenge (falls back to DEFAULT_FEEDBACK_QUESTIONS). */
  feedbackQuestions?: string[];
  /** How challenges should progress as the user improves. */
  progression: string;
};

export interface SkillDefinition {
  slug: string;
  name: string;
  category: SkillCategory;
  description: string;
  framework: SkillFramework;
}

/** Difficulty levels shared by every framework (1–5). */
export const DIFFICULTY_LEVELS = [
  { value: 1, name: "Gentle", description: "Tiny, low-pressure first step" },
  { value: 2, name: "Easy", description: "Short and familiar situation" },
  { value: 3, name: "Moderate", description: "Some discomfort, clear structure" },
  { value: 4, name: "Stretch", description: "Unfamiliar or higher-stakes situation" },
  { value: 5, name: "Bold", description: "Hard, sustained or public — still safe" },
] as const;

export const DEFAULT_FEEDBACK_QUESTIONS = [
  "What happened? Walk me through it.",
  "How did you feel before starting?",
  "What was difficult?",
  "What went well?",
  "What would you do differently next time?",
];

const sub = (...labels: string[]): Subskill[] =>
  labels.map((label) => ({ key: label.toLowerCase().replace(/[^a-z]+/g, "_").replace(/^_|_$/g, ""), label }));

const HANDWRITTEN_A: SkillDefinition[] = [
  {
    slug: "communication",
    name: "Communication",
    category: "core",
    description: "Expressing ideas clearly, listening well and adapting your message to the person in front of you.",
    framework: {
      teacher: { name: "Aanya", emoji: "🗣️", title: "Communication coach", tagline: "Helps you say what you mean — clearly and kindly.", style: "Warm and practical. Gives the exact words to say, then helps you make them your own. Loves short role-plays." },
      subskills: sub("Verbal clarity", "Listening", "Asking questions", "Expressing ideas", "Non-verbal communication", "Conflict communication"),
      criteria: [
        "Said the main point clearly and early",
        "Listened and responded to what the other person actually said",
        "Adjusted tone, words or body language to the situation",
      ],
      categories: ["Explain an idea", "Ask for something", "Listen and summarise", "Difficult conversation", "Speak up in a group"],
      feedbackQuestions: [
        "What happened in the conversation?",
        "How did you feel before you spoke?",
        "Did the other person understand you? How could you tell?",
        "What went well?",
        "What would you say differently next time?",
      ],
      progression:
        "Start with one clear sentence in a low-stakes chat, then two-way conversations, then explaining complex ideas, then disagreement and conflict conversations.",
    },
  },
  {
    slug: "confidence",
    name: "Confidence",
    category: "core",
    description: "Acting despite uncertainty, speaking up and trusting your own judgement.",
    framework: {
      teacher: { name: "Kabir", emoji: "🦁", title: "Confidence coach", tagline: "Turns hesitation into small, brave actions.", style: "Calm and encouraging. Starts with tiny, low-risk steps and celebrates every attempt. Never pushes too fast." },
      subskills: sub("Reducing hesitation", "Self-expression", "Decision-making", "Handling rejection", "Speaking up", "Taking initiative"),
      criteria: [
        "Acted within a short time instead of waiting for the 'perfect moment'",
        "Expressed their own view or need directly",
        "Stayed steady or recovered after an uncomfortable moment",
      ],
      categories: ["Speak first", "Share an opinion", "Make a quick decision", "Ask despite possible 'no'", "Take the lead"],
      feedbackQuestions: [
        "What did you do, and what happened?",
        "How nervous were you before starting (and what were you thinking)?",
        "What was the hardest moment?",
        "What went better than you expected?",
        "What would you do differently next time?",
      ],
      progression:
        "Begin with tiny actions that have almost no risk of rejection, then actions where a 'no' is possible, then visible or public actions, then leading others.",
    },
  },
  {
    slug: "self-discipline",
    name: "Discipline",
    category: "core",
    description: "Doing what matters consistently — even when you don't feel like it.",
    framework: {
      teacher: { name: "Meera", emoji: "⏱️", title: "Discipline coach", tagline: "Builds habits that stick, one day at a time.", style: "Structured and no-nonsense but kind. Focuses on routines, tiny daily commitments and removing distractions." },
      subskills: sub("Consistency", "Beating procrastination", "Routine building", "Distraction management", "Goal execution", "Self-control"),
      criteria: [
        "Did the planned action at the planned time",
        "Handled distractions or low motivation with a concrete tactic",
        "Repeated the behaviour across days, not just once",
      ],
      categories: ["Single focused block", "Daily habit streak", "Remove a distraction", "Finish a postponed task", "Plan and execute a day"],
      feedbackQuestions: [
        "Did you do it as planned? What happened?",
        "How did you feel before starting?",
        "What pulled you off track (if anything)?",
        "What helped you keep going?",
        "What will you change to make it easier next time?",
      ],
      progression:
        "Start with one short focused block, then the same action on consecutive days, then longer blocks with distractions removed, then full routines tied to a goal.",
    },
  },
  {
    slug: "problem-solving",
    name: "Problem-solving",
    category: "core",
    description: "Identifying the real problem, breaking it down and working systematically toward a solution.",
    framework: {
      teacher: { name: "Arjun", emoji: "🧩", title: "Problem-solving coach", tagline: "Breaks big problems into doable pieces.", style: "Curious and analytical. Asks 'why?' to find the real problem, then breaks it into small testable steps." },
      subskills: sub("Identifying problems", "Critical thinking", "Breaking down problems", "Decision-making", "Evaluating alternatives", "Learning from mistakes"),
      criteria: [
        "Defined the actual problem in their own words",
        "Considered more than one option before choosing",
        "Tried a solution and reflected on the result",
      ],
      categories: ["Define the problem", "Break it into parts", "Compare options", "Test a small fix", "Post-mortem a mistake"],
      feedbackQuestions: [
        "What problem did you work on, and what did you do?",
        "How did you feel when you started on it?",
        "Where did you get stuck?",
        "What worked?",
        "What would you try differently next time?",
      ],
      progression:
        "Begin with defining and splitting one everyday problem, then comparing options with clear criteria, then testing solutions, then reviewing failures to improve the method.",
    },
  },
  {
    slug: "adaptability",
    name: "Adaptability",
    category: "core",
    description: "Adjusting quickly and calmly when plans, people or circumstances change.",
    framework: {
      teacher: { name: "Zoya", emoji: "🌊", title: "Adaptability coach", tagline: "Helps you stay steady when things change.", style: "Flexible and reassuring. Reframes change as practice and builds comfort with the unfamiliar step by step." },
      subskills: sub("Openness to change", "Composure under pressure", "Adjusting approach", "Learning new ways", "Handling uncertainty"),
      criteria: [
        "Stayed calm or recovered quickly when something changed",
        "Changed their approach instead of repeating what wasn't working",
        "Looked for something useful in the new situation",
      ],
      categories: ["Change a routine on purpose", "Try an unfamiliar method", "Respond to an unexpected change", "Work with a different style of person"],
      progression:
        "Start with small, chosen changes to routines, then unfamiliar methods, then unexpected changes in real situations, then high-pressure uncertainty.",
    },
  },
];

const HANDWRITTEN_B: SkillDefinition[] = [
  {
    slug: "networking",
    name: "Networking",
    category: "specific",
    description: "Starting conversations with new people and growing them into real professional relationships.",
    framework: {
      teacher: { name: "Rohan", emoji: "🤝", title: "Networking coach", tagline: "Makes meeting new people feel natural.", style: "Friendly and social. Gives conversation starters and follow-up ideas, focuses on genuine curiosity over 'selling yourself'." },
      subskills: sub(
        "Starting conversations",
        "Self-introduction",
        "Active listening",
        "Asking meaningful questions",
        "Building relationships",
        "Following up",
        "Maintaining connections",
      ),
      criteria: [
        "Initiated contact with someone new",
        "Kept the conversation going with genuine questions",
        "Created a reason or plan to stay in touch",
      ],
      categories: ["Approach one new person", "Introduce yourself", "Two-minute conversation", "Follow up after meeting", "Reconnect with an old contact"],
      feedbackQuestions: [
        "Did you approach someone? What happened?",
        "How did you feel before approaching them?",
        "What was difficult in the conversation?",
        "What went well?",
        "What would you do differently next time?",
      ],
      progression:
        "Start with saying hello and introducing yourself, then two-minute conversations with an open question, then follow-ups, then maintaining a network over time.",
    },
  },
  {
    slug: "public-speaking",
    name: "Public speaking",
    category: "specific",
    description: "Speaking to groups with structure, presence and impact.",
    framework: {
      teacher: { name: "Ishaan", emoji: "🎤", title: "Public speaking coach", tagline: "From a nervous voice to a clear message.", style: "Energetic and supportive. Focuses on structure first, then delivery; practises out loud in short bursts." },
      subskills: sub("Structure", "Delivery", "Managing nerves", "Stage presence", "Handling questions"),
      criteria: ["Had a clear opening, point and close", "Spoke at a steady pace with eye contact", "Kept going despite nerves or mistakes"],
      categories: ["Speak up in a meeting", "Short prepared talk", "Impromptu answer", "Present to a group"],
      progression: "From one comment in a small group, to a prepared 1-minute talk, to longer talks, to Q&A and larger audiences.",
    },
  },
  {
    slug: "leadership",
    name: "Leadership",
    category: "specific",
    description: "Setting direction and helping others perform at their best.",
    framework: {
      teacher: { name: "Tara", emoji: "🧭", title: "Leadership coach", tagline: "Helps you lead by example and bring people along.", style: "Thoughtful and direct. Focuses on ownership, clear direction and helping others do their best." },
      subskills: sub("Setting direction", "Influence", "Delegation", "Giving feedback", "Accountability"),
      criteria: ["Took responsibility for an outcome", "Got others to act without forcing them", "Gave clear, useful direction or feedback"],
      categories: ["Lead a small task", "Give feedback", "Delegate", "Make a call for the group"],
      progression: "From leading one small task, to coordinating a few people, to giving feedback, to owning group outcomes.",
    },
  },
  {
    slug: "negotiation",
    name: "Negotiation",
    category: "specific",
    description: "Reaching agreements that serve your interests and preserve relationships.",
    framework: {
      teacher: { name: "Dev", emoji: "⚖️", title: "Negotiation coach", tagline: "Teaches you to ask for what you want — and get fair deals.", style: "Calm and strategic. Prepares you with clear asks, the other side's needs and a fallback plan." },
      subskills: sub("Preparation", "Asking for what you want", "Understanding the other side", "Creating value", "Holding your ground"),
      criteria: ["Asked clearly for a specific outcome", "Explored what the other side needed", "Did not give in at the first pushback"],
      categories: ["Ask for a small discount or favour", "Negotiate a plan with someone", "Counter an offer"],
      progression: "From small low-stakes asks, to two-sided trade-offs, to negotiations with real stakes.",
    },
  },
  {
    slug: "time-management",
    name: "Time management",
    category: "specific",
    description: "Prioritising and planning so your time goes to what matters most.",
    framework: {
      teacher: { name: "Nisha", emoji: "📅", title: "Time management coach", tagline: "Gets your time working for what matters.", style: "Organised and realistic. Uses simple plans, time-boxing and honest estimates." },
      subskills: sub("Prioritisation", "Planning", "Realistic estimation", "Saying no", "Protecting focus time"),
      criteria: ["Chose the most important task first", "Estimated and tracked time honestly", "Protected planned time from interruptions"],
      categories: ["Plan tomorrow", "Time-box a task", "Cut or delegate a task", "Weekly review"],
      progression: "From planning one day, to estimating and comparing with reality, to protecting focus time, to weekly planning.",
    },
  },
  {
    slug: "interview-skills",
    name: "Interview skills",
    category: "specific",
    description: "Presenting your experience clearly and confidently in interviews.",
    framework: {
      teacher: { name: "Vikram", emoji: "💼", title: "Interview coach", tagline: "Helps you tell your story with confidence.", style: "Professional and encouraging. Uses the situation-action-result structure and mock questions." },
      subskills: sub("Preparation", "Answer structure", "Telling your story", "Composure", "Asking good questions"),
      criteria: ["Answered with a clear structure (situation, action, result)", "Gave concrete examples", "Stayed composed under tough questions"],
      categories: ["Prepare one story", "Mock answer out loud", "Mock interview with a friend", "Real interview reflection"],
      progression: "From preparing stories, to practising out loud, to mock interviews, to real interviews.",
    },
  },
  {
    slug: "critical-thinking",
    name: "Critical thinking",
    category: "specific",
    description: "Questioning assumptions and weighing evidence before concluding.",
    framework: {
      teacher: { name: "Sara", emoji: "🔍", title: "Critical thinking coach", tagline: "Helps you question, weigh evidence and decide well.", style: "Inquisitive and fair-minded. Asks for evidence, alternative views and hidden assumptions." },
      subskills: sub("Questioning assumptions", "Weighing evidence", "Considering perspectives", "Spotting bias", "Reasoning clearly"),
      criteria: ["Named an assumption and tested it", "Looked for evidence on both sides", "Changed or confirmed a view for a stated reason"],
      categories: ["Fact-check a claim", "Argue the other side", "Decision with pros and cons"],
      progression: "From checking one claim, to weighing two sides, to examining your own biases in real decisions.",
    },
  },
  {
    slug: "emotional-intelligence",
    name: "Emotional intelligence",
    category: "specific",
    description: "Recognising and managing your emotions and responding well to others'.",
    framework: {
      teacher: { name: "Leela", emoji: "💗", title: "Emotional intelligence coach", tagline: "Understand your feelings and respond well to others.", style: "Gentle and perceptive. Helps you name emotions, pause, and respond with empathy." },
      subskills: sub("Self-awareness", "Self-regulation", "Empathy", "Reading others", "Responding with care"),
      criteria: ["Named their own emotion in the moment", "Paused before reacting", "Responded to the other person's feelings, not just their words"],
      categories: ["Name the emotion", "Pause before reacting", "Empathy check-in", "Repair after a reaction"],
      progression: "From noticing emotions, to pausing in real situations, to responding to others' emotions, to repairing conflicts.",
    },
  },
  {
    slug: "decision-making",
    name: "Decision making",
    category: "specific",
    description: "Choosing well and in time, with incomplete information.",
    framework: {
      teacher: { name: "Neel", emoji: "🎯", title: "Decision-making coach", tagline: "Helps you decide in time, with clear reasons.", style: "Clear-headed and practical. Uses simple criteria, time limits and honest reviews." },
      subskills: sub("Clear criteria", "Deciding in time", "Owning outcomes"),
      criteria: ["Set criteria before choosing", "Decided within the time they set", "Reviewed the outcome honestly"],
      categories: ["Decide a pending choice", "Time-boxed decision", "Decision review"],
      progression: "From small daily decisions, to postponed decisions, to bigger decisions with reviews.",
    },
  },
  {
    slug: "relationship-building",
    name: "Relationship building",
    category: "specific",
    description: "Building trust and maintaining meaningful connections with people.",
    framework: {
      teacher: { name: "Priya", emoji: "🌱", title: "Relationship coach", tagline: "Helps you build trust and stay connected.", style: "Caring and genuine. Focuses on small, consistent gestures and real interest in people." },
      subskills: sub("Building trust", "Staying in touch", "Giving value"),
      criteria: ["Reached out without needing something", "Kept a promise or follow-up", "Showed genuine interest"],
      categories: ["Check in on someone", "Help without being asked", "Deepen one relationship"],
      progression: "From small check-ins, to regular contact, to deeper, two-way relationships.",
    },
  },
  {
    slug: "creativity",
    name: "Creativity",
    category: "specific",
    description: "Generating original ideas and new approaches to familiar things.",
    framework: {
      teacher: { name: "Kiara", emoji: "🎨", title: "Creativity coach", tagline: "Unlocks ideas and the courage to try them.", style: "Playful and imaginative. Uses quick idea sprints and small experiments, no judgement early on." },
      subskills: sub("Idea generation", "Originality", "Willingness to experiment"),
      criteria: ["Produced several ideas before judging", "Tried something new", "Shared or tested an idea"],
      categories: ["Ten ideas", "Remix something", "Prototype an idea"],
      progression: "From generating ideas, to trying them, to sharing and refining them.",
    },
  },
  {
    slug: "learning-ability",
    name: "Learning ability",
    category: "specific",
    description: "Picking up new knowledge and skills efficiently and applying them.",
    framework: {
      teacher: { name: "Aditya", emoji: "📚", title: "Learning coach", tagline: "Helps you learn faster and actually use it.", style: "Methodical and curious. Uses active recall, teaching back and applying the same day." },
      subskills: sub("Curiosity", "Learning method", "Applying what was learned"),
      criteria: ["Used an active learning method", "Applied it the same day", "Explained it to someone"],
      categories: ["Learn and apply", "Teach back", "Practice drill"],
      progression: "From short learning sessions, to applying them, to teaching others.",
    },
  },
  {
    slug: "sales",
    name: "Sales",
    category: "specific",
    description: "Understanding needs and persuading people of real value.",
    framework: {
      teacher: { name: "Raj", emoji: "📈", title: "Sales coach", tagline: "Helps you understand needs and show real value.", style: "Upbeat and honest. Discovery questions first, then a simple value pitch and a clear ask." },
      subskills: sub("Discovering needs", "Value pitch", "Handling objections", "Closing"),
      criteria: ["Asked about needs before pitching", "Linked the offer to their need", "Asked for a decision"],
      categories: ["Discovery questions", "Pitch practice", "Ask for the sale"],
      progression: "From discovery conversations, to pitching, to handling objections and closing.",
    },
  },
  {
    slug: "entrepreneurship",
    name: "Entrepreneurship",
    category: "specific",
    description: "Spotting opportunities and turning ideas into action.",
    framework: {
      teacher: { name: "Ayaan", emoji: "🚀", title: "Entrepreneurship coach", tagline: "Turns ideas into small real-world tests.", style: "Bold but grounded. Talk to real users, test cheaply, ship small." },
      subskills: sub("Spotting opportunities", "Validating ideas", "Bias to action"),
      criteria: ["Talked to real potential users", "Tested an assumption cheaply", "Shipped something small"],
      categories: ["Customer conversation", "Smallest test", "Ship it"],
      progression: "From noticing problems, to talking to users, to small experiments and launches.",
    },
  },
  {
    slug: "team-management",
    name: "Team management",
    category: "specific",
    description: "Organising, delegating to and developing a team.",
    framework: {
      teacher: { name: "Naina", emoji: "👥", title: "Team management coach", tagline: "Helps you organise, delegate and grow a team.", style: "Supportive and structured. Clear outcomes, specific feedback, regular check-ins." },
      subskills: sub("Delegation", "Giving feedback", "Coordination"),
      criteria: ["Delegated with clear outcomes", "Gave specific feedback", "Kept the team aligned"],
      categories: ["Delegate a task", "One-to-one", "Team check-in"],
      progression: "From delegating one task, to regular feedback, to coordinating the whole team.",
    },
  },
  {
    slug: "personal-branding",
    name: "Personal branding",
    category: "specific",
    description: "Shaping how others perceive your expertise and values.",
    framework: {
      teacher: { name: "Rhea", emoji: "✨", title: "Personal branding coach", tagline: "Helps people see what you're great at.", style: "Creative and strategic. Clear positioning, consistent small posts, authentic voice." },
      subskills: sub("Positioning", "Visibility", "Consistency"),
      criteria: ["Clearly stated what they stand for", "Shared work publicly", "Did it consistently"],
      categories: ["Write your one-liner", "Share a post", "Weekly visibility habit"],
      progression: "From defining your message, to sharing once, to sharing consistently.",
    },
  },
  {
    slug: "storytelling",
    name: "Storytelling",
    category: "specific",
    description: "Using narrative to make ideas memorable and persuasive.",
    framework: {
      teacher: { name: "Kavya", emoji: "📖", title: "Storytelling coach", tagline: "Makes your ideas memorable through stories.", style: "Expressive and vivid. Beginning-tension-end structure with concrete detail." },
      subskills: sub("Narrative structure", "Vivid detail", "Clear point"),
      criteria: ["Story had a beginning, tension and end", "Used concrete detail", "Story made a clear point"],
      categories: ["Tell a short story", "Story in a pitch", "Story to a group"],
      progression: "From one short story to a friend, to stories in work situations, to stories for groups.",
    },
  },
  {
    slug: "active-listening",
    name: "Active listening",
    category: "specific",
    description: "Fully understanding others before responding.",
    framework: {
      teacher: { name: "Omar", emoji: "👂", title: "Listening coach", tagline: "Helps people feel truly heard by you.", style: "Patient and attentive. Focuses on not interrupting, clarifying questions and summarising back." },
      subskills: sub("Attention", "Clarifying questions", "Reflecting back"),
      criteria: ["Did not interrupt", "Asked a clarifying question", "Summarised what they heard"],
      categories: ["Listen without interrupting", "Summarise back", "Deep conversation"],
      progression: "From one attentive conversation, to summarising back, to listening in hard conversations.",
    },
  },
  {
    slug: "conflict-resolution",
    name: "Conflict resolution",
    category: "specific",
    description: "Turning disagreements into constructive outcomes.",
    framework: {
      teacher: { name: "Sana", emoji: "🕊️", title: "Conflict resolution coach", tagline: "Turns disagreements into solutions.", style: "Calm and balanced. De-escalate first, understand the real concern, agree on a next step." },
      subskills: sub("De-escalation", "Understanding positions", "Finding resolution"),
      criteria: ["Stayed calm and lowered tension", "Understood the other side's real concern", "Agreed on a next step"],
      categories: ["Calm a small disagreement", "Understand the other side", "Resolve an open issue"],
      progression: "From small disagreements, to understanding positions, to resolving real conflicts.",
    },
  },
];

/** The four skills every user develops. Everything else is added from "+". */
export const CORE_SLUGS = ["communication", "confidence", "self-discipline", "time-management"];

/** Groups in "Add skill", for every kind of student and profession. */
export const SKILL_GROUPS = [
  { id: "career", label: "Career & jobs", hint: "Placements, interviews, workplace" },
  { id: "students", label: "Students", hint: "School, college, competitive exams" },
  { id: "tech", label: "Engineering & tech", hint: "B.Tech, BCA, MCA, IT jobs" },
  { id: "commerce", label: "Commerce & finance", hint: "B.Com, CA, banking" },
  { id: "business", label: "Business & management", hint: "BBA, MBA, founders, managers" },
  { id: "speaking", label: "Speaking & influence", hint: "Presenting, persuading, selling" },
  { id: "creative", label: "Creative & media", hint: "BA, B.Des, mass comm, creators" },
  { id: "health", label: "Health & care", hint: "MBBS, nursing, pharmacy, psychology" },
  { id: "law", label: "Law & public service", hint: "LLB, UPSC, government" },
  { id: "growth", label: "Personal growth", hint: "Mindset, emotions, relationships" },
] as const;

const GROUP_OF: Record<string, string> = {
  "problem-solving": "growth",
  adaptability: "growth",
  networking: "career",
  "public-speaking": "speaking",
  leadership: "business",
  negotiation: "speaking",
  "interview-skills": "career",
  "critical-thinking": "growth",
  "emotional-intelligence": "growth",
  "decision-making": "business",
  "relationship-building": "growth",
  creativity: "creative",
  "learning-ability": "students",
  sales: "speaking",
  entrepreneurship: "business",
  "team-management": "business",
  "personal-branding": "creative",
  storytelling: "speaking",
  "active-listening": "growth",
  "conflict-resolution": "growth",
};

/** Search words (degrees, professions) for the hand-written skills. */
const TAGS_OF: Record<string, string[]> = {
  communication: ["speaking", "english", "everyone"],
  confidence: ["shyness", "fear", "self esteem", "everyone"],
  "self-discipline": ["procrastination", "consistency", "habits", "everyone"],
  "time-management": ["productivity", "planning", "students", "everyone"],
  "problem-solving": ["btech", "engineering", "consulting", "case study", "mba"],
  adaptability: ["change", "new job", "hostel", "relocation"],
  networking: ["linkedin", "placements", "internship", "mba", "career"],
  "public-speaking": ["stage", "seminar", "college", "anchoring", "speech"],
  leadership: ["mba", "bba", "manager", "team lead", "student council"],
  negotiation: ["mba", "bba", "salary", "sales", "business"],
  "interview-skills": ["placements", "job", "hr interview", "upsc interview", "mba admissions"],
  "critical-thinking": ["upsc", "law", "research", "reasoning"],
  "emotional-intelligence": ["psychology", "relationships", "workplace", "eq"],
  "decision-making": ["mba", "career choice", "manager"],
  "relationship-building": ["friends", "family", "workplace", "clients"],
  creativity: ["design", "bdes", "arts", "ideas", "innovation"],
  "learning-ability": ["students", "school", "college", "upskilling"],
  sales: ["bba", "mba", "business development", "marketing"],
  entrepreneurship: ["startup", "founder", "bba", "mba", "business"],
  "team-management": ["mba", "manager", "team lead", "bba"],
  "personal-branding": ["linkedin", "creator", "freelancer", "career"],
  storytelling: ["content", "marketing", "pitch", "mass comm"],
  "active-listening": ["counselling", "psychology", "relationships", "customer service"],
  "conflict-resolution": ["workplace", "family", "hr", "manager"],
};

const BASE_SKILLS = [...HANDWRITTEN_A, ...HANDWRITTEN_B, ...EXTRA_SKILLS].map((s) => ({
  ...s,
  framework: {
    ...s.framework,
    group: s.framework.group ?? GROUP_OF[s.slug] ?? "growth",
    tags: s.framework.tags ?? TAGS_OF[s.slug] ?? [],
  },
}));

export const ALL_SKILLS: SkillDefinition[] = [
  ...CORE_SLUGS.map((slug) => ({ ...BASE_SKILLS.find((s) => s.slug === slug)!, category: "core" as const })),
  ...BASE_SKILLS.filter((s) => !CORE_SLUGS.includes(s.slug)).map((s) => ({ ...s, category: "specific" as const })),
];
export const CORE_SKILLS = ALL_SKILLS.filter((s) => s.category === "core");
export const SPECIFIC_SKILLS = ALL_SKILLS.filter((s) => s.category === "specific");

/** Framework for a user-created custom skill. */
export function customFramework(name: string, subskillLabels: string[]): SkillFramework {
  const labels = subskillLabels.map((s) => s.trim()).filter(Boolean).slice(0, 7);
  return {
    teacher: customTeacher(name),
    subskills: sub(...(labels.length ? labels : ["Fundamentals", "Practice in real situations", "Consistency", "Handling setbacks"])),
    criteria: [`Took a concrete action that practises ${name}`, "Reflected honestly on the result", "Built on previous attempts"],
    categories: ["First small attempt", "Repeat in a new situation", "Stretch attempt"],
    progression: `Start with small, low-risk actions that practise ${name}, then repeat them in real situations, then take on harder, higher-stakes versions.`,
  };
}

/** Teacher for a user-created skill. */
export function customTeacher(skillName: string): Teacher {
  return {
    name: "Unfold",
    emoji: "🌟",
    title: `${skillName} coach`,
    tagline: `Your personal coach for ${skillName}.`,
    style: `Practical and encouraging expert in ${skillName}. Breaks it into small real-world actions and builds on each attempt.`,
  };
}
