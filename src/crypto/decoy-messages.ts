/** Cryptographically random integer in [0, max) */
function randInt(max: number): number {
  const arr = new Uint32Array(1)
  crypto.getRandomValues(arr)
  return arr[0]! % max
}

function pick<T>(pool: readonly T[]): T {
  return pool[randInt(pool.length)]!
}

const PAST: readonly string[] = [
  'Ran into your neighbor at the store, small world',
  'Finally got around to cleaning out the garage',
  'That shortcut you told me about actually worked',
  'Forgot my umbrella and got completely soaked',
  'Found that book I thought I lost',
  'Tried making sourdough this morning, total disaster',
  'Woke up at five and couldn\'t fall back asleep',
  'Almost locked myself out again earlier',
  'The power flickered a few times last night',
  'Saw the wildest sunset on the drive home',
  'Walked past that old bakery, still smells amazing',
  'Got the oil changed, finally',
  'Spilled coffee all over my shirt this morning',
  'Heard back from the mechanic, not too bad',
  'Bumped into an old friend at the farmers market',
  'Spent the whole morning untangling Christmas lights',
  'Had the weirdest dream last night',
  'The dog got out again, caught him two blocks over',
  'That storm knocked a branch into the yard',
  'Left my sunglasses at the restaurant, of course',
]

const PLANS: readonly string[] = [
  'Want to grab coffee sometime this week?',
  'Thinking about checking out that new place on Main',
  'Should we do tacos tonight or pizza',
  'Free this weekend? Could use a hand moving stuff',
  'Might head to the lake if the weather holds',
  'We should try that trail everyone talks about',
  'Let me know if Tuesday works for you',
  'Gonna attempt the recipe you sent me',
  'Anyone up for board games Friday?',
  'Planning a cookout next Saturday, you in?',
  'I\'ll swing by around seven if that works',
  'Need to hit the store later, want anything?',
  'Thinking sushi for dinner, thoughts?',
  'We still on for tomorrow morning?',
  'Might take the kids to the park after lunch',
  'Down for a walk later? Weather looks nice',
  'Going to try to get to bed early tonight',
  'Want to come over and watch the game?',
  'I\'ll pick up some stuff for the grill',
  'Let\'s figure out the weekend soon',
]

const REACTIONS: readonly string[] = [
  'That sunset was something else',
  'Tried that place you mentioned, you were right',
  'Ok that was actually hilarious',
  'I can\'t believe how good that was',
  'Still thinking about that meal honestly',
  'You called it, totally worth the wait',
  'Just saw your message, that\'s wild',
  'Ha yeah that sounds about right',
  'No way, when did that happen',
  'That actually made my whole day',
  'Wait really? I had no idea',
  'Yep that\'s exactly what I was thinking',
  'Ok I need to try that immediately',
  'That song has been stuck in my head all day',
  'Honestly didn\'t expect it to be that good',
  'So true, I was just saying the same thing',
  'Wow that turned out really well',
  'Can\'t stop laughing at what you sent',
  'Good call, glad I listened to you',
  'I looked it up and you were spot on',
]

const EVERYDAY: readonly string[] = [
  'Just got home, what a day',
  'Remind me to grab milk later',
  'On my way, be there in ten',
  'Running a few minutes behind',
  'Made it safe, thanks for checking',
  'Phone was dead all afternoon, sorry',
  'You won\'t believe what just happened',
  'Everything ok? Haven\'t heard from you',
  'Heading out now, need anything?',
  'Just woke up from the longest nap',
  'Can you call me when you get a sec',
  'Traffic is awful right now',
  'Already ate, sorry should have texted',
  'Do we have any eggs left',
  'Charging my phone, it was at two percent',
  'Grabbing gas then heading your way',
  'Left it on the kitchen counter',
  'Can you check if I locked the door',
  'Think the wifi is acting up again',
  'Home in about twenty, starting dinner?',
]

const ALL_MESSAGES: readonly string[] = [
  ...PAST,
  ...PLANS,
  ...REACTIONS,
  ...EVERYDAY,
]

/**
 * Generate a random, plausible decoy message for a decoy note link.
 * Uses crypto.getRandomValues for randomness.
 */
export function generateDecoyMessage(): string {
  return pick(ALL_MESSAGES)
}
