/**
 * The six stories.
 *
 * Every beat shows the game. There used to be a workshop scene with a villain
 * looming in it and a title card on a black plate, and the verdict on both was
 * "it still looks dark and weird... just use snapshots from the game itself if
 * nothing else works". So the villain's lines play over the game he is talking
 * about, and the title lands over it too. The only beat that is not a level is
 * the maths question, because the maths question is not in a level.
 *
 * Each one does the same three jobs in about half a minute: say who the
 * villain is and what he has done, say what you are supposed to do about it,
 * and say which buttons do it. The third is the one that usually gets left out
 * and the one a player actually needs — a story that does not tell you how to
 * play is a story you skip.
 *
 * `{papa}` is filled in with whatever name is set on the device, so the
 * villain has a real name to the person playing and no name at all in here.
 */
import type { Story } from './timeline'

export const STORIES: Record<string, Story> = {
  arcade: {
    id: 'arcade',
    title: 'PAPA PANIC',
    beats: [
      { seconds: 4.4, scene: 'maze', voice: 'narrator', line: 'The maze under the workshop. {papa} has been busy again.' },
      { seconds: 5.9, scene: 'maze', voice: 'papa', line: 'Four of them! Four little machines, and every one of them wants YOU.' },
      { seconds: 5.2, scene: 'maze', voice: 'narrator', line: 'They are loose in the maze now, and they do not get tired.' },
      { seconds: 5.9, scene: 'maze', voice: 'narrator', line: 'Clear every dot. Grab the fruit and they will run from you instead.' },
      { seconds: 5.4, scene: 'maze', voice: 'narrator', line: 'Touch anywhere to send yourself that way. No buttons. Just point.' },
      { seconds: 5.9, scene: 'question', voice: 'narrator', line: 'Caught? The maths door opens. Two minutes of sums buys you another go.' },
      { seconds: 3.4, scene: 'maze', voice: 'papa', line: 'Off you go. I will be watching.' },
    ],
  },

  dave: {
    id: 'dave',
    title: 'THE CAVES',
    beats: [
      { seconds: 5.9, scene: 'cave', voice: 'narrator', line: 'Ten caves under the house. {papa} has hidden a trophy in every one.' },
      { seconds: 4.4, scene: 'cave', voice: 'papa', line: 'Fire! Water! A jetpack I have NOT tested! Enjoy!' },
      { seconds: 5, scene: 'cave', voice: 'narrator', line: 'Take the trophy, then find the door. Not the other way round.' },
      { seconds: 7.8, scene: 'cave', voice: 'narrator', line: 'Left and right by your left thumb. Jump on the right. Both at once for the long ones.' },
      { seconds: 6.3, scene: 'question', voice: 'narrator', line: 'Every cave can be finished. A machine checked them all before you got here.' },
      { seconds: 4.4, scene: 'cave', voice: 'papa', line: 'Mind the spikes. Or do not. Up to you.' },
    ],
  },

  prince: {
    id: 'prince',
    title: 'THE DUNGEON',
    beats: [
      { seconds: 4.6, scene: 'dungeon', voice: 'narrator', line: 'Thirteen floors down, and one hour on the clock.' },
      { seconds: 5.5, scene: 'dungeon', voice: 'papa', line: 'One hour! For all thirteen! Even I could not do that.' },
      { seconds: 5.4, scene: 'dungeon', voice: 'narrator', line: 'The clock never stops. Not when you slip, not between floors. Never.' },
      { seconds: 7.1, scene: 'dungeon', voice: 'narrator', line: 'Every move is a commitment. Start a running jump and you are going wherever it lands.' },
      { seconds: 6.3, scene: 'dungeon', voice: 'narrator', line: 'Walk, jump, and a careful step for the edges. Guards want the pointy end.' },
      { seconds: 3.4, scene: 'dungeon', voice: 'papa', line: 'Fifty-nine minutes. Fifty-eight. Oh dear.' },
    ],
  },

  pipes: {
    id: 'pipes',
    title: 'THE PIPES',
    beats: [
      { seconds: 4.9, scene: 'pipes', voice: 'narrator', line: 'The pipes under the garden. {papa} filled them with wind-up machines.' },
      { seconds: 6.3, scene: 'pipes', voice: 'papa', line: 'They only walk forwards! That is the beauty of it! No brains at all!' },
      { seconds: 5.9, scene: 'pipes', voice: 'narrator', line: 'Land on one and it is finished. Walk into one and you are.' },
      { seconds: 5.4, scene: 'pipes', voice: 'narrator', line: 'Hold jump for longer and you go higher. That is the whole game, really.' },
      { seconds: 7.1, scene: 'pipes', voice: 'narrator', line: 'Hold RUN to get up to speed. A fast jump goes further than a slow one.' },
      { seconds: 5.9, scene: 'pipes', voice: 'narrator', line: 'Knock the question blocks. A mushroom makes you big enough to break brick.' },
      { seconds: 5.1, scene: 'pipes', voice: 'papa', line: 'The flag is at the far end. Good luck getting there.' },
    ],
  },

  road: {
    id: 'road',
    title: 'THE ROAD',
    beats: [
      { seconds: 6.6, scene: 'road', voice: 'narrator', line: 'Four lanes out of town, and {papa} has filled every one of them.' },
      { seconds: 6.6, scene: 'road', voice: 'papa', line: 'And four of mine in the race with you! They never tire! They never blink!' },
      { seconds: 6.0, scene: 'road', voice: 'narrator', line: 'Hold GO to move. Steer with your left thumb. That is all.' },
      { seconds: 6.4, scene: 'road', voice: 'narrator', line: 'Getting to the end is not the job. Getting there first is the job.' },
      { seconds: 6.2, scene: 'road', voice: 'narrator', line: 'Watch the tank. Run it dry and it costs a car, same as a prang.' },
      { seconds: 5.8, scene: 'question', voice: 'narrator', line: 'Pranged? The maths door opens. Sums buy you another go.' },
      { seconds: 4.2, scene: 'road', voice: 'papa', line: 'Level after level. Off you go.' },
    ],
  },
  /*
   * The space story goes out twice as far as it used to.
   *
   * It was written when Neptune was the end of the game, and it said so: eight
   * worlds, and a last line about nobody ever having got that far. Both halves
   * of that are now wrong — he reached Neptune, and there is a second half of
   * the game out past it — so a story that stops at the planets tells a player
   * the game is over at the point it stops being a tour and starts being hard.
   *
   * So the back half of the beats moves to the `deep` scene, which is a
   * different recording of the same game: black hole, aliens in the traffic, a
   * current pushing the ship about. Said and shown, because "it keeps going"
   * is a claim, and a sky that looks nothing like the one three beats ago is
   * the evidence.
   */
  space: {
    id: 'space',
    title: 'THE LONG WAY OUT',
    beats: [
      { seconds: 4.3, scene: 'space', voice: 'narrator', line: 'Eight worlds, in the order you meet them leaving the Sun.' },
      { seconds: 4.3, scene: 'space', voice: 'papa', line: 'I filled the gaps! Rock, scrap, and a few of mine!' },
      { seconds: 3.7, scene: 'space', voice: 'narrator', line: 'Hold FIRE to fire. Steer with your left thumb.' },
      { seconds: 4.7, scene: 'space', voice: 'narrator', line: 'There is always a way through. The purple mines are not it.' },
      { seconds: 4.7, scene: 'space', voice: 'narrator', line: 'Break anything and it drops a cell. Spend them when you land.' },
      { seconds: 4.4, scene: 'deep', voice: 'narrator', line: 'Out past Neptune, the Sun is just another star.' },
      { seconds: 4.7, scene: 'deep', voice: 'papa', line: 'Something lives out here. It shoots back. Not my doing!' },
      { seconds: 4.2, scene: 'deep', voice: 'narrator', line: 'Shoot their shots out of the sky, then shoot them.' },
      { seconds: 4.6, scene: 'deep', voice: 'narrator', line: 'A black hole drags the whole sky sideways. Fly across it.' },
      { seconds: 4.3, scene: 'deep', voice: 'papa', line: 'Stars, nebulae, galaxies. It does not stop. Off you go.' },
    ],
  },

  /*
   * The garden.
   *
   * The one beat that has to land is the ring, because it is the only move in
   * here nobody will find on their own: every other snake game ever made kills
   * you for touching yourself, and this one does not — it gives you what you
   * looped over. Said twice, in two different ways, and shown over a snake
   * long enough to do it.
   */
  snake: {
    id: 'snake',
    title: 'THE GARDEN',
    beats: [
      { seconds: 4.3, scene: 'garden', voice: 'narrator', line: 'A garden, five others in it, and all of you hungry.' },
      { seconds: 4.3, scene: 'garden', voice: 'papa', line: 'I grew them! They grow! Everything grows!' },
      { seconds: 4.1, scene: 'garden', voice: 'narrator', line: 'Hold anywhere and drag. That is the whole control.' },
      { seconds: 4.6, scene: 'garden', voice: 'narrator', line: 'Eat, and you get longer. Longer is the whole idea.' },
      { seconds: 4.8, scene: 'garden', voice: 'narrator', line: 'Touch somebody else and you are finished. Nothing else is.' },
      { seconds: 5.2, scene: 'garden', voice: 'narrator', line: 'Loop round onto your own tail and the loop shuts. That is allowed.' },
      { seconds: 5.0, scene: 'garden', voice: 'narrator', line: 'Whatever is caught inside is yours. It costs you the tail.' },
      { seconds: 4.9, scene: 'garden', voice: 'narrator', line: 'The charms on the ground are worth a detour. All four help.' },
      { seconds: 4.2, scene: 'garden', voice: 'papa', line: 'Go on then. Mind Rust. Off you go.' },
    ],
  },
}

export const STORY_ORDER =
  ['arcade', 'dave', 'prince', 'pipes', 'road', 'space', 'snake'] as const
