import { describe, expect, it } from 'vitest'
import { emptyBoard, isComplete, matchesSolution, placeValue } from './board'

describe('board', () => {
  it('starts empty', () => {
    const board = emptyBoard(2, 3)
    expect(board).toHaveLength(2)
    expect(board[0]).toEqual([null, null, null])
    expect(isComplete(board)).toBe(false)
  })

  it('places a value', () => {
    expect(placeValue([null, null, null], 1, 2)).toEqual([null, 2, null])
  })

  it('takes a value off whoever held it', () => {
    // Machine 0 was red; machine 2 claims red, so machine 0 is cleared.
    expect(placeValue([0, 1, null], 2, 0)).toEqual([null, 1, 0])
  })

  it('lets a machine change its mind without disturbing anyone', () => {
    expect(placeValue([0, 1, 2], 1, 1)).toEqual([0, 1, 2])
    expect(placeValue([0, 1, 2], 0, 0)).toEqual([0, 1, 2])
  })

  it('never lets two machines hold the same value', () => {
    let row: (number | null)[] = [null, null, null, null]
    for (const [subject, value] of [[0, 1], [1, 1], [2, 1], [3, 2], [1, 2]] as const) {
      row = placeValue(row, subject, value)
      const held = row.filter((v): v is number => v !== null)
      expect(new Set(held).size).toBe(held.length)
    }
  })

  it('knows when every machine is placed', () => {
    expect(isComplete([[0, 1], [1, 0]])).toBe(true)
    expect(isComplete([[0, 1], [1, null]])).toBe(false)
  })

  it('only accepts an exactly right board', () => {
    const solution = [
      [0, 1, 2],
      [2, 0, 1],
    ]
    expect(matchesSolution([[0, 1, 2], [2, 0, 1]], solution)).toBe(true)
    expect(matchesSolution([[0, 1, 2], [2, 1, 0]], solution)).toBe(false)
    expect(matchesSolution([[0, 1, null], [2, 0, 1]], solution)).toBe(false)
  })
})
