/**
 * What {papa} says while chasing his own son round a maze.
 *
 * He is a pantomime villain, not a dry one. The first pass was too clever by
 * half — it read as a grown man being mildly sardonic, which is funny to grown
 * men and to nobody else. These lines are louder, sillier, and full of
 * themselves: {papa} boasts about nothing, takes credit for luck, blames the
 * furniture, and is never, ever gracious.
 *
 * The rules that keep it kind:
 *  - {papa} is pleased with himself, never disappointed in the player.
 *  - The joke is always on {papa}. He is transparently meant to be beaten.
 *  - Nothing is ever about how clever or slow the player is.
 *
 * They are spoken aloud, so they are written to be *said*: short, punchy, and
 * punctuated so the synthesiser gives them some shape. Exclamation marks earn
 * their keep here.
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
    'Behold! The greatest maze runner in this entire house!',
    'I had toast for breakfast. I am unstoppable!',
    'Ha! Off you go, little snack. I will be RIGHT behind you!',
    'Bolt! Cog! Rivet! Formation... whatever that means! Go!',
    'I have trained for this my whole life. Since Tuesday!',
    'Ready? No? Excellent. Begin!',
  ],
  caught: [
    'HA! Got you! Did you see that? Somebody write that down!',
    'Oh no! Oh no! Oh... wait, that was good for me. Never mind!',
    'I did not even move! You ran into me! That still counts!',
    'That is ONE. I am going to need a bigger scoreboard!',
    'You went left. You ALWAYS go left. I have a chart!',
    'Caught! By me! A man who gets tired walking upstairs!',
  ],
  eaten: [
    'AAAH! No! That does not count! The rules are different here!',
    'I LET you do that. Obviously. Clearly. Definitely.',
    'Lucky fruit! Anyone could have done that! A baby could!',
    'I was going that way anyway! I had plans over there!',
    'Right! RIGHT! That is the last time I fall for the old fruit trick!',
    'My hat! You have knocked off my imaginary hat!',
  ],
  nearMiss: [
    'Ooooh! So close!',
    'I felt the wind off you! I need a lie down!',
    'Nearly! NEARLY!',
    'My whiskers! You nearly had my whiskers!',
  ],
  lastLife: [
    'One life left! Do not think about that! Think about anything else!',
    'Ooh, this is the exciting bit! I have got snacks!',
    'Careful now... I am doing my scary walk!',
    'Last one! I am not nervous! YOU are nervous!',
  ],
  gameOver: [
    'And THAT is why they call me... um. Nobody calls me anything. Yet!',
    'Beaten by your own father! I am going to tell everyone!',
    'Victory! I shall celebrate by having a sit down!',
    'You can buy another go, you know. I would. I definitely would.',
  ],
  levelDone: [
    'Fine! FINE! That was... fine. I am not upset. I am FINE.',
    'You cleared it! I am NOT saying well done! I am saying words near it!',
    'Beginner luck! Twice! That is a thing! Look it up!',
    'Right. The next one is harder. I made it harder. With my hands!',
    'Pfff! I was barely trying! I was thinking about lunch!',
  ],
  shopping: [
    'Buying your way out of trouble! I respect it! I hate it! Both!',
    'Go on then! Earn something! Show off!',
    'Shopping! In MY maze! The cheek of it!',
    'I would not bother. But... go on.',
  ],
}

export function taunt(moment: TauntMoment, roll = Math.random()): string {
  const lines = TAUNTS[moment]
  return lines[Math.floor(roll * lines.length) % lines.length]
}
