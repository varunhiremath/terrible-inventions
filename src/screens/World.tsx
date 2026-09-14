import { useEffect, useState } from 'react'
import { isSolid, roomAt, MAP, type Point } from '../world/map'
import { MACHINES, PAPA_AT, PAPA_LINES, isPapaAt, machineAt, wingComplete } from '../world/characters'
import { lastPosition, rememberPosition } from '../world/position'
import { TileWorld } from '../world/TileWorld'
import { PAPA_PALETTE, PAPA_SEED, type Scene } from '../world/render'
import { fill } from '../config/profile'
import { Btn } from '../ui/bits'
import { useStore } from '../store'
import { play } from '../audio'

interface Talk {
  who: string
  lines: string[]
  at: number
  action?: { label: string; run: () => void }
}

/** The original workshop, kept alongside the hunt so the two can be compared. */
export function World() {
  const save = useStore((s) => s.save)
  const justFixed = useStore((s) => s.justFixed)
  const startMission = useStore((s) => s.startMission)
  const startCoop = useStore((s) => s.startCoop)
  const clearJustFixed = useStore((s) => s.clearJustFixed)
  const go = useStore((s) => s.go)

  const [talk, setTalk] = useState<Talk | null>(null)
  const [room, setRoom] = useState(() => roomAt(lastPosition()))

  const fixed = save.world.fixed
  const unlocked = wingComplete(fixed)

  useEffect(() => {
    if (!justFixed) return
    const machine = MACHINES.find((m) => m.id === justFixed.machineId)
    if (!machine) return
    play('right')
    setTalk({ who: machine.name, at: 0, lines: [...machine.success, justFixed.praise] })
    clearJustFixed()
  }, [justFixed, clearJustFixed])

  const blocked = (p: Point) => isSolid(p, unlocked) || !!machineAt(p) || isPapaAt(p)

  const buildScene = (player: { x: number; y: number }, facing: Point): Scene => ({
    rows: MAP,
    player,
    facingTile: machineAt(facing) || isPapaAt(facing) ? facing : null,
    actors: [
      ...MACHINES.map((m) => ({
        key: m.id,
        at: m.at,
        seed: m.seed,
        agitated: !fixed.includes(m.id),
        marker: fixed.includes(m.id) ? undefined : '!',
        label: facing.x === m.at.x && facing.y === m.at.y ? m.name : undefined,
      })),
      {
        key: 'papa',
        at: PAPA_AT,
        seed: PAPA_SEED,
        palette: PAPA_PALETTE,
        label: isPapaAt(facing) ? fill('{papa}') : undefined,
      },
    ],
  })

  const interact = (facing: Point) => {
    if (talk) return

    const machine = machineAt(facing)
    if (machine) {
      const isFixed = fixed.includes(machine.id)
      play(isFixed ? 'greeting' : 'struggle')
      setTalk({
        who: machine.name,
        at: 0,
        lines: isFixed ? [pick(machine.working)] : machine.broken,
        action: isFixed ? undefined : { label: `Help ${machine.name}`, run: () => startMission(machine.id) },
      })
      return
    }

    if (isPapaAt(facing)) {
      const stage = fixed.length === 0 ? 'none' : unlocked ? 'all' : 'some'
      play('greeting')
      setTalk({
        who: fill('{papa}'),
        at: 0,
        lines: [pick([...PAPA_LINES[stage]])],
        action: { label: 'Do a two-player puzzle', run: startCoop },
      })
    }
  }

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden">
      <TileWorld
        start={lastPosition()}
        blocked={blocked}
        buildScene={buildScene}
        controlsVisible={!talk}
        onMove={(to) => { rememberPosition(to); setRoom(roomAt(to)) }}
        actionLabel={(facing) => {
          const machine = machineAt(facing)
          if (machine) return machine.name
          return isPapaAt(facing) ? fill('{papa}') : null
        }}
        onAction={interact}
      />

      <header className="relative z-10 flex items-start justify-between gap-2 p-3">
        <div className="block-panel px-3 py-2">
          <p className="text-sm font-bold">{room}</p>
          <p className="text-xs text-dim">
            {fixed.length} of {MACHINES.length} working{unlocked && ' · the far door is open'}
          </p>
        </div>
        <button type="button" onClick={() => go('settings')} className="block-btn px-3 py-2 text-sm" aria-label="Settings">
          &#9881;
        </button>
      </header>

      {talk && (
        <div className="relative z-20 mt-auto p-3">
          <div className="block-panel p-4">
            <p className="text-sm font-bold uppercase tracking-wider text-bolt">{talk.who}</p>
            <p className="mt-2 min-h-[3.5rem] text-lg leading-snug">{fill(talk.lines[talk.at])}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {talk.at < talk.lines.length - 1 ? (
                <Btn tone="go" onClick={() => setTalk({ ...talk, at: talk.at + 1 })}>Go on</Btn>
              ) : (
                <>
                  {talk.action && <Btn tone="go" onClick={talk.action.run}>{talk.action.label}</Btn>}
                  <Btn onClick={() => setTalk(null)}>{talk.action ? 'Not now' : 'Bye'}</Btn>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]
}
