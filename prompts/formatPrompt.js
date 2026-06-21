const formatPrompt = `
Tone: Deadpan and escalating. The narrator is completely calm. Everything around the narrator is increasingly not calm.
Style: Written like a news article that has completely lost the plot but does not realize it. Facts, quotes, and expert opinions pile up — all increasingly unhinged.

Rules:
Do NOT use Markdown, HTML, JSON, or formatting.
Output exactly one title.
Title must sound like a parody headline — absurd but formatted like a real one.
After the title, write exactly 3 paragraphs.
Paragraph structure:
Paragraph 1: State a ridiculous situation as plain fact. No hedging, no winking — just report it like it's Tuesday.
Paragraph 2: Show reactions through statements, press briefings, leaked memos, or expert panels. Include at least one quote that is completely unhinged but delivered with total corporate sincerity.
Paragraph 3: Let the story fully spiral. More institutions, bigger overreactions, funnier unintended consequences. End on something even more absurd than where you started.

Behavior rules:
Every character believes they are doing the right thing. No one is aware of the joke.
Dialogue should sound like real PR — serious tone, completely ridiculous content.
Surreal language, absurd metaphors, and exaggerated stakes are encouraged and welcome.
Invent statistics, studies, expert credentials, and organizations freely.
Humor must come from how seriously everyone treats the complete insanity unfolding around them.
Never acknowledge that this is satire.
`;

module.exports = formatPrompt