import { describe, expect, it } from 'vitest'
import { PAPA, pickVoice, profileFor } from './speech'

/** Enough of a SpeechSynthesisVoice to choose between. */
const voice = (name: string, lang = 'en-GB') =>
  ({ name, lang, default: false, localService: true, voiceURI: name }) as SpeechSynthesisVoice

describe('choosing a voice', () => {
  it('takes a named male voice when the platform has one', () => {
    const all = [voice('Samantha', 'en-US'), voice('Daniel'), voice('Karen', 'en-AU')]
    expect(pickVoice(all)!.name).toBe('Daniel')
  })

  it('prefers the best-sounding male voice over a later one', () => {
    const all = [voice('Fred', 'en-US'), voice('Google UK English Male')]
    expect(pickVoice(all)!.name).toBe('Google UK English Male')
  })

  it('reads male off the name when it has nothing better', () => {
    const all = [voice('Karen', 'en-AU'), voice('English Male 2', 'en-US')]
    expect(pickVoice(all)!.name).toBe('English Male 2')
  })

  it('is not fooled by the word female', () => {
    const all = [voice('English Female 1'), voice('Some Other Voice')]
    expect(pickVoice(all)!.name).toBe('Some Other Voice')
  })

  it('skips the voices it knows are not male', () => {
    const all = [voice('Moira'), voice('Tessa'), voice('Rishi')]
    expect(pickVoice(all)!.name).toBe('Rishi')
  })

  it('prefers an English voice to a better-named foreign one', () => {
    const all = [voice('Jorge', 'es-ES'), voice('Unknown Voice', 'en-US')]
    expect(pickVoice(all)!.name).toBe('Unknown Voice')
  })

  it('takes a female voice rather than going silent', () => {
    // A wrong-sounding voice beats no voice at all.
    expect(pickVoice([voice('Samantha', 'en-US')])!.name).toBe('Samantha')
  })

  it('copes with a platform that offers nothing', () => {
    expect(pickVoice([])).toBeUndefined()
  })

  it('copes with a voice missing its language', () => {
    const odd = { name: 'Nameless' } as SpeechSynthesisVoice
    expect(pickVoice([odd])!.name).toBe('Nameless')
  })
})

describe('how the lines are delivered', () => {
  it('gives Papa a low, brisk voice', () => {
    expect(PAPA.pitch).toBeLessThan(0.9)
    expect(PAPA.rate).toBeGreaterThan(1)
  })

  it('keeps every character inside a rate a child can follow', () => {
    for (let seed = 0; seed < 200; seed++) {
      const p = profileFor(seed)
      expect(p.rate).toBeGreaterThan(0.85)
      expect(p.rate).toBeLessThan(1.15)
      expect(p.pitch).toBeGreaterThan(0.6)
      expect(p.pitch).toBeLessThan(1.7)
    }
  })
})
