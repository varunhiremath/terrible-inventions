# Terrible Inventions

Arcade games remade for one child, with maths in the shop rather than the doorway.

{papa} is the villain. Beating him is the point.

## Why arcade classics

We cannot out-draw a commercial game, and there is no reason to try: the arcade classics
never competed on graphics either. Pac-Man is four chasers and a maze, and it has lasted
forty years on the strength of its mechanics alone. That is the one category where a
home-made version can genuinely match the original.

The continue-loop is a gift too. These games were built around *die, insert coin, carry
on*. Swapping the coin for a puzzle is not a bolt-on — it is the original structure with
the money taken out.

## The games

| | What it is | Where the maths goes |
|---|---|---|
| **Papa Panic** | A maze, a lot of dots, four chasers | Between lives, and in the shop |
| **The Caves** | Ten caves, a trophy in each, and a jetpack he has not tested | Between lives |
| **The Swarm** | A bridge, a gate, and a crowd coming over it. You are the soldier holding it | On the bridge. Working out whether a crate fits in the time left *is* the game |
| **The Meadow** | A bow, a field, and balloons going up all around you. First person, in three dimensions | On the balloons. Each round names a rule and the numbers decide what is worth an arrow |
| **The Outpost** | Night, a walled compound, a soldier and somebody locked in the middle of it | On the lock. Every machine carries a numbered fuse and the cage wants a total |
| **The Pipes** | Run, jump, stomp, and catch the flagpole as high up as you can | Between lives |
| **The Road** | Four lanes, six stages, and four of his machines racing you from a standing start | Between lives; a right answer is half a tank and a car back |
| **The Scales** | A weighing machine, a rack of brass weights, and crates coming along a belt | All of it. The weights are the powers of two and the pan is a binary number |
| **The Yard** | A sheet of ply, a cutting press, and orders on the board | All of it. Area, perimeter and volume, made rather than worked out |
| **The Long Way Out** | Fly to the eight real planets, in order, through what he has left in the way | None. Break things up for scrap, spend it at each world, and every world tells you something true |

**The Dungeon is not on the front screen.** Thirteen floors and an hour on the clock,
and too many bugs to put in front of a nine-year-old — so the tile is off and the game
is parked. Nothing is deleted: `src/arcade/dungeon/`, its screen, its story, its clips
and its tests are all still here and still run, and putting it back is one entry in
`TILES` and one line in `App.tsx`.

The swarm is where the maths stopped being something that happens between lives. A crowd
comes over a bridge at the gate you are holding, you shoot it, and the numbers on them
are how many more shots each one needs — with brutes among them from the third wave that
take six times as many. Guns ride down the parapets on racks, and a rack is paid for in
hits — hits that are not going into the crowd while you spend them. Shoot one loose and
the gun comes down on a parachute, which you then have to be under: paying buys the
drop, being in the right place buys the gun. Three other things fall in between — a
turret that holds the line beside you, a few seconds of firing twice as fast, and a
blast that clears the front of the bridge — and every gun you have been handed sits in
a row at your feet.
A crate needing twelve hits at three shots a second is four seconds of not shooting, and
the clock at the top says how long you have before the nearest one reaches you. That
comparison is the whole game, and both of its numbers are on the screen.

There is a test that plays it three ways — doing that sum before going for a crate,
grabbing the dear crate whenever one appears, and never buying a gun at all. Over four
minutes the first loses no lives, the second loses one or two, and the third is still
jabbing at wave five with a Peashooter. That test exists because a version where the
crates are decoration would look exactly like this one and teach nothing, and the first
two attempts at this game were exactly that.

Two of them make the same promise in the model and prove it in a test: **there is always
a way through**. A screen with no gap in it is not difficulty, it is a coin toss you lose.
Both games got that wrong first in the same way — a guarantee made when something is
spawned does not survive anything moving relative to anything else afterwards — and both
are fixed the same way, by freezing the relative geometry the moment it is laid down.

