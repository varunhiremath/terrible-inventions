"""
Picks a level out of the candidates and writes src/pipes/levels.ts.

Every candidate that gets past here has at least one mushroom in it, which is
the thing that was missing: the generator left it to luck twice over, and level
one -- the level you learn the game in -- came out with none.

Whether a level can actually be finished is not decided here. That is
`solve.test.ts`, which plays each one with the game's own physics, so a level
that cannot be crossed fails the build rather than reaching anybody.

  python3 scripts/make-pipes.py > /tmp/pipes.json
  python3 scripts/emit-pipes.py /tmp/pipes.json
"""
import json, sys

data = json.load(open(sys.argv[1]))
chosen = []
for i, tries in enumerate(data):
    for candidate in tries:
        if sum(row.count('!') for row in candidate['rows']) >= 1:
            chosen.append(candidate)
            break
    else:
        raise SystemExit(f'level {i + 1}: no candidate had a mushroom in it')

head = open('src/pipes/levels.ts').read().split('import { readLevel')[0]
out = [head + "import { readLevel, type Level } from './level'\n"]
for i, level in enumerate(chosen):
    out.append(f"\nconst LEVEL_{i + 1} = [")
    for row in level['rows']:
        out.append("  '" + row.replace("'", "\\'") + "',")
    out.append(']\n')

out.append('export const LEVELS: readonly Level[] = [')
for i, level in enumerate(chosen):
    name = level['name'].replace("'", "\\'")
    quote = '"' if "'" in level['name'] else "'"
    out.append(f"  readLevel({quote}{level['name']}{quote}, LEVEL_{i + 1}),")
out.append(']\n')
out.append('export function levelFor(number: number): Level {')
out.append('  return LEVELS[Math.min(Math.max(1, number), LEVELS.length) - 1]')
out.append('}')

open('src/pipes/levels.ts', 'w').write('\n'.join(out) + '\n')
for i, level in enumerate(chosen):
    n = sum(row.count('!') for row in level['rows'])
    print(f"level {i + 1} {level['name']}: {n} mushrooms")
