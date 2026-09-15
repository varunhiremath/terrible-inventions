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
| **Split Clues** | Two players, half the clues each, neither half solvable alone |

Every generator is seeded, machine-verifiable and unbounded in difficulty. Difficulty is
an Elo rating shared by player and problem, with a short warm-up pitched to be got right
before it starts hunting for his ceiling.

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

Pushing to `main` builds and publishes to GitHub Pages. Pages must be switched on once by
hand under **Settings > Pages > Source: GitHub Actions** — a workflow cannot do it.

## Layout

```
src/
  arcade/maze/   maze, chasers, game loop   — unit tested
  arcade/        shop, taunts               — unit tested
  content/       problem generators         — unit tested
  engine/        rating, persistence        — unit tested
  render/        procedural sprites, voxels
  screens/       Arcade, Shop, Coop, Settings, Studio, Note
```
