/** Cryptographically random integer in [0, max) */
function randInt(max: number): number {
  const arr = new Uint32Array(1)
  crypto.getRandomValues(arr)
  return arr[0]! % max
}

function pick<T>(pool: readonly T[]): T {
  return pool[randInt(pool.length)]!
}

const LOGISTICS: readonly string[] = [
  'Meeting moved to 3pm tomorrow',
  'Sent the invoice, check your email',
  'Package shipped, tracking number inside',
  'Flight lands at 6:45, terminal B',
  'Updated the spreadsheet with Q2 numbers',
  'Left the key under the mat',
  'Reservation confirmed for Saturday at 8',
  'Picking up the rental car at noon',
  'Appointment rescheduled to Thursday',
  'Budget report is attached',
  'Parking pass is in the glove box',
  'Server migration starts at midnight',
  'Backup drive is in the top drawer',
  'New wifi password for the office',
  'Conference room booked for 2-4pm',
  'Expense report approved, check is coming',
  'Gate code changed to the new one',
  'Storage unit combo is updated',
  'Dentist moved to next Wednesday',
  'Dropped off the dry cleaning',
]

const SOCIAL: readonly string[] = [
  'Happy birthday! Hope this year is amazing',
  'Congrats on the new job!',
  'Thanks for dinner last night, it was great',
  'Sorry I missed your call, will try again later',
  'Are we still on for Friday?',
  'Just wanted to say thanks for everything',
  'Let me know when you get home safe',
  'Miss you, let\'s catch up soon',
  'Good luck on your interview tomorrow',
  'Had such a good time this weekend',
  'Thinking of you, hope you feel better soon',
  'Thanks for the recommendation, loved it',
  'Your mom\'s recipe turned out amazing',
  'Can\'t wait for the trip next month',
  'Loved the photos you sent',
  'Welcome home! How was the flight?',
  'Proud of you for finishing the marathon',
  'Tell the kids I said hi',
  'Let\'s do brunch this Sunday',
  'Thanks for watching the dog while we were away',
]

const WORK: readonly string[] = [
  'Pushed the fix to staging, can you verify?',
  'Client approved the mockups',
  'Standup moved to 10:30 this week',
  'PR is ready for review',
  'Deploy went through, all green',
  'Retro notes from today\'s session',
  'Updated the roadmap with new priorities',
  'Bug in the checkout flow is fixed',
  'New API key for the sandbox environment',
  'Sprint planning is after lunch',
  'Demo pushed to next Tuesday',
  'Design files uploaded to the shared drive',
  'Test coverage is back up to 90%',
  'Onboarding doc is in the wiki',
  'VPN config for the new office',
  'Slack channel created for the project',
  'Jira board cleaned up for the quarter',
  'CI pipeline is passing again',
  'Credentials for the staging database',
  'Release notes drafted for v2.4',
]

const CASUAL: readonly string[] = [
  'Check out this recipe I found',
  'Watched that show you recommended, so good',
  'Found a great coffee shop on 5th street',
  'New album dropped, you need to hear this',
  'That article you sent was really interesting',
  'Tried the restaurant, the pasta was incredible',
  'Here\'s that playlist I was telling you about',
  'Just finished the book, what an ending',
  'Saw this and thought of you',
  'Rain all week, guess we\'re staying in',
  'Farmers market has amazing peaches right now',
  'Finally fixed the leaky faucet',
  'Scored tickets for the Saturday show',
  'New season starts next week, don\'t forget',
  'Picked up that thing you wanted',
  'Sunset was unreal from the rooftop',
  'Just got the test results, all clear',
  'Found your jacket at my place',
  'Power went out for an hour, everything\'s fine now',
  'That hike was worth every step',
]

const ALL_MESSAGES: readonly string[] = [
  ...LOGISTICS,
  ...SOCIAL,
  ...WORK,
  ...CASUAL,
]

/**
 * Generate a random, plausible decoy message for a decoy note link.
 * Uses crypto.getRandomValues for randomness.
 */
export function generateDecoyMessage(): string {
  return pick(ALL_MESSAGES)
}
