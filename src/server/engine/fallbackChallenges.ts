// Hand-written challenges used when the AI is unavailable or returns bad output.
// Two per skill: an easier (difficulty 1–2) and a harder (3–5) variant.

export interface ChallengeDraft {
  title: string;
  instructions: string;
  successCriteria: string[];
  estimatedMinutes: number;
  whyThisChallenge: string;
}

type Pair = [ChallengeDraft, ChallengeDraft];

const c = (
  title: string,
  instructions: string,
  successCriteria: string[],
  estimatedMinutes: number,
  whyThisChallenge: string,
): ChallengeDraft => ({ title, instructions, successCriteria, estimatedMinutes, whyThisChallenge });

const LIBRARY: Record<string, Pair> = {
  communication: [
    c("Explain it in three sentences", "Pick something you know well (a hobby, a task at work). Explain it to a friend or colleague in no more than three sentences, then ask them to repeat back the main idea.", ["Explanation was three sentences or fewer", "The listener could repeat the main idea"], 10, "Concise explanations are the foundation of clear communication."),
    c("Adapt one message for two audiences", "Take one update you need to share this week. Deliver it once to an expert and once to a non-expert, changing vocabulary and detail for each.", ["Delivered to two different audiences", "Noticed and changed at least two things between versions"], 20, "Strong communicators adjust the message to the listener."),
  ],
  confidence: [
    c("Share one opinion", "In a conversation or meeting today, share one opinion you would normally keep to yourself. Say it clearly, without apologising first.", ["Shared an opinion out loud", "Did not start with an apology or disclaimer"], 5, "Confidence grows through small acts of speaking up."),
    c("Make one bold request", "Ask for something you want but usually wouldn't ask for (feedback, a favour, an opportunity). Accept that the answer might be no.", ["Made the request directly", "Handled the answer calmly, whatever it was"], 15, "Asking despite possible rejection builds self-trust."),
  ],
  "critical-thinking": [
    c("Question one claim", "Find one claim today (news, social media, a colleague). Write down what evidence would prove it true, then check whether that evidence exists.", ["Wrote down the claim and required evidence", "Reached a conclusion based on what you found"], 15, "Critical thinkers ask 'how do we know?' before accepting."),
    c("Argue the other side", "Pick a belief you hold strongly. Write the strongest possible argument against it in 5–6 sentences, as if you believed it.", ["Wrote a fair, strong counter-argument", "Identified at least one point you hadn't considered"], 20, "Steelmanning reveals hidden assumptions."),
  ],
  "problem-solving": [
    c("Break down one annoyance", "Choose a small recurring problem in your day. Write down its root cause by asking 'why?' three times, then try one fix.", ["Asked 'why' at least three times", "Tried one concrete fix"], 15, "Most problems are solved by finding the real cause."),
    c("Three solutions before one", "For a real problem you're facing, write three genuinely different solutions before choosing one. Pick the best and take the first step.", ["Generated three distinct options", "Took the first step on the chosen one"], 25, "Considering options prevents jumping to the first idea."),
  ],
  "decision-making": [
    c("Decide in five minutes", "Pick a small decision you've been postponing. Set a five-minute timer, list pros and cons, and decide before it rings.", ["Made the decision within five minutes", "Acted on it today"], 5, "Practising timely decisions reduces overthinking."),
    c("Write your decision criteria", "For a bigger pending decision, write the three criteria that matter most and score each option against them. Decide and tell someone.", ["Wrote explicit criteria", "Scored options and committed to one"], 20, "Clear criteria lead to better, faster decisions."),
  ],
  "emotional-intelligence": [
    c("Name your emotion", "Three times today, pause and name exactly what you feel (e.g. 'frustrated', not 'bad') and what triggered it.", ["Named emotions three times", "Identified at least one trigger"], 5, "Self-awareness starts with precise emotional vocabulary."),
    c("Read the room", "In your next group conversation, notice one person's unspoken feelings. Afterwards, gently check if you were right.", ["Made a specific observation", "Checked it with the person"], 15, "Empathy improves when you test your reads."),
  ],
  "self-discipline": [
    c("One distraction-free block", "Work on one important task for 25 minutes with your phone in another room. No switching tasks.", ["Completed 25 focused minutes", "Phone stayed away the whole time"], 25, "Discipline is built in short, protected blocks."),
    c("Do the hard thing first", "Tomorrow, start your day with the task you most want to avoid, before checking messages.", ["Started with the avoided task", "Didn't check messages first"], 30, "Tackling resistance early builds follow-through."),
  ],
  "time-management": [
    c("Pick your top three", "Before starting work, write the three tasks that matter most today. At the end of the day, check how many you finished.", ["Wrote three priorities in the morning", "Reviewed them at day's end"], 5, "Prioritisation is the core of time management."),
    c("Estimate vs. reality", "Estimate how long each of three tasks will take, then time them. Compare and note the pattern.", ["Estimated three tasks in advance", "Recorded actual times and the gap"], 15, "Better estimates lead to realistic plans."),
  ],
  adaptability: [
    c("Change one routine", "Deliberately do one routine thing differently today (route, order of tasks, workspace). Notice how you react.", ["Changed one routine", "Noted your reaction"], 10, "Small voluntary changes build comfort with change."),
    c("Plan B in advance", "For something important this week, write what you'll do if it goes wrong. If disruption happens, use your plan.", ["Wrote a concrete backup plan", "Reflected on how prepared you felt"], 15, "Adaptable people anticipate change rather than fear it."),
  ],
  "learning-ability": [
    c("Learn and teach back", "Spend 15 minutes learning something new, then explain it to someone (or record yourself) in under two minutes.", ["Learned something new", "Explained it in under two minutes"], 20, "Teaching is the fastest way to consolidate learning."),
    c("Apply one idea", "Take one idea from something you recently read or watched and apply it to a real task today.", ["Chose a specific idea", "Applied it and observed the result"], 25, "Learning sticks when it's used."),
  ],
  creativity: [
    c("Ten uses", "Pick an everyday object and list ten unusual uses for it in five minutes.", ["Listed ten uses", "At least two felt genuinely original"], 5, "Idea fluency is a trainable creative muscle."),
    c("Remix a routine task", "Find a new way to do a task you do regularly. Try it and compare results.", ["Designed a new approach", "Tried it and compared"], 20, "Creativity means improving the familiar too."),
  ],
  "relationship-building": [
    c("Reconnect with one person", "Message someone you haven't talked to in a while, with a genuine question about their life (not asking for anything).", ["Sent a personal message", "Asked a genuine question"], 5, "Relationships grow through no-strings contact."),
    c("Offer specific help", "Find out what a colleague or friend is working on and offer one specific, useful piece of help.", ["Learned what they needed", "Offered concrete help"], 20, "Giving value first builds trust."),
  ],
  "public-speaking": [
    c("Record a one-minute talk", "Record yourself talking for one minute about a topic you like, with a clear opening, one point and a close. Watch it once.", ["Recorded a structured one-minute talk", "Watched it and noted one improvement"], 10, "Self-review is the fastest way to improve delivery."),
    c("Speak up in a group", "In your next meeting or group, make a prepared 1–2 minute contribution standing or with full attention on you.", ["Delivered a prepared contribution", "Kept eye contact and a steady pace"], 20, "Real audiences build real presence."),
  ],
  networking: [
    c("One new conversation", "Start a conversation with someone new (at work, an event, online) and learn one thing about what they do.", ["Started the conversation yourself", "Learned something about their work"], 10, "Networking starts with curiosity about others."),
    c("Follow up meaningfully", "Contact someone you met recently and share something useful to them (an article, intro, idea).", ["Followed up within the week", "Shared something tailored to them"], 15, "Follow-up turns contacts into relationships."),
  ],
  leadership: [
    c("Clarify the goal", "In a group task, be the one to state clearly what the group is trying to achieve and confirm everyone agrees.", ["Stated the goal clearly", "Got agreement from the group"], 10, "Leaders create clarity."),
    c("Take ownership", "Volunteer to own a small outcome for a group and see it through, including updating others on progress.", ["Volunteered for ownership", "Delivered and communicated progress"], 30, "Leadership is visible accountability."),
  ],
  negotiation: [
    c("Ask for a little more", "In a low-stakes situation (a purchase, a deadline, a plan), politely ask for slightly better terms.", ["Made a specific ask", "Stayed friendly whatever the outcome"], 10, "Comfort asking is the first negotiation skill."),
    c("Prepare your walk-away", "Before a real negotiation, write your ideal outcome, acceptable minimum, and the other side's likely interests.", ["Wrote all three before negotiating", "Used them in the conversation"], 25, "Preparation drives negotiation outcomes."),
  ],
  sales: [
    c("Discover before pitching", "In a conversation where you want someone to agree to something, ask three questions about their needs before making your case.", ["Asked three need-focused questions", "Linked your case to their answers"], 15, "Great selling starts with listening."),
    c("Ask for the commitment", "Pitch an idea, product or plan and explicitly ask for a yes or a next step.", ["Delivered a clear pitch", "Explicitly asked for commitment"], 20, "Many pitches fail simply because nobody asks."),
  ],
  entrepreneurship: [
    c("Validate one idea", "Take one idea you have and ask three people whether they'd use or pay for it. Note their exact words.", ["Talked to three people", "Recorded honest reactions"], 30, "Validation beats assumption."),
    c("Smallest possible test", "Design the cheapest, fastest test of an idea (a post, a sign-up form, a mockup) and launch it.", ["Defined a clear test", "Launched it"], 45, "Entrepreneurs bias toward action."),
  ],
  "team-management": [
    c("Delegate one task clearly", "Hand off one task with a clear outcome, deadline and check-in point.", ["Defined outcome, deadline and check-in", "Did not take the task back"], 10, "Clear delegation multiplies a team's output."),
    c("Give balanced feedback", "Give one person specific feedback: one thing to continue and one thing to change, with examples.", ["Gave specific positive feedback", "Gave specific constructive feedback"], 15, "Teams grow through honest, specific feedback."),
  ],
  "interview-skills": [
    c("Prepare one STAR story", "Write one achievement as a STAR story (Situation, Task, Action, Result) and say it aloud in under two minutes.", ["Wrote a complete STAR story", "Said it aloud within two minutes"], 15, "Structured stories make interview answers compelling."),
    c("Mock interview", "Ask a friend to interview you with three common questions, or record yourself answering them. Review one answer critically.", ["Answered three questions aloud", "Identified one concrete improvement"], 30, "Practice under pressure reduces interview nerves."),
  ],
  "personal-branding": [
    c("Your one-line pitch", "Write one sentence describing what you do and what makes you different. Test it on one person.", ["Wrote a one-line pitch", "Tested it and got a reaction"], 10, "A clear positioning statement is the core of a brand."),
    c("Share one insight publicly", "Post one genuine insight from your work or learning on a platform you use.", ["Published a post", "It reflected your own perspective"], 20, "Visibility builds reputation."),
  ],
  storytelling: [
    c("Tell a 60-second story", "Tell someone a short story from your week with a clear beginning, a problem, and an ending with a point.", ["Story had beginning, problem, ending", "Ended with a clear point"], 10, "Structure makes stories land."),
    c("Make a point with a story", "Next time you need to persuade someone, use a short real story instead of only facts.", ["Used a real story", "It supported your point"], 15, "Stories persuade more than data alone."),
  ],
  "active-listening": [
    c("Reflect back", "In one conversation today, summarise what the other person said before giving your view.", ["Summarised their point first", "They confirmed you understood"], 10, "Reflecting back proves you listened."),
    c("Two follow-up questions", "In a conversation, ask at least two follow-up questions before sharing anything about yourself.", ["Asked two follow-ups", "Did not redirect to yourself"], 15, "Curiosity deepens understanding."),
  ],
  "conflict-resolution": [
    c("Understand their side", "Think of a current disagreement. Write the other person's view as fairly as you can and what they need.", ["Wrote their view fairly", "Identified their underlying need"], 15, "Resolution starts with understanding."),
    c("Address it calmly", "Have a calm conversation about a small issue you've been avoiding, using 'I' statements.", ["Raised the issue", "Used 'I' statements and stayed calm"], 20, "Small conflicts addressed early stay small."),
  ],
};

export function fallbackChallenge(skillSlug: string, difficulty: number): ChallengeDraft {
  const pair = LIBRARY[skillSlug] ?? LIBRARY.communication;
  return difficulty <= 2 ? pair[0] : pair[1];
}
