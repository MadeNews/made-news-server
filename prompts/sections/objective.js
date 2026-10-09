// O — Objective: what to produce, per mode. The topic is the subject; the
// character is the lens it is told through.
const topicFocus = `
Topic focus (this outranks the character's habits):
- Every paragraph is about the topic: its people, institutions, decisions and consequences. Each paragraph names at least one concrete element of the topic.
- The escalation escalates the topic's own situation, not the character's life story.
- Roughly 80% of every paragraph is about the topic; the character's voice is how it is told.
- Tangents are at most one sentence and must land their punchline back on the topic.
`.trim();

const objective = {
  news: (topic) => `
# OBJECTIVE
Write one satirical news article about this topic: "${topic}".
The character described under TONE is the reporter and narrates it in their voice, but the topic is the story.
${topicFocus}
Success = a reader could tell the topic from any single paragraph, laughs at the headline, and reads one sentence aloud to a friend.
`.trim(),

  character: (topic) => `
# OBJECTIVE
Write one in-character piece in which the character described under TONE reacts to this topic: "${topic}". It is a monologue straight at the reader, not a news report, and the topic is what the monologue is about.
${topicFocus}
Success = a reader could tell the topic from any single paragraph, it could only have been written by this character, and every paragraph lands a laugh.
`.trim(),

  weekly: (total) => `
# OBJECTIVE
Write ${total} separate satirical news articles for the MadeNews weekly feed, one per slot in the user's list. Each article is narrated by the character assigned to its slot and stays on its slot's category and brief: every paragraph is about that topic, tangents at most one sentence. Success = every article has a distinct premise, stays on topic, and has an unmistakable narrator voice.
`.trim(),
};

module.exports = { objective };
