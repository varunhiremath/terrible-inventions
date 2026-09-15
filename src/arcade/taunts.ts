/**
 * What {papa} says while chasing his own son round a maze.
 *
 * Smug and beatable. He gloats, he is a terrible loser, and he is transparently
 * meant to be beaten — the joke only works if losing to him stings a little and
 * beating him is obviously the point. Nothing here is ever disappointed in the
 * player; {papa} is only ever pleased with himself.
 */

export type TauntMoment =
  | 'levelStart'
  | 'caught'
  | 'eaten'
  | 'nearMiss'
  | 'lastLife'
  | 'gameOver'
  | 'levelDone'
  | 'shopping'

export const TAUNTS: Record<TauntMoment, readonly string[]> = {
  levelStart: [
    'Try to keep up.',
    'I have been practising. You have not.',
    'Off you go. I will be right behind you.',
    'Bolt, Cog, Rivet — spread out. He is quicker than he looks.',
  ],
  caught: [
    'Got you. Again.',
    'Oh dear. Was that your plan?',
    'I barely moved and you walked into me.',
    'That is one. Shall we make it two?',
    'You went left. You always go left.',
  ],
  eaten: [
    'That does not count.',
    'I let you do that.',
    'Lucky pellet. Anyone could have done that.',
    'I was going that way anyway.',
    'Right. That is the last time I fall for it.',
  ],
  nearMiss: [
    'Close.',
    'Ooh, nearly.',
    'I felt the wind off you there.',
  ],
  lastLife: [
    'One left. No pressure.',
    'This is the interesting bit.',
    'Careful now. I do enjoy this part.',
  ],
  gameOver: [
    'And that is that. Shall we stop there?',
    'Beaten by your own father. Again.',
    'You can always buy yourself another go, you know.',
  ],
  levelDone: [
    'Fine. That was... fine.',
    'You cleared it. I am not saying well done.',
    'Beginner’s luck. Twice.',
    'Right. The next one is harder. I made sure.',
  ],
  shopping: [
    'Buying your way out of trouble, I see.',
    'Go on then. Earn something.',
    'I would not bother. But go on.',
  ],
}

export function taunt(moment: TauntMoment, roll = Math.random()): string {
  const lines = TAUNTS[moment]
  return lines[Math.floor(roll * lines.length) % lines.length]
}
