"""
Builds the levels for the pipes game.

Same lesson as the dungeon, applied before shipping rather than after: the
ground is laid first as a route that is known to be crossable, and everything
else is hung off it. Gaps are never wider than a running jump, blocks are never
higher than a jump from the floor beneath them, and nothing decorative is ever
placed where it can seal the way forward.

`solve.ts` then plays each level with the game's own physics and checks the
flag can be reached. The generator is not trusted; it is checked.
"""
import random

ROWS = 15
GROUND = 13          # the top row of earth
SKY, EARTH, BRICK, QUERY, MUSH, SOLID, COIN = ' ', '#', 'B', '?', '!', 'S', 'o'
POLE, BASE = '|', '='


def build(rng, number, width=190):
    grid = [[SKY] * width for _ in range(ROWS)]

    def earth(c0, c1, top=GROUND):
        for c in range(max(0, c0), min(width, c1)):
            for r in range(top, ROWS):
                grid[r][c] = EARTH

    def put(c, r, ch):
        if 0 <= c < width and 0 <= r < ROWS:
            grid[r][c] = ch

    # A flat run to start on, so nothing is asked of the player before they
    # have had a moment to find out what the buttons do.
    col = 0
    earth(0, 18)
    col = 18
    flat_top = GROUND

    end = width - 18
    while col < end:
        piece = rng.random()

        if piece < 0.28 and col + 10 < end:
            # A gap. Four tiles is inside a running jump with room to spare;
            # two is clearable at a walk, so the early ones stay small.
            span = rng.randint(2, 3 if number == 1 else 4)
            col += span
            run = rng.randint(6, 11)
            earth(col, col + run, flat_top)
            col += run

        elif piece < 0.5 and col + 12 < end:
            # A pipe, standing on the ground. Its lip is a platform, and the
            # taller ones need a run at them.
            height = rng.randint(2, 3 if number == 1 else 4)
            top = GROUND - height
            for r in range(top, ROWS):
                put(col, r, '[' if r == top else '(')
                put(col + 1, r, ']' if r == top else ')')
            col += 2
            run = rng.randint(7, 12)
            earth(col, col + run, flat_top)
            col += run

        elif piece < 0.72 and col + 14 < end:
            # A staircase of solid blocks, up and then down again.
            steps = rng.randint(2, 4)
            for i in range(steps):
                for r in range(GROUND - 1 - i, GROUND):
                    put(col + i, r, SOLID)
            for i in range(steps):
                for r in range(GROUND - steps + i, GROUND):
                    put(col + steps + i, r, SOLID)
            earth(col, col + steps * 2, flat_top)
            col += steps * 2
            run = rng.randint(6, 10)
            earth(col, col + run, flat_top)
            col += run

        else:
            run = rng.randint(8, 14)
            earth(col, col + run, flat_top)
            col += run

        # A row of blocks over the flat, four tiles up, which is a jump from
        # the ground and no more.
        if rng.random() < 0.55 and col + 6 < end:
            at = col - rng.randint(4, 7)
            kinds = [BRICK, QUERY, BRICK, QUERY, BRICK]
            if rng.random() < 0.3:
                kinds[rng.randrange(len(kinds))] = MUSH
            for i, ch in enumerate(kinds[: rng.randint(3, 5)]):
                if grid[GROUND - 1][at + i] == SKY:
                    put(at + i, 9, ch)

        # Coins hanging in the air over a flat stretch.
        if rng.random() < 0.5:
            at = col - rng.randint(5, 9)
            for i in range(rng.randint(2, 4)):
                if grid[10][at + i * 2] == SKY:
                    put(at + i * 2, 10, COIN)

    # The run up to the flag: flat, so the last thing is never a surprise.
    earth(col, width)
    pole = width - 12
    for r in range(4, GROUND):
        put(pole, r, POLE)
    put(pole, GROUND - 1, BASE)

    # Enemies, on flat ground with room either side, and never near the start.
    spots = []
    for c in range(26, pole - 4):
        if grid[GROUND][c] == EARTH and all(grid[r][c] == SKY for r in range(GROUND - 3, GROUND)):
            if all(grid[GROUND][c + d] == EARTH for d in (-2, -1, 1, 2)):
                spots.append(c)
    rng.shuffle(spots)
    placed = []
    for c in spots:
        if any(abs(c - p) < 9 for p in placed):
            continue
        placed.append(c)
        kind = 'k' if number >= 2 and rng.random() < 0.35 else 'g'
        put(c, GROUND - 1, kind)
        if len(placed) >= 6 + number * 2:
            break

    return [''.join(r) for r in grid]
