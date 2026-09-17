# Each screen is 10 rows of exactly 20 characters: one viewport.
# ' ' sky   '#' brick   '^' fire   '~' water   '!' tentacle
# 'T' trophy 'D' door   'J' jetpack 'G' gun
# '1'..'6' gumball, shoe, coin, ring, wand, crown

L = {}

L[1] = dict(start=(2, 8), screens=[
[   "                    ",
    "                    ",
    "                    ",
    "                    ",
    "                    ",
    "                    ",
    "         11         ",
    "        ####        ",
    "   1                ",
    "####################"],
[   "                    ",
    "                    ",
    "                    ",
    "                    ",
    "             22     ",
    "            ####    ",
    "                    ",
    "    22              ",
    "   ####             ",
    "########^^^^########"],
[   "                    ",
    "                    ",
    "                    ",
    "      33            ",
    "     #####          ",
    "                    ",
    "                3   ",
    "              ####  ",
    "                    ",
    "####^^^^########^^^^"],
[   "                    ",
    "                    ",
    "         T          ",
    "       ######       ",
    "                    ",
    "   44               ",
    "  #####             ",
    "                    ",
    "               44   ",
    "################^^^^"],
[   "                    ",
    "                    ",
    "                    ",
    "                    ",
    "                    ",
    "                    ",
    "        55          ",
    "       #####        ",
    "              D     ",
    "^^##################"],
])

L[2] = dict(start=(2, 8), screens=[
[   "                    ",
    "                    ",
    "                    ",
    "                    ",
    "                    ",
    "          11        ",
    "         #####      ",
    "                    ",
    "   1                ",
    "####################"],
[   "                    ",
    "                    ",
    "         22         ",
    "        #####       ",
    "                    ",
    "   2                ",
    "  ####              ",
    "                    ",
    "                    ",
    "##^^^^####^^^^######"],
[   "                    ",
    "                    ",
    "                    ",
    "             33     ",
    "            #####   ",
    "                    ",
    "      33            ",
    "     #####          ",
    "                    ",
    "####^^^^^^^^########"],
[   "                    ",
    "                    ",
    "    T               ",
    "   #####            ",
    "                    ",
    "              44    ",
    "            #####   ",
    "                    ",
    "                    ",
    "########^^^^########"],
[   "                    ",
    "                    ",
    "                    ",
    "        55          ",
    "       #####        ",
    "                    ",
    "                    ",
    "            6       ",
    "          D         ",
    "^^##################"],
])

L[3] = dict(start=(2, 8), screens=[
[   "                    ",
    "   !     !          ",
    "                    ",
    "                    ",
    "                    ",
    "                    ",
    "        11          ",
    "       #####        ",
    "     1              ",
    "####################"],
[   "                    ",
    "     !       !      ",
    "                    ",
    "                    ",
    "        22          ",
    "       #####        ",
    "                    ",
    "                    ",
    "                    ",
    "####~~~~####~~~~####"],
[   "                    ",
    "         !          ",
    "                    ",
    "     33             ",
    "    #####           ",
    "                    ",
    "            33      ",
    "           #####    ",
    "                    ",
    "##~~~~~~~~~~~~~~####"],
[   "                    ",
    "   !      !         ",
    "        T           ",
    "      ######        ",
    "                    ",
    "   44               ",
    "  #####             ",
    "                    ",
    "                    ",
    "####~~~~####~~~~####"],
[   "                    ",
    "                    ",
    "                    ",
    "         55         ",
    "        #####       ",
    "                    ",
    "                    ",
    "             D      ",
    "                    ",
    "####################"],
])

L[4] = dict(start=(2, 8), screens=[
[   "                    ",
    "                    ",
    "                    ",
    "                    ",
    "                    ",
    "                    ",
    "        J           ",
    "       #####        ",
    "     11             ",
    "####################"],
[   "                    ",
    "                    ",
    "        22          ",
    "                    ",
    "      33            ",
    "                    ",
    "    22              ",
    "                    ",
    "                    ",
    "^^^^^^^^^^^^^^^^^^^^"],
[   "      44            ",
    "                    ",
    "            44      ",
    "                    ",
    "   33               ",
    "                    ",
    "                    ",
    "                    ",
    "                    ",
    "^^^^^^^^^^^^^^^^^^^^"],
[   "                    ",
    "         T          ",
    "       ######       ",
    "                    ",
    "                    ",
    "              J     ",
    "            #####   ",
    "                    ",
    "   55               ",
    "########^^^^^^^^####"],
[   "                    ",
    "                    ",
    "                    ",
    "          66        ",
    "         #####      ",
    "                    ",
    "                    ",
    "               D    ",
    "                    ",
    "####################"],
])