The meadow is the one game here that is not a 2D canvas. You stand in a field, turn to
look, and shoot at balloons that come up out of the grass in every direction — which
makes the hardest thing in it the thing behind you. It is three.js, and it is built out
of the same nothing as the rest: no models, no textures, no image files, a sky dome with
the gradient painted into its vertices, hills that are fogged rather than coloured, a
canvas of blotchy green tiled over the field, and a bow made of half a torus and two
rods for a string.

Two things in it are worth knowing about. The arrow is real: it leaves at the speed the
draw gave it, along the line you were looking down, and falls the whole way, so a balloon
twenty-five metres off has to be shot *above*. Nothing homes and nothing is nudged — the
forgiveness is all in how big a balloon is, and a test flies a bot at every range to
prove the arithmetic has not quietly started helping. And a hit is found by asking
whether the *line the arrow travelled this frame* passed through a balloon rather than
whether it is inside one now, because at full draw an arrow covers half a metre in a
frame and a balloon is a metre and a quarter across.

One finger does both jobs: drag and you are looking, hold still and you are pulling the
string, let go and it flies. There is no fire button, because a fire button on a phone is
a second thumb over the thing you are aiming at.

The outpost is the other three-dimensional one, and the first game here you can walk
around in. You are dropped into a walled compound at night with somebody's nan locked in
a cage at the far end of it, and you have to shoot your way to her and walk her back to
the chopper.

**You are not shooting people.** This app had that conversation once already — the
swarm's first build put a crowd of little figures in front of a gun and the verdict was
immediate, "it seems like I'm shooting people, that's not the idea" — and the answer
here is the thing the whole app is about. {papa} builds machines; the compound is full
of them; they clatter, spark and power down. The only person inside the wire is the one
you have come to get out.

The arithmetic is the lock on her cage. Every machine carries a fuse with a number
glowing on its back, the cage door wants a total, and you have to work out which of the
fuses on your belt make it — and which number you are still missing. That last part is
the whole trick: a door that only says "no" teaches nothing, so this one says *you have
nine, find six*, and sends a nine-year-old back out into the dark looking for a six. It
is a sum with legs.

The compound is generated and never cut in two: buildings are stamped into the yard one
at a time and taken straight back out again if they wall anything off. A bot plays whole
missions in the tests — shooting what it sees, fetching the numbers it is short of,
opening the cage and walking her home — across a dozen maps nobody has ever looked at,
because the standing promise in this project is that there is always a way through and
the only way to keep a promise like that is to send somebody through. Missions come out
at about a minute each, which is what that bot is really measuring.

Two thumbs, both drawn on the screen: a stick that appears wherever your left thumb
lands, the right-hand side of the picture to look with, and a trigger. And an arrow at
the top pointing at whatever you are supposed to be doing next, because a dark compound
with eleven ways out of every yard is atmospheric for about ninety seconds and is then
just lost.

The scales are the one game here that is *about* its maths rather than carrying some
along. A beam balance, a rack of brass weights marked 1, 2, 4, 8, 16, 32, 64, 128 —
one of each and no more than one — and crates coming along a belt to be balanced.

Which weights are on the pan is a binary number, biggest on the left, exactly as it is
written down. So making 45 is not a procedure to remember, it is four weights and a
beam that tips to tell you which way you are wrong; and the row of 1s and 0s under the
bench writes down what your hands just did. Four kinds of crate come along the belt:

Eight jobs come along the belt, in four pairs, and each pair is one idea read in both
directions:

- **weigh / name** — it says 45, make it; or the weights are already on and the crate is
  a mystery. Decimal into binary, and back out again on the pad that replaces the rack.
- **power / exponent** — it says 2⁶ and wants exactly that weight, not 64 made of smaller
  ones; or it says 16384 and wants the power typed. The second is the one job not limited
  by what the rack can lift, so it goes to 2²⁰ — lifting that would want a weight the size
  of the bench; naming it wants nothing but knowing it.
