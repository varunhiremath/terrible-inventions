import { useEffect, useState } from 'react'
import { TileWorld } from '../world/TileWorld'
import { PAPA_PALETTE, PAPA_SEED, type Scene } from '../world/render'
import { HOUSE, roomByNumber, roomContaining } from '../hunt/house'
import { isSolidIn } from '../hunt/house-solid'
import { roomsUnlocked } from '../hunt/hunt'
import { fill } from '../config/profile'
import { Btn, Panel } from '../ui/bits'
import { useStore } from '../store'
import { play } from '../audio'
import type { Point } from '../world/map'

/**
 * Something is loose in the house.
 *
 * The player never sees it. What they see is where it has *been* — and the job
 * is to work out how it moves and be waiting in the right room. Pattern,
 * hypothesis, prediction, test, which is both what tracking feels like and what
 * mathematical thinking is.
 *
 * Missing is not a setback. The creature moves on and the trail gains a term, so
 * every failed guess makes the answer more determined than it was.
 */
export function Hunt() {
  const save = useStore((s) => s.save)
  const hunt = useStore((s) => s.hunt)
  const result = useStore((s) => s.huntResult)
  const beginHunt = useStore((s) => s.beginHunt)
  const placeTrap = useStore((s) => s.placeTrap)
  const springIt = useStore((s) => s.springIt)
  const dismiss = useStore((s) => s.dismissHuntResult)
  const go = useStore((s) => s.go)

  const [notebook, setNotebook] = useState(false)

  useEffect(() => {
    if (!hunt) beginHunt()
  }, [hunt, beginHunt])

  if (!hunt) return null

  const open = roomsUnlocked(save.hunt.catches)
  const inPlay = (n: number) => n <= open
  const overlay = notebook || result !== null

  const blocked = (p: Point) => {
    if (isSolidIn(HOUSE.rows, p)) return true
    // Rooms that have not opened yet are simply not there.
    const room = roomContaining(p)
    return room ? !inPlay(room.number) : false
  }

  const buildScene = (player: { x: number; y: number }, facing: Point): Scene => ({
    rows: HOUSE.rows,
    player,
    facingTile: null,
    floorLabels: HOUSE.rooms.map((r) => ({
      at: { x: r.centre.x, y: r.centre.y },
      text: inPlay(r.number) ? String(r.number) : '×',
      dim: !inPlay(r.number) || hunt.trapRoom !== r.number,
    })),
    actors: [
      // {papa} waits on the landing, entirely unhelpfully.
      { key: 'papa', at: { x: HOUSE.spawn.x - 4, y: HOUSE.spawn.y }, seed: PAPA_SEED, palette: PAPA_PALETTE,
        label: facing.x === HOUSE.spawn.x - 4 && facing.y === HOUSE.spawn.y ? fill('{papa}') : undefined },
      ...(hunt.trapRoom !== null && roomByNumber(hunt.trapRoom)
        ? [{ key: 'trap', at: roomByNumber(hunt.trapRoom)!.centre, seed: 4242, marker: '▼' }]
        : []),
    ],
  })

  const standingRoom = (p: Point) => {
    const room = roomContaining(p)
    return room && inPlay(room.number) ? room : undefined
  }

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden">
      <TileWorld
        start={HOUSE.spawn}
        blocked={blocked}
        buildScene={buildScene}
        controlsVisible={!overlay}
        actionLabel={(_facing, on) => {
          const room = standingRoom(on)
          if (!room) return null
          if (hunt.trapRoom === room.number) return 'Trap set'
          return `Trap\nroom ${room.number}`
        }}
        onAction={(_facing, on) => {
          const room = standingRoom(on)
          if (room) { placeTrap(room.number); play('hint') }
        }}
      />

      <header className="relative z-10 flex items-start justify-between gap-2 p-3">
        <div className="block-panel px-3 py-2">
          <p className="text-sm font-bold">Something is loose</p>
          <p className="text-xs text-dim">
            {save.hunt.catches} caught &middot; {open} rooms open
            {hunt.misses > 0 && ` · ${hunt.misses} near miss${hunt.misses === 1 ? '' : 'es'}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Btn onClick={() => setNotebook(true)} className="px-4 py-2 text-sm">Notebook</Btn>
          <button type="button" onClick={() => go('settings')} className="block-btn px-3 py-2 text-sm" aria-label="Settings">
            &#9881;
          </button>
        </div>
      </header>

      {!overlay && hunt.trapRoom !== null && (
        <div className="relative z-10 mx-auto w-full max-w-md px-4">
          <Btn tone="go" onClick={springIt} className="w-full py-5 text-lg">
            Keep still and wait&hellip;
          </Btn>
        </div>
      )}

      {notebook && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-ink/90 p-4">
          <Panel className="w-full max-w-lg">
            <p className="text-sm font-bold uppercase tracking-wider text-bolt">Where it has been</p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {hunt.trail.map((room, i) => (
                <span key={i} className="flex items-center gap-2">
                  {i > 0 && <span className="text-dim">&rarr;</span>}
                  <span className="rounded-xl border-2 border-ink-line bg-ink px-4 py-2 font-mono text-xl font-bold">
                    {room}
                  </span>
                </span>
              ))}
              <span className="text-dim">&rarr;</span>
              <span className="rounded-xl border-2 border-dashed border-bolt/60 px-4 py-2 font-mono text-xl font-bold text-bolt">
                ?
              </span>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-dim">
              Work out how it moves, then go and wait in the room you think is next. The house
              loops &mdash; past room {open} you are back at room 1.
            </p>

            <Btn tone="go" onClick={() => setNotebook(false)} className="mt-4 w-full">
              Right
            </Btn>
          </Panel>
        </div>
      )}

      {result && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-ink/90 p-4">
          <Panel className={`w-full max-w-lg ${result.caught ? 'border-moss/60' : 'border-sky/40'}`}>
            {result.caught ? (
              <>
                <p className="text-2xl font-extrabold">Got it.</p>
                <p className="mt-2 leading-relaxed">
                  It came straight into the room you were waiting in.
                </p>
                {result.reward && (
                  <div className="mt-4 rounded-xl border-2 border-bolt/50 bg-bolt/10 p-4">
                    <p className="text-sm font-bold uppercase tracking-wider text-bolt">
                      {fill('{papa} promised')}
                    </p>
                    <p className="mt-1 text-lg">{result.reward}</p>
                  </div>
                )}
                <Btn tone="go" onClick={() => { dismiss(); beginHunt() }} className="mt-4 w-full py-4">
                  Another one has got out
                </Btn>
              </>
            ) : (
              <>
                <p className="text-2xl font-extrabold">It went somewhere else.</p>
                <p className="mt-2 leading-relaxed">
                  It is in room <span className="font-bold text-bolt">{hunt.trail[hunt.trail.length - 1]}</span> now
                  &mdash; so your notebook has one more number in it than it did. That makes the next
                  guess easier, not harder.
                </p>
                <Btn tone="go" onClick={() => { dismiss(); setNotebook(true) }} className="mt-4 w-full py-4">
                  Look at the notebook
                </Btn>
              </>
            )}
          </Panel>
        </div>
      )}
    </div>
  )
}