L[5] = dict(start=(2, 8), screens=[
[   "                    ",
    "                    ",
    "                    ",
    "                    ",
    "                    ",
    "                    ",
    "         G          ",
    "        #####       ",
    "     11             ",
    "####################"],
[   "                    ",
    "                    ",
    "                    ",
    "                    ",
    "                    ",
    "          22        ",
    "         #####      ",
    "                    ",
    "    33              ",
    "####################"],
[   "                    ",
    "                    ",
    "                    ",
    "                    ",
    "         44         ",
    "        #####       ",
    "                    ",
    "    33              ",
    "   #####            ",
    "####^^^^^^^^^^^^####"],
[   "                    ",
    "                    ",
    "         T          ",
    "       ######       ",
    "                    ",
    "      55            ",
    "     #####          ",
    "                    ",
    "                    ",
    "####################"],
[   "                    ",
    "                    ",
    "                    ",
    "                    ",
    "        66          ",
    "       #####        ",
    "                    ",
    "             D      ",
    "                    ",
    "####################"],
])

L[6] = dict(start=(2, 8), screens=[
[   "                    ",
    "    !     !    !    ",
    "                    ",
    "                    ",
    "                    ",
    "         G          ",
    "        #####       ",
    "                    ",
    "     11             ",
    "####################"],
[   "                    ",
    "   !   !   !   !    ",
    "                    ",
    "         22         ",
    "        #####       ",
    "                    ",
    "                    ",
    "                    ",
    "                    ",
    "##^^^^##^^^^##^^^^##"],
[   "                    ",
    "     !       !      ",
    "                    ",
    "                    ",
    "      33     33     ",
    "     ####   ####    ",
    "                    ",
    "                    ",
    "                    ",
    "####~~~~~~~~~~~~####"],
[   "                    ",
    "   !    !     !     ",
    "        T           ",
    "      ######        ",
    "                    ",
    "   44               ",
    "  #####             ",
    "                    ",
    "              55    ",
    "############^^^^####"],
[   "                    ",
    "      !       !     ",
    "                    ",
    "                    ",
    "        66          ",
    "       #####        ",
    "                    ",
    "            D       ",
    "                    ",
    "####################"],
])

L[7] = dict(start=(2, 8), screens=[
[   "                    ",
    "                    ",
    "                    ",
    "                    ",
    "                    ",
    "         11         ",
    "        #####       ",
    "                    ",
    "      11            ",
    "####################"],
[   "                    ",
    "                    ",
    "                    ",
    "          33        ",
    "         #####      ",
    "                    ",
    "     22             ",
    "    #####           ",
    "                    ",
    "####################"],
[   "                    ",
    "         44         ",
    "        #####       ",
    "                    ",
    "      44            ",
    "     #####          ",
    "                    ",
    "    33              ",
    "   #####            ",
    "####^^^^####^^^^####"],
[   "                    ",
    "         T          ",
    "       ######       ",
    "                    ",
    "      55            ",
    "     #####          ",
    "                    ",
    "    55              ",
    "   #####            ",
    "####################"],
[   "                    ",
    "                    ",
    "                    ",
    "         66         ",
    "        #####       ",
    "                    ",
    "                    ",
    "           D        ",
    "                    ",
    "####################"],
])

L[8] = dict(start=(2, 8), screens=[
[   "                    ",
    "                    ",
    "                    ",
    "                    ",
    "                    ",
    "        J           ",
    "       #####        ",
    "                    ",
    "     11    22       ",
    "####################"],
[   "    33              ",
    "                    ",
    "             33     ",
    "                    ",
    "     44             ",
    "                    ",
    "                    ",
    "            44      ",
    "                    ",
    "^^^^^^^^^^^^^^^^^^^^"],
[   "           55       ",
    "                    ",
    "    55              ",
    "                    ",
    "                    ",
    "         66         ",
    "                    ",
    "                    ",
    "                    ",
    "~~~~~~~~~~~~~~~~~~~~"],
[   "                    ",
    "        T           ",
    "      ######        ",
    "                    ",
    "             J      ",
    "           #####    ",
    "                    ",
    "   33               ",
    "  #####             ",
    "####^^^^^^^^^^^^####"],
[   "                    ",
    "                    ",
    "                    ",
    "         66         ",
    "        #####       ",
    "                    ",
    "                    ",
    "              D     ",
    "                    ",
    "####################"],
])