- **double / halve** — the pan arrives with 87 on it and the crate says ×2, or with 174
  on it and the crate says ÷2. Every weight takes one step to the left, or one to the
  right. Place value, with handles on it.
- **carry / borrow** — the crate says 17+87 and the pan arrives with the two of them
  poured on together: three 32s and an 8, so tap a pair and they become the next one up.
  Or the crate says 104−17 and arrives with 104 on it — and seventeen is 16+1, neither of
  which is on the pan to lift, so a weight has to be broken into two of the next one down
  until it is. Binary addition and binary subtraction, both done with a thumb, and in
  both of them the pan visibly goes on weighing the same while you work.

Borrowing has two named moves on the screen, TAKE OFF and BREAK IN TWO, and the first go
at it had one clever button instead: a weight that would not come off whole broke in two.
It read well and it was wrong. Working 104−17 the way it is worked on paper means
breaking the 8 open to find a 1 — and the 8 was affordable, so the clever button lifted
it instead, and the pencil-and-paper method was the one thing the machine would not let
you do. A rule that forbids the correct method is not a harder game.

The pan is never allowed under what the crate asks for. That is what makes the job safe:
from wherever anybody has got to, breaking the smallest weight again and again always
reaches something small enough to take off, and once the pan is level every pile goes
together and it tidies itself into the answer written in binary.

The rack grows a weight a level: five of them to begin with, which is nought to
thirty-one, and twelve by the eighth, which is 4095. A wrong answer costs two seconds and
nothing else — no life, no buzzer, and the number you typed is rubbed out so the next
go starts clean. The only thing that can actually beat you is the belt.

The arithmetic is checked against the language's own for every number the rack can
hold, carrying is checked to never change what the pan weighs, and a bot clears whole
levels doing the conversions itself rather than reading the answers off the crates —
because a game that quietly teaches that 45 is 101110 would be worse than no game.

The yard is the scales' sibling, for the shapes module. A sheet of ply marked out in
squares, a cutting press, and orders on the board; you drag a rectangle out of the
sheet and press the press.

The whole design turns on one choice: **you are not asked what the area of a shape is,
you are asked to make one.** "4 by 6, what's the area" is a sum with a picture next to
it. "Cut me 24 squares" and left to find 4 by 6 — or 3 by 8, or 2 by 12 — is the same
arithmetic from the other end, and it is a better end, because it is where factors live
and it cannot be done by multiplying the two numbers you were handed.

- **panel** — so many squares. Area, and the factor pairs that make it.
- **edging** — so much edge. Perimeter, which is the one everybody confuses with area
  until they have had to make both. Both of these arrive on the first level, because you
  cannot confuse two things if you have only met one.
- **exact** — so many squares *and* so much edge. Both at once, which has exactly one
  answer: the sides are the product and the sum, so they are the roots of a quadratic,
  and it is solved by knowing your factor pairs and checking their edges.
- **slant** — a triangle. The press cuts corner to corner, so an order for 35 squares
  wants a rectangle of 70: doubling, and then factoring. Half base times height is the
  one area formula that has to be *seen* to stop being letters, and the board shows the
  rectangle's squares and half of them side by side, because the step between those two
  numbers is the whole job.
- **tank** — so many cubes, built as a floor you drag and a depth you count up, so that
  length times width times height is three things you did rather than three letters.
- **skin** — the outside of a tank, all six faces of it. Said on the screen as two faces
  the size of the floor and a band right round the sides, rather than as 2(lw+lh+wh),
  because the first one is a thing you can see and the second is four letters.

The press will not take anything thinner than two squares. That rule is the game: without
it an order for sixteen squares is filled by dragging a strip one square wide and
sixteen long, which is correct, instant, and the one factor pair nobody has to think
about. The probe that plays the yard in a browser found that shortcut on its first order
and took it every time after, which is how the rule got written.

A bad cut costs three seconds and the board says what was wrong with it — "20 squares,
not 24" — rather than just no. Being told which way you are out is the difference
between guessing again and thinking again.

