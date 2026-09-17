import importlib.util, pathlib, json
spec = importlib.util.spec_from_file_location('lv', 'levels.py')
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
L = m.L
CREW = {
  5:  ([(34, 8, 'spider', 0.0), (52, 8, 'spider', 0.5)], [(0,0),(4,0)], 3.0),
  6:  ([(45, 8, 'orb', 0.0), (63, 8, 'orb', 0.33), (72, 8, 'spider', 0.66)], [(0,0),(3,0)], 3.2),
  7:  ([(26, 8, 'spider', 0.0), (58, 8, 'orb', 0.5)], [(0,0),(0,-3),(3,-3),(3,0)], 3.4),
  8:  ([(30, 4, 'saucer', 0.0), (55, 3, 'saucer', 0.5)], [(0,0),(5,0),(5,3),(0,3)], 4.0),
  9:  ([(24, 8, 'orb', 0.0), (48, 8, 'spider', 0.4), (70, 8, 'orb', 0.7)], [(0,0),(4,0)], 3.6),
  10: ([(23, 8, 'spider', 0.0), (44, 6, 'saucer', 0.25), (65, 8, 'orb', 0.5), (86, 8, 'spider', 0.75)],
       [(0,0),(3,0),(3,-2),(0,-2)], 4.0),
}
NAMES = {1:'The Way In',2:'Over the Coals',3:'Wet Feet',4:'First Flight',5:'Armed',
         6:'The Long Drop',7:'Up and Over',8:'Deep Water',9:'Crossfire',10:"Clyde's Own Room"}
# The brick changes as you go in, which is half of what makes ten rooms feel
# like ten places: red at the front, blue deeper, purple at the back.
THEMES = {
  1:  ('red', 'red'),
  2:  ('red', 'purple'),
  3:  ('blue', 'blue'),
  4:  ('blue', 'brown'),
  5:  ('brown', 'red'),
  6:  ('blue', 'red'),
  7:  ('green', 'brown'),
  8:  ('blue', 'purple'),
  9:  ('purple', 'blue'),
  10: ('purple', 'red'),
}
out = []
for n in range(1, 11):
    lv = L[n]
    rows = [''.join(sc[r] for sc in lv['screens']) for r in range(10)]
    # Diamonds are what this game is made of. The drawings were laid out with
    # six kinds of pickup spread evenly, which is tidy and looks nothing like
    # the original -- there, cyan diamonds are everywhere and a crown is an
    # event. So the two cheapest become diamonds and the dearer three stay rare.
    rows = [r.replace('1', '3').replace('2', '3') for r in rows]
    sx, sy = lv['start']
    frame, platform = THEMES[n]
    parts = [f"  {{\n    name: {json.dumps(NAMES[n])},\n    theme: {{ frame: '{frame}', platform: '{platform}' }},\n    start: {{ x: {sx}, y: {sy} }},"]
    if n in CREW:
        mons, pts, speed = CREW[n]
        # Never place a creature inside a wall: nudge it up until it is clear.
        placed = []
        for x, y, k, ph in mons:
            while y > 0 and rows[y][x] != ' ':
                y -= 1
            placed.append((x, y, k, ph))
        ms = ',\n'.join(f"      {{ at: {{ x: {x}, y: {y} }}, kind: '{k}', phase: {ph} }}" for x,y,k,ph in placed)
        ps = ', '.join(f"{{ x: {x}, y: {y} }}" for x,y in pts)
        parts.append(f"    monsters: [\n{ms},\n    ],")
        parts.append(f"    path: {{ points: [{ps}], speed: {speed} }},")
    body = ',\n'.join(f'      {json.dumps(r)}' for r in rows)
    parts.append(f"    rows: [\n{body},\n    ],\n  }}")
    out.append('\n'.join(parts))
target = pathlib.Path('/home/user/terrible-inventions/src/dave/levels.ts')
header = target.read_text().split('import type')[0]
target.write_text(header + "import type { Level } from './level'\n\nexport const LEVELS: readonly Level[] = [\n"
    + ',\n'.join(out) + '''
]

/** The level for a given number, counting from one, clamped to what exists. */
export function levelFor(number: number): Level {
  return LEVELS[Math.min(LEVELS.length, Math.max(1, number)) - 1]
}
''')
print('regenerated')