L[9] = dict(start=(2, 8), screens=[
[   "                    ",
    "                    ",
    "                    ",
    "                    ",
    "                    ",
    "         G          ",
    "        #####       ",
    "                    ",
    "      11            ",
    "####################"],
[   "                    ",
    "                    ",
    "                    ",
    "                    ",
    "         22         ",
    "        #####       ",
    "                    ",
    "    33              ",
    "   #####            ",
    "####~~~~~~~~~~~~####"],
[   "                    ",
    "     !      !       ",
    "                    ",
    "                    ",
    "           44       ",
    "          #####     ",
    "                    ",
    "    44              ",
    "   #####            ",
    "##~~~~~~~~~~~~~~~~##"],
[   "                    ",
    "         T          ",
    "       ######       ",
    "                    ",
    "        55          ",
    "       #####        ",
    "                    ",
    "   55               ",
    "  #####             ",
    "####^^^^####^^^^####"],
[   "                    ",
    "                    ",
    "         66         ",
    "        #####       ",
    "                    ",
    "                    ",
    "            D       ",
    "                    ",
    "                    ",
    "####################"],
])

L[10] = dict(start=(2, 8), screens=[
[   "                    ",
    "   !      !     !   ",
    "                    ",
    "                    ",
    "                    ",
    "         G          ",
    "        #####       ",
    "                    ",
    "     11    22       ",
    "####################"],
[   "                    ",
    "    !    !    !     ",
    "                    ",
    "                    ",
    "         33    J    ",
    "        #####  #####",
    "                    ",
    "    33              ",
    "   #####            ",
    "##^^^^##^^^^##^^^^##"],
[   "                    ",
    "                    ",
    "                    ",
    "        66          ",
    "       #####        ",
    "                    ",
    "      44            ",
    "            44      ",
    "                    ",
    "~~~~~~~~~~~~~~~~~~~~"],
[   "                    ",
    "   !     !      !   ",
    "         T          ",
    "       ######       ",
    "                    ",
    "        55          ",
    "       #####        ",
    "                    ",
    "   55               ",
    "####~~~~~~~~####^^^^"],
[   "                    ",
    "      !      !      ",
    "                    ",
    "         66         ",
    "        #####       ",
    "                    ",
    "                    ",
    "           D        ",
    "                    ",
    "####################"],
])


# Levels crossed on foot may not have a hazard run in the floor wider than a
# jump can clear. Dave reaches 5.3 tiles in the air and crossing an N-tile pit
# costs N+1, so two is the widest that leaves any margin worth having -- and
# margin is the point, because a nine year old should not have to frame-count.
#
# Runs wider than that are shrunk from the middle. Four of them were six tiles
# wide where two screens happened to meet, which is invisible while you are
# drawing one screen at a time and fatal once they are joined up.
FOOT_LEVELS = [1, 2, 3, 5, 6, 7, 9]
MAX_PIT = 2

def tame_floor(rows):
    floor = list(rows[9])
    x = 0
    while x < len(floor):
        if floor[x] in '^~':
            run = x
            while run < len(floor) and floor[run] == floor[x]:
                run += 1
            width = run - x
            if width > MAX_PIT:
                keep_from = x + (width - MAX_PIT) // 2
                for i in range(x, run):
                    if not (keep_from <= i < keep_from + MAX_PIT):
                        floor[i] = '#'
            x = run
        else:
            x += 1
    rows[9] = ''.join(floor)
    return rows

for n in FOOT_LEVELS:
    lv = L[n]
    rows = [''.join(sc[r] for sc in lv['screens']) for r in range(10)]
    rows = tame_floor(rows)
    lv['screens'] = [[rows[r][s * 20:(s + 1) * 20] for r in range(10)] for s in range(5)]


