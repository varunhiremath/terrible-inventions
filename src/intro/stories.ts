/**
 * The four stories.
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
      { seconds: 5, scene: 'maze', voice: 'narrator', line: 'Touch anywhere to send yourself that way. No buttons. Just point.' },
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
      { seconds: 5.5, scene: 'dungeon', voice: 'papa', line: 'One hour! For all thirteen! I timed it myself and I laughed.' },
      { seconds: 5.2, scene: 'dungeon', voice: 'narrator', line: 'The clock never stops. Not when you die, not between floors. Never.' },
      { seconds: 7.1, scene: 'dungeon', voice: 'narrator', line: 'Every move is a commitment. Start a running jump and you are going wherever it lands.' },
      { seconds: 6.3, scene: 'dungeon', voice: 'narrator', line: 'Walk, jump, and a careful step for the edges. Guards want the pointy end.' },
      { seconds: 3.4, scene: 'dungeon', voice: 'papa', line: 'Fifty-nine minutes. Fifty-eight. Oh dear.' },
    ],
  },

  pipes: {
    id: 'pipes',
    title: 'THE PIPES',
    beats: [
      { seconds: 4.4, scene: 'pipes', voice: 'narrator', line: 'The pipes under the garden. {papa} filled them with wind-up machines.' },
      { seconds: 6.3, scene: 'pipes', voice: 'papa', line: 'They only walk forwards! That is the beauty of it! No brains at all!' },
      { seconds: 5.9, scene: 'pipes', voice: 'narrator', line: 'Land on one and it is finished. Walk into one and you are.' },
      { seconds: 5.4, scene: 'pipes', voice: 'narrator', line: 'Hold jump for longer and you go higher. That is the whole game, really.' },
      { seconds: 7.1, scene: 'pipes', voice: 'narrator', line: 'Hold RUN to get up to speed. A fast jump goes further than a slow one.' },
      { seconds: 5.9, scene: 'pipes', voice: 'narrator', line: 'Knock the question blocks. A mushroom makes you big enough to break brick.' },
      { seconds: 5.1, scene: 'pipes', voice: 'papa', line: 'The flag is at the far end. Good luck getting there.' },
    ],
  },
}

export const STORY_ORDER = ['arcade', 'dave', 'prince', 'pipes'] as const
