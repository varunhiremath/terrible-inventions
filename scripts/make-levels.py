"""Generates candidate levels and writes them out for the solver to check."""
import json, random, sys
sys.path.insert(0, 'scripts')
from dungeon import carve, dress, rows_of

NAMES = [
  'The Dungeon', 'The Guardroom', 'Spikes', 'Loose Ground', 'The Chompers',
  'The Long Drop', 'The Palace Gate', 'The Cisterns', 'The Upper Halls',
  'Blades and Spikes', 'The Bone Yard', 'The Mirror', "Papa's Own Tower",
]
COLOURS = ['guard', 'guard', 'guard', 'fat', 'guard', 'skeleton', 'fat',
           'guard', 'shadow', 'skeleton', 'shadow', 'fat', 'vizier']

out = []
for i, name in enumerate(NAMES):
    number = i + 1
    # Several candidates per level; the checker picks the first that passes.
    tries = []
    for attempt in range(40):
        rng = random.Random(number * 1000 + attempt)
        grid, keep, end = carve(rng)
        grid = dress(grid, keep, rng, number)
        rows = rows_of(grid)
        # Guards stand on route floors, facing back the way he comes.
        spots = [(c, r) for (c, r) in sorted(keep) if rows[r][c] == '#' and c > 8]
        guards = []
        if number >= 2 and spots:
            wanted = min(1 + number // 3, 4)
            step = max(1, len(spots) // (wanted + 1))
            for k in range(wanted):
                pick = spots[min((k + 1) * step, len(spots) - 1)]
                guards.append({
                    'col': pick[0], 'row': pick[1], 'facing': -1,
                    'skill': min(4, (number - 1) // 3),
                    'colour': COLOURS[i],
                })
        torches = []
        for t in range(3):
            c = 4 + t * 9
            r = next((rr for rr in range(1, 6) if rows[rr][c] == '#'), 1)
            torches.append({'col': c, 'row': max(0, r - 1)})
        tries.append({
            'name': name, 'palette': 'dungeon' if number <= 7 else 'palace',
            'start': {'col': 2, 'row': 1, 'facing': 1},
            'guards': guards, 'torches': torches, 'rows': rows,
        })
    out.append(tries)

print(json.dumps(out))