The road is a race proper: a staggered grid painted on the tarmac, three red lights, and
a clock that starts when they go out and does not stop for a crash. The drive that set
each best time is kept and replayed as a pale car alongside you — which is the nearest
thing to racing another person that works with one phone, no server and nobody else in
the room: one of you sets a time and the other races the car that set it. The result is read the way a
result is read — the winner's time, and everybody else's gap to it — and your best time
on each stage is kept on the device, so the thing to beat is your own from yesterday.

The road's field of racers is the exception that proves it. A racer is not traffic: it
moves at its own speed, so it can drift into the one lane the spawner left open and shut
the road, and no check made when it was put out there would catch that. So the promise is
enforced continuously on the one body that can break it — a racer will not sit in the last
open lane of the stretch you are arriving in, and gets out of it without waiting to
indicate. There is a test that plays every stage watching for a wall.

## The maths, and the workshop

**No game asks a sum.** Being handed one at the moment you lose a life is a punishment
wearing a reward's coat, so what interrupts a game now is a fact — something true you did
not know — and it is never marked. **A question answered correctly is never asked again**,
which turns the bank of two hundred-odd into a supply rather than a rotation.

The maths lives in the workshop, behind a door you only go through when you want
something. Every game pays coins into one purse; sums pay faster. The shelf sells the same
few permanent upgrades whichever game you play — a spare life, a bigger tank, a deeper
jetpack — each one a single number a game reads once when a run starts. That is the whole
design: **maths is the shortcut, never the toll.**

## The voice

