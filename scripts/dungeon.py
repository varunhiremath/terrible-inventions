"""
Builds the dungeon's levels, and guarantees a way through each one.

Every level in this game used to be written out by hand, and all thirteen of
them turned out to be sealed in their first room: a wall ran the full height
between room nought and room one with no doorway cut in it anywhere. Nothing
on the page looks wrong about that, which is exactly the problem.

So the route comes first here and the level is drawn around it. A route is a
sequence of moves the prince can actually make, in the vocabulary the frame
tables give him:

  walk   along a floor, any distance
  drop   off the end of a floor onto the one below
  climb  through a gap in the floor above onto the ledge beyond it
  gap    one or two missing tiles: jump it, or fall in and climb back out,
         because a short gap with floor beneath it is recoverable either way

`solve.ts` then plays every level every way there is and checks the exit comes
up. The generator is not trusted; it is checked.
"""
import random

COLS, ROWS = 30, 6
SPACE, FLOOR, WALL = ' ', '#', 'X'


def blank():
    return [[SPACE] * COLS for _ in range(ROWS)]


def carve(rng):
    """A route from the start to the exit, and the cells it needs."""
    grid = blank()
    col, row = 2, 1
    # `keep` is every cell the route depends on: floors it walks on, and the
    # holes it climbs through. Decoration may not touch any of them.
    keep = set()

    def floor(c, r):
        if 0 <= c < COLS and 0 <= r < ROWS:
            grid[r][c] = FLOOR
            keep.add((c, r))

    def hole(c, r):
        if 0 <= c < COLS and 0 <= r < ROWS:
            grid[r][c] = SPACE
            keep.add((c, r))

    floor(col, row)
    steps = 0
    while col < COLS - 4 and steps < 40:
        steps += 1
        run = rng.randint(2, 5)
        for _ in range(run):
            if col >= COLS - 4:
                break
            col += 1
            floor(col, row)

        if col >= COLS - 4:
            break

        # Short gaps: jump them, or fall in and climb straight back out. Only
        # ever with a floor directly underneath, which is what makes falling
        # in survivable and getting out possible.
        if rng.random() < 0.3 and row + 1 < ROWS and col + 3 < COLS - 3:
            width = rng.randint(1, 2)
            for i in range(width):
                grid[row][col + 1 + i] = SPACE
                keep.add((col + 1 + i, row))
                floor(col + 1 + i, row + 1)
            col += width + 1
            floor(col, row)
            floor(col, row + 1)
            continue

        choice = rng.random()
        if choice < 0.45 and row + 1 < ROWS:
            # Drop: the floor stops, and the next one picks up a level down.
            grid[row][col + 1] = SPACE
            keep.add((col + 1, row))
            row += 1
            col += 1
            floor(col, row)
        elif row - 1 >= 1 and col + 2 < COLS - 3:
            # Climb: open air directly overhead, and the ledge starts one along.
            hole(col, row - 1)
            row -= 1
            col += 1
            floor(col, row)
        else:
            floor(col, row)

    # A gate across the route, with the plate that opens it earlier along the
    # same route. Both sit on cells the route already uses, so the solver can
    # prove the pair works rather than the generator having to promise it.
    walked = [cell for cell in keep if grid[cell[1]][cell[0]] == FLOOR]
    walked.sort()
    if len(walked) > 12:
        plate = walked[len(walked) // 3]
        gate = walked[(len(walked) * 2) // 3]
        if plate[0] + 3 < gate[0]:
            grid[plate[1]][plate[0]] = '.'
            grid[gate[1]][gate[0]] = '|'

    # The way out, with a little floor round it so it is not on a ledge tip.
    for c in range(col, min(col + 3, COLS - 1)):
        floor(c, row)
    grid[row][min(col + 1, COLS - 2)] = 'E'
    keep.add((min(col + 1, COLS - 2), row))
    return grid, keep, (col, row)


def dress(grid, keep, rng, level_number):
    """Walls, extra ledges, traps and treasure — none of it on the route."""
    for r in range(ROWS):
        grid[r][0] = WALL
        grid[r][COLS - 1] = WALL

    # Solid rock along the top, and under the lowest floor, so the rooms have
    # edges rather than trailing off into the dark.
    for c in range(COLS):
        if (c, 0) not in keep and grid[0][c] == SPACE:
            grid[0][c] = WALL

    free = [
        (c, r)
        for r in range(1, ROWS)
        for c in range(2, COLS - 2)
        if (c, r) not in keep and grid[r][c] == SPACE
    ]
    rng.shuffle(free)

    # Ledges that go nowhere, for the look of the place. Never directly over a
    # route cell, because that is the headroom a climb needs.
    for c, r in free[: int(len(free) * 0.32)]:
        if (c, r + 1) in keep or (c, r - 1) in keep:
            continue
        grid[r][c] = FLOOR

    def scatter(kind, count, rows=range(1, ROWS)):
        spots = [
            (c, r)
            for r in rows
            for c in range(3, COLS - 3)
            if grid[r][c] == FLOOR and (c, r) not in keep
        ]
        rng.shuffle(spots)
        for c, r in spots[:count]:
            grid[r][c] = kind

    # Traps go off the route, so nothing can make a level impossible. They are
    # there to punish wandering, which is what wandering is for.
    if level_number >= 3:
        scatter('^', rng.randint(1, 2 + level_number // 4))
    if level_number >= 5:
        scatter('C', rng.randint(1, 2))
    if level_number >= 4:
        scatter('~', rng.randint(1, 3))
    scatter('h' if level_number % 3 else 'H', 1)
    if level_number == 1:
        scatter('s', 1)
    return grid


def rows_of(grid):
    return [''.join(r) for r in grid]
