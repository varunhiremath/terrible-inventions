/**
 * What {papa} says, and when.
 *
 * Recorded in the app's own booth (Settings > Record your voice) and kept on
 * the device. Several variants per cue, picked at random, because one clip
 * heard forty times stops being a person and becomes a sound effect.
 *
 * Two rules govern the writing, both from the design notes in README:
 *
 *   - {papa} is never disappointed. A wrong answer is met with fellow-feeling,
 *     usually because he got it wrong too.
 *   - Praise is for what the player did, never for what he is. "Nice bit of
 *     thinking" survives; "you're so clever" does not.
 */

export type Cue =
  | 'greeting'
  | 'struggle'
  | 'wrong'
  | 'right'
  | 'hint'
  | 'stretch'
  | 'ceiling'
  | 'goodbye'

export interface VoiceLine {
  /** Stable id — the storage key and the filename. Never renumber these. */
  id: string
  cue: Cue
  text: string
  /** Shown in the booth when delivery matters more than the words. */
  direction?: string
}

export const CUE_TITLES: Record<Cue, string> = {
  greeting: 'Opening the workshop',
  struggle: 'Admitting it is hard',
  wrong: 'When he gets it wrong',
  right: 'When he gets it right',
  hint: 'Offering a nudge',
  stretch: 'Warning him it is a hard one',
  ceiling: 'The hardest things in here',
  goodbye: 'Closing up',
}

export const CUE_NOTES: Partial<Record<Cue, string>> = {
  struggle:
    'The most valuable group here. A child who is used to finding things easy needs to hear that the adult he respects finds things hard too. Say these plainly, not as a pep talk.',
  wrong:
    'Never sound let down. Warm, a bit conspiratorial — you fell for it as well.',
  right:
    'Praise the thinking, not the child. Pleased, not amazed. Sounding amazed implies you expected worse.',
}

export const VOICE_LINES: readonly VoiceLine[] = [
  { id: 'greeting-1', cue: 'greeting', text: 'There you are. Something is smoking in the corner again.' },
  { id: 'greeting-2', cue: 'greeting', text: 'Good, you are here. I have made everything worse.' },
  { id: 'greeting-3', cue: 'greeting', text: 'Right. Nothing works and I do not know why.' },
  { id: 'greeting-4', cue: 'greeting', text: 'Ah, perfect timing. Ignore the noise.' },

  { id: 'struggle-1', cue: 'struggle', text: 'This one took me twenty minutes. Twenty.' },
  { id: 'struggle-2', cue: 'struggle', text: 'I got this wrong twice before I saw it.' },
  { id: 'struggle-3', cue: 'struggle', text: 'Take your time. I certainly did.' },
  { id: 'struggle-4', cue: 'struggle', text: 'I had to draw this one out on paper. No shame in that.', direction: 'Matter of fact. This is information, not encouragement.' },
  { id: 'struggle-5', cue: 'struggle', text: 'Honestly? I still have to think about this one.' },
  { id: 'struggle-6', cue: 'struggle', text: 'Being stuck is fine. Stuck is where the thinking happens.' },

  { id: 'wrong-1', cue: 'wrong', text: 'Nope. Mind you, I would have said the same.' },
  { id: 'wrong-2', cue: 'wrong', text: 'Not that one. I like how you got there, though.' },
  { id: 'wrong-3', cue: 'wrong', text: 'Ah, no. That is exactly the trap I fell into.' },
  { id: 'wrong-4', cue: 'wrong', text: 'Wrong, but wrong in a sensible way.' },
  { id: 'wrong-5', cue: 'wrong', text: 'Not quite. Have another look at what it is actually asking.' },
  { id: 'wrong-6', cue: 'wrong', text: 'No. But that is the interesting kind of wrong.' },

  { id: 'right-1', cue: 'right', text: 'That is it.' },
  { id: 'right-2', cue: 'right', text: 'Yes. How did you see that so fast?' },
  { id: 'right-3', cue: 'right', text: 'Correct. And you worked it out, you did not guess.' },
  { id: 'right-4', cue: 'right', text: 'There it is. Nice bit of thinking.' },
  { id: 'right-5', cue: 'right', text: 'Got it. That was the hard one.' },
  { id: 'right-6', cue: 'right', text: 'Yep. I would have needed paper for that.' },

  { id: 'hint-1', cue: 'hint', text: 'All right, here is a nudge.' },
  { id: 'hint-2', cue: 'hint', text: 'Want a push? Here.' },
  { id: 'hint-3', cue: 'hint', text: 'Let me point at the useful bit.' },
  { id: 'hint-4', cue: 'hint', text: 'Try looking at it this way.' },

  { id: 'stretch-1', cue: 'stretch', text: 'Careful. This one is above your level, on purpose.' },
  { id: 'stretch-2', cue: 'stretch', text: 'This is a hard one. Most people miss it. Have a go anyway.' },
  { id: 'stretch-3', cue: 'stretch', text: 'Right, I have no idea whether you will get this. Let us find out.' },
  { id: 'stretch-4', cue: 'stretch', text: 'Warning. This one is nasty. Missing it is completely fine.' },

  { id: 'ceiling-1', cue: 'ceiling', text: 'This is the hardest thing in the whole workshop.' },
  { id: 'ceiling-2', cue: 'ceiling', text: 'Nobody expects you to get this one. Including me.' },
  { id: 'ceiling-3', cue: 'ceiling', text: 'You have run out of easy. That is a good problem to have.' },

  { id: 'goodbye-1', cue: 'goodbye', text: 'Right, that will do. Good work today.' },
  { id: 'goodbye-2', cue: 'goodbye', text: 'Workshop is closed. See you tomorrow.' },
  { id: 'goodbye-3', cue: 'goodbye', text: 'Good session. Go and do something else now.' },
  { id: 'goodbye-4', cue: 'goodbye', text: 'That is enough machines for one day.' },
]

export const CUES = Object.keys(CUE_TITLES) as Cue[]

export function linesFor(cue: Cue): VoiceLine[] {
  return VOICE_LINES.filter((l) => l.cue === cue)
}