# The rooms were drawn one ledge to a screenful, which leaves most of the
# height empty black. The original's rooms are dense: a rhythm of small brick
# blocks at four or five heights with diamonds strung between them, and the
# whole picture full. So each drawing gets a second pass that fills it out.
#
# Only additions, and only into space that is already empty on all sides: more
# ledges is more places to stand, which can only help a route. Whether any of
# them gets in the way of a jump is not something to reason about -- it is
# something for src/dave/solve.ts to answer, and it is run again afterwards.

LEDGE_ROWS = [2, 4, 6, 3, 5, 7]

def clear_for(rows, y, x0, x1):
    """
    True when a ledge could go here without touching anything.

    Only the ledge's own row and the one above it -- that is where it would
    collide with something already drawn, and where its diamonds go. Checking
    two rows up as well was so cautious that almost every extra ledge was
    rejected and the rooms stayed empty.
    """
    if y < 2 or y > 7:
        return False
    for yy in (y - 1, y):
        if any(c != ' ' for c in rows[yy][max(0, x0 - 1):x1 + 2]):
            return False
    # And nothing directly beneath, so ledges do not stack into a wall.
    if y + 1 < len(rows) and any(c == '#' for c in rows[y + 1][x0:x1 + 1]):
        return False
    return True

def put(rows, y, x, text):
    rows[y] = rows[y][:x] + text + rows[y][x + len(text):]

def enrich(rows, n):
    rows = list(rows)
    # More ledges, staggered so they form a climbable rhythm rather than a wall.
    for i, x in enumerate(range(5, 95, 5)):
        y = LEDGE_ROWS[(i + n) % len(LEDGE_ROWS)]
        if clear_for(rows, y, x, x + 3):
            put(rows, y, x, '####')
            put(rows, y - 1, x + 1, '33')

    # Diamonds resting on every ledge that has not got any.
    for y in range(1, 9):
        for x in range(1, 99):
            if rows[y][x] == '#' and rows[y - 1][x] == ' ' and (y + 1 > 9 or rows[y][x] == '#'):
                if x % 3 == 1:
                    put(rows, y - 1, x, '3')

    # And a scatter high up, where the original hangs them in the air.
    for x in range(7, 96, 6):
        y = 1 + ((x + n) % 2)
        if rows[y][x] == ' ' and rows[y + 1][x] == ' ':
            put(rows, y, x, '3')
    return rows

# The flying levels keep their empty sky. Their route goes *through* the air --
# across a field of fire or water with nothing underneath -- so furniture up
# there is not decoration, it is an obstacle in the only corridor there is.
# Adding it broke level ten, and the level checker said so.
FLYING_LEVELS = {4, 8, 10}

for n, lv in sorted(L.items()):
    if n in FLYING_LEVELS:
        continue
    rows = [''.join(sc[r] for sc in lv['screens']) for r in range(10)]
    rows = enrich(rows, n)
    lv['screens'] = [[rows[r][s * 20:(s + 1) * 20] for r in range(10)] for s in range(5)]

# --- validate -------------------------------------------------------------
bad = 0
for n, lv in sorted(L.items()):
    if len(lv['screens']) != 5:
        print(f'level {n}: {len(lv["screens"])} screens, want 5'); bad += 1
    for si, sc in enumerate(lv['screens']):
        if len(sc) != 10:
            print(f'level {n} screen {si}: {len(sc)} rows, want 10'); bad += 1
        for ri, row in enumerate(sc):
            if len(row) != 20:
                print(f'level {n} screen {si} row {ri}: {len(row)} chars, want 20 -> {row!r}'); bad += 1
    rows = [''.join(sc[r] for sc in lv['screens']) for r in range(10)]
    joined = '\n'.join(rows)
    for tile, label in (('T', 'trophy'), ('D', 'door')):
        c = joined.count(tile)
        if c != 1:
            print(f'level {n}: {c} {label}s, want 1'); bad += 1
    floor = rows[9]
    holes = [x for x, t in enumerate(floor) if t not in '#^~']
    if holes:
        print(f'level {n}: {len(holes)} see-through floor columns at {holes[:8]}'); bad += 1
    sx, sy = lv['start']
    if rows[sy][sx] != ' ':
        print(f'level {n}: start is inside {rows[sy][sx]!r}'); bad += 1
    if rows[sy + 1][sx] not in '#':
        print(f'level {n}: nothing solid under the start'); bad += 1
print('PROBLEMS' if bad else 'all ten levels well formed')
