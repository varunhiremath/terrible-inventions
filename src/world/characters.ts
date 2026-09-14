import type { GeneratorId } from '../engine/types'
import type { Point } from './map'

/**
 * Who lives in the wing.
 *
 * Each machine is a person with a problem, not a category with a label. That is
 * the whole difference between "Rectangle Hunt" in a list and Kettle standing in
 * the kitchen telling you he has boiled himself solid. The maths underneath is
 * identical; the reason to care is not.
 *
 * Every machine's fault is chosen to match the problems its mission serves, so
 * helping it is the same act as understanding the thing.
 */

export interface Machine {
  id: string
  name: string
  at: Point
  /** Fixes the sprite, so it is the same machine forever. */
  seed: number
  /** What the mission is called, in the player's own words. */
  mission: string
  /** Problem kinds this mission draws from. */
  kinds: GeneratorId[]
  length: number
  /** Said when you walk up to it, still broken. */
  broken: string[]
  /** Said the moment it is fixed. */
  success: string[]
  /** Said on every visit afterwards, picked at random. */
  working: string[]
}

export const MACHINES: readonly Machine[] = [
  {
    id: 'kettle',
    name: 'Kettle',
    at: { x: 7, y: 4 },
    seed: 10427,
    mission: 'Unboil Kettle',
    kinds: ['fraction-duel'],
    length: 4,
    broken: [
      'Oh good. Someone. I have boiled myself completely solid.',
      "{papa} set me to maximum and then went outside to look at a bird.",
      'I used to be the one who shared things out fairly. Half each. Two thirds, one third. That sort of thing.',
      'Now I just get hot. Remind me which share is bigger and I think I can cool down.',
    ],
    success: [
      'Oh. OH. Thirds. It was thirds all along.',
      'I feel enormously less solid. Thank you.',
    ],
    working: [
      'Pleasantly lukewarm. Exactly as intended.',
      'I check my own dial hourly now. You cannot be too careful.',
      'Ask me to divide anything. Go on.',
    ],
  },
  {
    id: 'trundle',
    name: 'Trundle',
    at: { x: 22, y: 4 },
    seed: 55291,
    mission: 'Get Trundle moving',
    kinds: ['path-count'],
    length: 4,
    broken: [
      'I am a delivery bot. Deliveries are the thing I do.',
      '{papa} gave me wheels that turn two ways. Right, and down. That is the complete list.',
      'I used to know how many ways there were to get anywhere. Every single route.',
      'Now I just sit here. Count the ways through for me and I will be off.',
    ],
    success: [
      'TWENTY. There were twenty ways. I knew it was a number.',
      'Right. Deliveries. At last.',
    ],
    working: [
      'Still right and down only. I have made my peace with it.',
      'Seven parcels today. All of them to that corner.',
      'Do not tell {papa} I can count again. He will add a wheel.',
    ],
  },
  {
    id: 'sparks',
    name: 'Sparks',
    at: { x: 36, y: 4 },
    seed: 88123,
    mission: "Find {papa}'s mistake",
    kinds: ['papas-mistake'],
    length: 4,
    broken: [
      'You are the one who checks his sums. I have heard about you.',
      '{papa} does his working out on my casing. In permanent marker.',
      'One line of it is always wrong. Always exactly one. I can feel it.',
      'Find where it first goes wrong and I can finally scrub the lot off.',
    ],
    success: [
      'THAT line. I have been staring at that line for a month.',
      'Twenty years of bad arithmetic, off my chest.',
    ],
    working: [
      'Clean casing. You can see your face in it.',
      'He tried to write on me again this morning. I rolled away.',
      'Any time he shows you working, check the third line. It is usually the third line.',
    ],
  },
]

/** Where {papa} stands, being unhelpful. */
export const PAPA_AT: Point = { x: 12, y: 10 }

/** What {papa} says in the corridor, by how much of the wing is working. */
export const PAPA_LINES = {
  none: [
    'Ah, you found the wing. It is a bit of a state.',
    'Three of them broke at once. I maintain that was a coincidence.',
    'Do not start with Sparks. Sparks is cross with me.',
  ],
  some: [
    'One down. I genuinely did not think that one was fixable.',
    'They are talking to each other again. That is new.',
    'Keep going. The door at the end has been shut for years.',
  ],
  all: [
    'All three. Look at them go.',
    'Right. The far door. I have not been through it since the incident.',
    'After you. I insist. Entirely because of the door, not because I am frightened.',
  ],
} as const

export function machineAt(point: Point): Machine | undefined {
  return MACHINES.find((m) => m.at.x === point.x && m.at.y === point.y)
}

export function isPapaAt(point: Point): boolean {
  return PAPA_AT.x === point.x && PAPA_AT.y === point.y
}

/** The wing's door opens only when every machine in it is working. */
export function wingComplete(fixed: readonly string[]): boolean {
  return MACHINES.every((m) => fixed.includes(m.id))
}