The lines are rendered in advance by a neural voice that runs on the machine doing the
building, and shipped as small Opus clips — `python3 scripts/render-voice.py`, with
[Piper](https://github.com/rhasspy/piper) and two voices from its collection. Anything not
in the set still falls back to the browser's synthesiser, so a line written after the
clips were made is spoken rather than skipped.

The synthesiser was the original answer, and on Android every voice it offers is the same
engine wearing a different accent. Three reports of "the voice is not good" and one
"they all sound the same" is a clear enough verdict.

## The music

Six chiptune loops and six sets of cues, each set pinned to the scale of the loop it
interrupts, so a sound effect sounds like the tune it lands on rather than arriving from
somewhere else. Everything is a handful of oscillators: no samples, no files.

Every loop that plays under a game also has a **heat**: one number, raised by the game as
things get worse — the board emptying, the clock running down, the last shield, the last
stretch of the run. Voices marked with a threshold fade in as it climbs, the drums swap
for a harder pattern, and the tempo creeps up by about ten beats a minute. The caves have
no drum track at all until the heat arrives, which is the loudest thing it does anywhere.
It is the same eight bars either way; what changes is how many things are playing them.

## Papa Panic

A maze, a lot of dots, and four chasers who each think differently:

| | How it hunts |
|---|---|
| **{papa}** | Straight at you. Relentless |
| **Bolt** | Four tiles in front of you, so it arrives where you are going |
| **Cog** | Takes the point two ahead of you and doubles the line from {papa} through it |
| **Rivet** | Bold at a distance, loses its nerve within eight tiles |

That is the whole reason the original survived: the chasers converge from different angles
and the maze develops a shape you can learn. They never reverse of their own accord, which
is what lets you shake one off by doubling back, and ties at a junction resolve in a fixed
order so the same situation always plays out the same way.

Scatter and chase alternate on a shrinking schedule. The periodic reversal is not
decoration — greedy steering can circle a fixed target forever, and the phase change is
what breaks the loop.

## The shop

**Maths buys power, never permission.** Solving a problem earns a spare life, a longer
power pellet, or a freeze that stops all four chasers dead. A harder problem earns a better
prize, and getting one wrong costs nothing at all.

This distinction is the whole design. The evidence on undermining intrinsic motivation
turns on whether a reward is contingent on *performance* rather than on mere
participation — so tying the prize to difficulty is what keeps this from being a tax on
fun. Almost all of it is optional; a child who enjoys the problems walks into a level
considerably stronger. Only a game over costs a compulsory one, and that is the coin slot.

## The problems

| Generator | What it is really about |
|---|---|
| **Rectangle Hunt** | Arranging blocks into rectangles — which is factoring, without the word |
| **Fraction Duel** | Comparing fractions, with pairs built so the easy rules stop working |
| **Short Circuit** | Counting routes through a grid; walks into Pascal's triangle unaided |
| **{papa}'s Mistake** | Finding the first wrong line in someone else's working |
| **Faulty Wiring** | Knights-and-knaves deduction, with no arithmetic at all |
| **{papa}'s Mixture** | Ratio and proportion, from both ends and then chained |
| **{papa}'s Prices** | Percentages — and the thing that makes them hard, which is keeping hold of what the hundred is |
| **The Gearbox** | Factors, primes, and the two numbers nobody names: two cogs come back round together after the lowest common multiple of their teeth |
| **{papa}'s Crates** | Solving for an unknown, on a beam, with the letters taken off |

The last four were added when the module changed. Ratio, percentage, factors and the
unknown are four of the things a grade five or six syllabus is made of, and none of them
had any road here at all — and the five above them were re-pitched at the same time,
because their bottom rungs were written for a seven-year-old and a session was being
spent climbing past them.

Two of them are worth saying out loud. **The Gearbox** never writes "LCM" or "HCF" until
the explanation: two meshing cogs come back round together after the lowest common
multiple of their teeth, and that is not a definition, it is a thing that happens on a
bench. **{papa}'s Crates** is algebra with the notation taken off — a letter standing for
a number is a notation problem on top of a reasoning problem, and the reasoning problem
is the one worth having, so it is a sealed crate on a beam and the two rules are things
you can see: take the same off both sides, and share both sides equally.

Every generator is seeded, machine-verifiable and unbounded in difficulty, and every one
of the new ones is checked in the tests against arithmetic worked out independently
rather than against its own — a generator that agrees with itself about 20% off 48 is no
use to anybody. Difficulty is an Elo rating shared by player and problem, with a short
warm-up pitched to be got right before it starts hunting for his ceiling.

## Privacy

The repository is public; the family using it is not. No real name, photograph or
recording is in version control, and none is ever sent anywhere. Names are entered on the
device. Speech is synthesised in the browser. All progress is local.

## Running it

```bash
npm install
npm run dev        # development
npm test           # maze, chasers, game loop, generators, engine
npm run build      # production build
npm run preview    # serve the build, then:
npm run smoke      # play the maze in a real browser
```

`scripts/` holds a probe per game that plays it in a browser — `scales-look.mjs` works
through all eight jobs and eight levels, `yard-look.mjs` fills all six kinds of order,
and `lab-look.mjs` reads problems in the workshop looking for the two things no unit
test can see: an unfilled `{papa}` on the screen, and a question that runs off the side
of a phone.

Pushing to `main` builds and publishes to GitHub Pages. Pages must be switched on once by
hand under **Settings > Pages > Source: GitHub Actions** — a workflow cannot do it.

## Layout

```
src/
  arcade/maze/   maze, chasers, game loop   — unit tested
  arcade/dungeon/ movement rules, sequences — unit tested (parked; see above)
  mob/           the lane, the gates, the waves — unit tested
  dave/          caves, solver              — unit tested
  pipes/         levels, physics            — unit tested
  road/          traffic, fuel, missions    — unit tested
  space/         the solar system, hazards  — unit tested
  arcade/        shop, taunts               — unit tested
  content/       problem generators         — unit tested
  engine/        rating, persistence        — unit tested
  intro/         the six stories, drawn from real game footage
  music/         tracker notation, scheduler, heat — unit tested
  render/        procedural sprites, voxels
  screens/       one per game, plus Shop, Coop, Settings, Studio, Note
```
