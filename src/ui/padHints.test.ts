import { describe, expect, it } from 'vitest'
import { FADE, HOLD, LABELS, hintAlpha } from './padHints'
import { padLayout } from '../arcade/dungeon/controls'

describe('the button labels', () => {
  it('is readable at the moment a level starts', () => {
    expect(hintAlpha(0)).toBe(1)
    expect(hintAlpha(HOLD - 0.01)).toBe(1)
  })

  it('goes away on its own', () => {
    // The whole point is that it leaves. A hint that stays is furniture.
    expect(hintAlpha(HOLD + FADE)).toBe(0)
    expect(hintAlpha(60)).toBe(0)
  })

  it('fades rather than vanishing', () => {
    const mid = hintAlpha(HOLD + FADE / 2)
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThan(1)
  })

  it('never goes outside what an alpha can be', () => {
    for (let t = -1; t < 20; t += 0.1) {
      const a = hintAlpha(t)
      expect(a, `at ${t}`).toBeGreaterThanOrEqual(0)
      expect(a, `at ${t}`).toBeLessThanOrEqual(1)
    }
  })

  it('stays on screen long enough to actually read', () => {
    expect(HOLD).toBeGreaterThanOrEqual(3)
  })

  it('names every button each game can show', () => {
    // A button with no label is the exact problem this is here to fix.
    const shown: Record<string, string[]> = {
      dungeon: ['left', 'right', 'care', 'down', 'up', 'parry', 'strike'],
      pipes: ['left', 'right', 'run', 'jump'],
      dave: ['left', 'right', 'up', 'fire', 'down'],
    }
    for (const [game, ids] of Object.entries(shown)) {
      for (const id of ids) {
        expect(LABELS[game][id], `${game}.${id}`).toBeTruthy()
      }
    }
  })

  it('keeps them short enough to sit over a button', () => {
    for (const [game, labels] of Object.entries(LABELS)) {
      for (const [id, text] of Object.entries(labels)) {
        expect(text.length, `${game}.${id}`).toBeLessThanOrEqual(11)
      }
    }
  })
})

describe('the dungeon pad changing under you', () => {
  /*
   * The labels restart whenever the set of buttons changes, and the dungeon is
   * the only game where that happens mid-level: meeting a guard swaps two of
   * the buttons for a shield and a sword. Those are the two nobody could find,
   * because they do not exist until a fight starts — asked as "what button is
   * used to fight?".
   */
  const ids = (fighting: boolean) => padLayout(900, 500, fighting).map((k) => k.id).join(',')

  it('is a different set of buttons in a fight', () => {
    // If these ever matched, the labels would not re-announce themselves and
    // the fighting buttons would arrive unnamed all over again.
    expect(ids(true)).not.toBe(ids(false))
  })

  it('offers something to block and something to strike with', () => {
    const fighting = padLayout(900, 500, true).map((k) => k.id)
    expect(fighting).toContain('parry')
    expect(fighting).toContain('strike')
  })

  it('names every button on both pads', () => {
    for (const fighting of [false, true]) {
      for (const key of padLayout(900, 500, fighting)) {
        expect(LABELS.dungeon[key.id], `${fighting ? 'duel' : 'normal'}: ${key.id}`).toBeTruthy()
      }
    }
  })
})
