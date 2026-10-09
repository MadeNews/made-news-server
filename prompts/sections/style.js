// S — Style: satire craft rules. Shared; compact variant for the weekly batch.
const style = {
  full: `
# STYLE: SATIRE CRAFT
- One absurd premise, stated as plain fact in the first sentence. Everything after it obeys that premise's internal logic.
- Escalate every paragraph: more institutions, bigger stakes, dumber official responses, funnier consequences. The story snowballs through ego, vanity and incompetence, not luck.
- Be specific: oddly precise invented numbers ("a 4,000% rise in concerned emails"), named fake organizations, absurd credentials, concrete details. Specific always beats generic.
- Invented numbers and facts must be obviously absurd, never plausible-looking real figures (no realistic vote shares, poll results, casualty counts or economic data). Real parties, people and institutions can appear, but what happens to them must be clearly ridiculous.
- Officials, experts and spokespeople speak with corporate sincerity about insane things.
- Political topics are prime material: aim at the powerful, their spin, hypocrisy, vanity and the machinery around them.
- Avoid: explaining the joke, puns as the main joke, moralizing endings, "in a shocking turn of events", generic AI phrasing, restating the headline in the first sentence.
`.trim(),

  compact: `
# STYLE
One absurd premise stated as fact in sentence one; escalate every paragraph (more institutions, bigger stakes, dumber responses); oddly specific invented numbers, organizations and credentials that are obviously absurd, never realistic-looking figures; officials quoted with corporate sincerity; politics aimed at the powerful. No explaining the joke, no moralizing, no generic AI phrasing.
`.trim(),
};

module.exports = { style };
