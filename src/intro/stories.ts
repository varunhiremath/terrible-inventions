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
      { seconds: 4.2, scene: 'maze', voice: 'narrator', line: 'The maze under the workshop. {papa} has been busy again.' },
      { seconds: 5.3, scene: 'maze', voice: 'papa', line: 'Four of them! Four little machines, and every one of them wants YOU.' },
      { seconds: 5.3, scene: 'maze', voice: 'narrator', line: 'They are loose in the maze now, and they do not get tired.' },
      { seconds: 5.3, scene: 'maze', voice: 'narrator', line: 'Clear every dot. Grab the fruit and they will run from you instead.' },
      { seconds: 5.5, scene: 'maze', voice: 'narrator', line: 'Touch anywhere to send yourself that way. No buttons. Just point.' },
      { seconds: 5.3, scene: 'question', voice: 'narrator', line: 'Caught? The maths door opens. Two minutes of sums buys you another go.' },
      { seconds: 3.0, scene: 'maze', voice: 'papa', line: 'Off you go. I will be watching.' },
    ],
  },

  dave: {
    id: 'dave',
    title: 'THE CAVES',
    beats: [
      { seconds: 5.3, scene: 'cave', voice: 'narrator', line: 'Ten caves under the house. {papa} has hidden a trophy in every one.' },
      { seconds: 4.1, scene: 'cave', voice: 'papa', line: 'Fire! Water! A jetpack I have NOT tested! Enjoy!' },
      { seconds: 5, scene: 'cave', voice: 'narrator', line: 'Take the trophy, then find the door. Not the other way round.' },
      { seconds: 7.3, scene: 'cave', voice: 'narrator', line: 'Left and right by your left thumb. Jump on the right. Both at once for the long ones.' },
      { seconds: 5.7, scene: 'question', voice: 'narrator', line: 'Every cave can be finished. A machine checked them all before you got here.' },
      { seconds: 3.8, scene: 'cave', voice: 'papa', line: 'Mind the spikes. Or do not. Up to you.' },
    ],
  },

  prince: {
    id: 'prince',
    title: 'THE DUNGEON',
    beats: [
      { seconds: 4.0, scene: 'dungeon', voice: 'narrator', line: 'Thirteen floors down, and one hour on the clock.' },
      { seconds: 4.6, scene: 'dungeon', voice: 'papa', line: 'One hour! For all thirteen! Even I could not do that.' },
      { seconds: 5.4, scene: 'dungeon', voice: 'narrator', line: 'The clock never stops. Not when you slip, not between floors. Never.' },
      { seconds: 6.5, scene: 'dungeon', voice: 'narrator', line: 'Every move is a commitment. Start a running jump and you are going wherever it lands.' },
      { seconds: 5.8, scene: 'dungeon', voice: 'narrator', line: 'Walk, jump, and a careful step for the edges. Guards want the pointy end.' },
      { seconds: 4.3, scene: 'dungeon', voice: 'papa', line: 'Fifty-nine minutes. Fifty-eight. Oh dear.' },
    ],
  },

  pipes: {
    id: 'pipes',
    title: 'THE PIPES',
    beats: [
      { seconds: 4.9, scene: 'pipes', voice: 'narrator', line: 'The pipes under the garden. {papa} filled them with wind-up machines.' },
      { seconds: 5.7, scene: 'pipes', voice: 'papa', line: 'They only walk forwards! That is the beauty of it! No brains at all!' },
      { seconds: 5.3, scene: 'pipes', voice: 'narrator', line: 'Land on one and it is finished. Walk into one and you are.' },
      { seconds: 5.7, scene: 'pipes', voice: 'narrator', line: 'Hold jump for longer and you go higher. That is the whole game, really.' },
      { seconds: 6.5, scene: 'pipes', voice: 'narrator', line: 'Hold RUN to get up to speed. A fast jump goes further than a slow one.' },
      { seconds: 5.3, scene: 'pipes', voice: 'narrator', line: 'Knock the question blocks. A mushroom makes you big enough to break brick.' },
      { seconds: 4.6, scene: 'pipes', voice: 'papa', line: 'The flag is at the far end. Good luck getting there.' },
    ],
  },

  road: {
    id: 'road',
    title: 'THE ROAD',
    beats: [
      { seconds: 5.3, scene: 'road', voice: 'narrator', line: 'Four lanes out of town, and {papa} has filled every one of them.' },
      { seconds: 6.1, scene: 'road', voice: 'papa', line: 'And four of mine in the race with you! They never tire! They never blink!' },
      { seconds: 5.0, scene: 'road', voice: 'narrator', line: 'Hold GO to move. Steer with your left thumb. That is all.' },
      { seconds: 5.7, scene: 'road', voice: 'narrator', line: 'Getting to the end is not the job. Getting there first is the job.' },
      { seconds: 6.1, scene: 'road', voice: 'narrator', line: 'Watch the tank. Run it dry and it costs a car, same as a prang.' },
      { seconds: 4.7, scene: 'question', voice: 'narrator', line: 'Pranged? The maths door opens. Sums buy you another go.' },
      { seconds: 2.7, scene: 'road', voice: 'papa', line: 'Level after level. Off you go.' },
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
      { seconds: 4.6, scene: 'space', voice: 'narrator', line: 'Eight worlds, in the order you meet them leaving the Sun.' },
      { seconds: 4.6, scene: 'space', voice: 'papa', line: 'I filled the gaps! Rock, scrap, and a few of mine!' },
      { seconds: 3.8, scene: 'space', voice: 'narrator', line: 'Hold FIRE to fire. Steer with your left thumb.' },
      { seconds: 5.0, scene: 'space', voice: 'narrator', line: 'There is always a way through. The purple mines are not it.' },
      { seconds: 4.6, scene: 'space', voice: 'narrator', line: 'Everything you break drops a cell. Spend it when you land.' },
      { seconds: 3.9, scene: 'deep', voice: 'narrator', line: 'Out past Neptune, the Sun is just another star.' },
      { seconds: 4.2, scene: 'deep', voice: 'papa', line: 'Something lives out here. It shoots back. Not my doing!' },
      { seconds: 3.0, scene: 'deep', voice: 'narrator', line: 'Shoot their shots down, then shoot them.' },
      { seconds: 4.7, scene: 'deep', voice: 'narrator', line: 'A black hole drags the whole sky sideways. Fly across it.' },
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
      { seconds: 4.2, scene: 'garden', voice: 'narrator', line: 'A garden, others in it, and all of you hungry.' },
      { seconds: 3.0, scene: 'garden', voice: 'papa', line: 'I grew them! They grow! Everything grows!' },
      { seconds: 3.8, scene: 'garden', voice: 'narrator', line: 'Hold anywhere and drag. That is the whole control.' },
      { seconds: 4.2, scene: 'garden', voice: 'narrator', line: 'Eat, and you get longer. Longer is the whole idea.' },
      { seconds: 3.8, scene: 'garden', voice: 'narrator', line: 'Touch somebody else and you are finished.' },
      { seconds: 4.4, scene: 'garden', voice: 'narrator', line: 'Loop onto your own tail and the loop shuts instead.' },
      { seconds: 5.0, scene: 'garden', voice: 'narrator', line: 'What is inside is yours. The loop always costs you the tail.' },
      { seconds: 4.4, scene: 'garden', voice: 'narrator', line: 'Each garden asks for one thing. The top says what.' },
      { seconds: 3.6, scene: 'garden', voice: 'narrator', line: 'The charms are worth a detour.' },
      { seconds: 4.2, scene: 'garden', voice: 'narrator', line: 'Later gardens have thorns in them. Mind those.' },
      { seconds: 3.4, scene: 'garden', voice: 'papa', line: 'Go on then. Mind Rust. Off you go.' },
    ],
  },

  /*
   * The wall.
   *
   * The one thing worth saying twice is the charms: a brick that drops
   * something is the difference between this and every other bat-and-ball
   * game, and a player who does not know to go and catch them will watch them
   * fall past and never find out what they were.
   */
  bricks: {
    id: 'bricks',
    title: 'THE WALL',
    beats: [
      { seconds: 4.2, scene: 'wall', voice: 'narrator', line: 'A bat, a ball, and a wall in the way.' },
      { seconds: 3.8, scene: 'wall', voice: 'papa', line: 'I built it! Some of it twice! Good luck!' },
      { seconds: 4.6, scene: 'wall', voice: 'narrator', line: 'Slide to move the bat. Tap to let the ball go.' },
      { seconds: 6.1, scene: 'wall', voice: 'narrator', line: 'Where it lands on the bat is where it goes. The ends send it wide.' },
      { seconds: 5.1, scene: 'wall', voice: 'narrator', line: 'Silver takes two goes. Gold takes three. Grey never breaks.' },
      { seconds: 5.0, scene: 'charms', voice: 'narrator', line: 'A few bricks drop one of these. Catch it with the bat.' },
      { seconds: 3.6, scene: 'charms', voice: 'narrator', line: 'Ten of them help you.' },
      { seconds: 4.6, scene: 'charms', voice: 'narrator', line: 'The two red ones do not. Let those go past.' },
      { seconds: 4.4, scene: 'charms', voice: 'narrator', line: 'The name flashes up when you catch one.' },
      { seconds: 3.4, scene: 'wall', voice: 'papa', line: 'The walls get worse. Obviously. Off you go.' },
    ],
  },

  /*
   * The flood.
   *
   * The one thing that has to land is that a wrong tap is not a punishment.
   * Everything about the shape of this game says "match three, and do not get
   * it wrong" — and a player who believes a mistake costs a life will stare at
   * one block for ten seconds while the water comes up, which is the exact
   * opposite of what it is for. So it is said plainly, early, and in the
   * gentlest words that are still true.
   */
  sums: {
    id: 'sums',
    title: 'PAPA DROWNING!',
    beats: [
      { seconds: 4.4, scene: 'flood', voice: 'narrator', line: 'A wall of numbers, and Papa in the tank above it.' },
      { seconds: 3.8, scene: 'flood', voice: 'papa', line: 'I was only fixing the pipe! It won!' },
      { seconds: 5.0, scene: 'flood', voice: 'narrator', line: 'Drag along a line that is true. Across, or down.' },
      { seconds: 4.4, scene: 'flood', voice: 'narrator', line: 'Two plus three equals five is five blocks.' },
      { seconds: 4.8, scene: 'flood', voice: 'narrator', line: 'Runs of numbers count too. Doubling. Square numbers.' },
      { seconds: 5.0, scene: 'flood', voice: 'narrator', line: 'They go green while you hold them, so you can feel about.' },
      { seconds: 4.4, scene: 'flood', voice: 'narrator', line: 'Being wrong costs almost nothing. Looking is the game.' },
      { seconds: 4.6, scene: 'flood', voice: 'narrator', line: 'A long one takes the whole row and column with it.' },
      { seconds: 4.2, scene: 'flood', voice: 'narrator', line: 'Every block you break drains the tank a bit.' },
      { seconds: 3.8, scene: 'flood', voice: 'papa', line: 'Get me out. Please. Fairly soon.' },
    ],
  },

  puzzles: {
    id: 'puzzles',
    title: 'THE NOTEBOOK',
    beats: [
      { seconds: 4.4, scene: 'oneline', voice: 'narrator', line: 'A notebook, and every page of it is a puzzle.' },
      { seconds: 3.8, scene: 'oneline', voice: 'papa', line: 'I did them all! Some of them twice!' },
      { seconds: 4.8, scene: 'oneline', voice: 'narrator', line: 'Put a finger on it and drag. Do not lift it off.' },
      { seconds: 4.8, scene: 'oneline', voice: 'narrator', line: 'And never along a line you have already drawn.' },
      { seconds: 4.4, scene: 'throughit', voice: 'narrator', line: 'The next page is a maze. Trace the way out.' },
      { seconds: 4.8, scene: 'throughit', voice: 'narrator', line: 'Go back along your own line to rub it out.' },
      { seconds: 4.6, scene: 'joined', voice: 'narrator', line: 'Then join each dot up with the one that matches.' },
      { seconds: 4.8, scene: 'joined', voice: 'narrator', line: 'No crossing, and every square has to be filled.' },
      { seconds: 4.4, scene: 'joined', voice: 'papa', line: 'Nothing is chasing you here. Take as long as you like.' },
    ],
  },
}

export const STORY_ORDER =
  ['arcade', 'dave', 'prince', 'pipes', 'road', 'space', 'snake', 'bricks', 'sums', 'puzzles'] as const
