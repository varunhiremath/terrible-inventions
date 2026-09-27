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
 * And one more, added after the person these are for got upset by them, which
 * is the only test of this that counts:
 *
 *  - **At the moment the player loses, {papa} does not gloat.** Not once, not
 *    even in fun. He is a pantomime villain everywhere else and the losing
 *    screen is not everywhere else: it is the screen somebody reads while
 *    feeling bad, and a joke read at that moment is not read as a joke.
 *
 * So the lines for being caught, and for running out, are the gentlest in the
 * file. {papa} is startled, or apologetic, or immediately distracted by
 * something about himself — and every one of them points at going again.
 * Nothing keeps score against the player, nothing tells anybody else, and
 * nothing is ever a comparison. One line here said "Beaten by your own father!
 * I am going to tell everyone!" and it is the reason this paragraph exists.
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
    'Oh! Sorry! I was standing there thinking about biscuits!',
    'Whoops! Did not mean to be in the way. Well. A bit.',
    'That corner is far too narrow. I blame whoever built it. Me.',
    'Argh, we bumped! Go on, off you go again.',
    'Caught! By me! A man who gets tired walking upstairs!',
    'Oh no, are you all right? I mean... AHEM. Ha! Yes! Anyway!',
  ],
  eaten: [
    'AAAH! No! That does not count! The rules are different here!',
    'I LET you do that. Obviously. Clearly. Definitely.',
    'Lucky fruit! That fruit was on MY side! Traitor!',
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
    'Ooh, this is the exciting bit! I have got snacks!',
    'Careful now... I am doing my scary walk!',
    'Last one! I am not nervous! I am extremely nervous!',
    'This is the bit where you usually beat me. I hate this bit!',
  ],
  gameOver: [
    'Well, that maze was a horror. I should know. I built it. Again?',
    'Right! Rematch! I demand a rematch! I am enjoying this!',
    'Do not look at me like that. Have another go, go on.',
    'That one was hard. Even I think that one was hard. Again?',
    'Phew! I need a sit down. You have a go while I recover!',
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
    'Good idea. Not that I am helping. I am NOT helping.',
    'Go on then! Earn something! Show off!',
    'Shopping! In MY maze! The cheek of it!',
    'I would not bother. But... go on.',
  ],
}

export function taunt(moment: TauntMoment, roll = Math.random()): string {
  const lines = TAUNTS[moment]
  return lines[Math.floor(roll * lines.length) % lines.length]
}
