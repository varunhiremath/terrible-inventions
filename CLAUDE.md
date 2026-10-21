# Working on this repository

A personal maths app for one child. Read `README.md` first — it explains why the design
is shaped the way it is.

## Non-negotiables

These are not preferences. Breaking one defeats the point of the project.

1. **No real names, faces or voices in git.** The repository is public. Names live in
   IndexedDB on the device; authored strings use `{kid}` / `{papa}` and are rendered
   through `fill()` from `src/config/profile.ts`. Voice clips are recorded in-app and
   kept in IndexedDB; `public/voice/` and `public/faces/` are gitignored and must stay
   that way. Never add an upload path for recordings. Never put a real name in a commit
   message, a comment, a test fixture or a branch name.

2. **No scores in the interface.** No percentage, no accuracy, no streak, no
   correct-out-of-total, no leaderboard — on any screen. The counter on the Lab
   deliberately counts problems *attempted*, not problems solved. `scripts/smoke.mjs`
   asserts this about the summary screen; keep that assertion working.

3. **Difficulty stays unbounded.** Generators take a rating on the Elo scale and must
   keep getting harder. A generator that runs out of road raises `maxRating` honestly so
   the selector can skip it — it never clamps and repeats. Do not add a level cap.

4. **Hints are free.** Never gate them, count them against the player, or show them as
   a cost.

5. **Every generator is seeded, verifiable and unbounded.** The answer is computed, not
   authored. If a puzzle type cannot be machine-checked for a unique solution, it does
   not go in.

6. **Co-op puzzles must be unsolvable from one hand.** `split-clues` gets this from a
   minimal clue set: remove any single clue and the answer stops being unique, so every
   proper subset is ambiguous and any split is fair. Never add a clue after pruning to
   make a puzzle nicer — it breaks the guarantee. The tests assert union-unique and
   each-half-ambiguous on every generated puzzle; keep them.

7. **Co-op results never touch the rating.** The rating estimates what the child can do
   alone. Two-player results go to `coopLog`, separately.

8. **No backend, no telemetry, no accounts.** If remote co-op is added later it may carry
   game state through a relay, but never the player's name, voice or progress.

## The arcade

- `src/arcade/maze/` is the game: maze, chasers, loop. All pure and unit tested; the
  screen only draws it.
- **The maze is authored as a left half and mirrored.** Never hand-edit the full rows —
  the tests flood-fill for unreachable dots and walled-off tiles precisely because
  hand-drawing seals corners off silently.
- **Chasers never reverse of their own accord.** That is what lets a player escape by
  doubling back, and removing it would gut the game. Ties at a junction must stay in a
  fixed order so situations are learnable.
- **Greedy steering can circle a fixed target forever.** That is expected, and the scatter
  phase is what breaks the loop. Do not "fix" it with pathfinding; test the chase against
  the real game instead, where the player moves.
- **The simulation runs in fixed slices, never by frame time.** Stepping by however long
  the last frame took makes a slow device play the whole game in slow motion rather than
  drop frames. There is a test comparing coarse and fine stepping; keep it.
- **The player must start well clear of every chaser.** A spawn four steps from one meant
  dying before the first dot. There is a test asserting the distance.
- The opening pause is not decoration — a level that begins mid-chase is unfair rather
  than exciting.

## The pipes

- **The end of a level is a reward, not a test.** While the flag sequence runs, nothing
  else moves: no clock, no enemies, no input. A koopa walking into him halfway down the
  pole would be the meanest death in the app, and a player who caught the top once and
  died for it would never try for it again.
- **The flag bands are bands on purpose.** Six of them, topping out at 5000 for the ball
  itself. A sliding scale that creeps up by eleven for a slightly better jump teaches
  nothing; a band you can aim at turns the last jump of every level into a decision.
- **`win` fires exactly once**, at the end of the walk-off, and the fanfare is the
  longest cue in the app. A status that re-announces itself every frame stacks hundreds
  of copies of a cue past full scale — this project has fixed that buzz twice already,
  and `flag.test.ts` counts the event over the whole sequence to keep it fixed.

## The swarm

- **Two curves, one factor.** A wave's monsters are forty per cent tougher than the last
  wave's, and each rung of the gun ladder hits forty per cent harder than the one below.
  One rung a wave keeps you level. Break that and the game breaks: when the ladder grew
  faster, a bot held the best gun in the game two minutes in and five minutes passed
  without it losing a life — and what found it was a wave's health going up by a third
  and *nothing in the outcome changing*, which is what a number nobody is bound by looks
  like.
- **Crates have the outside lanes to themselves and the crowd never walks there.** When
  they came down the same columns as the monsters, a bot that never once aimed at a crate
  opened every crate in the game with shots meant for the crowd. Going for one has to
  mean leaving the crowd, or there is no decision to make.
- **Crates are priced in seconds, written as hits.** The same twelve hits is four seconds
  of a Peashooter and one and a half of a Thunderclap, so a price set in hits stops being
  a decision by wave ten. `cratePair` sets the price in seconds and converts at the gun
  in hand.
- **`arriveIn` has to be exactly right.** It is half of every sum the player does, so it
  reads the real position and the real pace of whichever monster is genuinely nearest. A
  countdown that is approximately right teaches arithmetic that is approximately wrong.
- **One pair of racks a wave, and opening one takes the other away.** It is a choice,
  not a shopping list.
- **A gun is never handed over directly.** Shooting a rack open drops the gun on a
  parachute to be caught, so there is exactly one kind of thing to catch and the racks
  are where the good ones come from. It also tripled what a badly timed rack costs: the
  bot that grabs regardless went from losing twice what the careful one loses to losing
  six times as much.
- **They walk towards the camera, not across it.** Feet move up and down, never
  sideways; the body rocks over whichever foot is planted. The first version swung the
  legs left and right, which is the stride for something crossing the screen, and it
  read exactly like that — a crowd shuffling sideways while sliding down the bridge.
- **A wave is cleared by shooting it.** A monster that crosses the line costs a life and
  stays on the board; removing it would let a wave be "cleared" by standing still.
- **`balance.test.ts` is the design, not a benchmark.** Four bots: does the sum, grabs
  greedily, never buys, never moves. If the first two come out level, the crates are
  decoration. Keep it.
- **The crowd opens *on* the bridge, not above it.** Every row used to start off the top
  of the screen and walk in at half a unit a second, so the first twenty seconds of every
  wave was an empty bridge and a soldier firing at nothing — which is what "dull and
  slow" turned out to mean. `OPENS_AT` puts the front row in view on the first frame.
- **Breeds are told apart by build before colour** — a runner leans, a lurcher is wide, a
  brute is half again as tall with shoulders to match. Scaling one drawing up for the
  brute gave a blob with wings; it has its own silhouette now. `cast.html` draws all four
  plus the drops, the turret and every gun, which is the only way to see that.
- **Nothing in here is gruesome.** No blood, no bones. A crowd shambling at you is
  exactly as tense drawn kindly, and who plays this decides that.

## The shop

- **Maths buys power, never permission.** A harder problem buys a better prize; a wrong
  answer costs nothing. Making the game contingent on the maths would turn it into a tax
  on fun, and the research this rests on turns on the reward being contingent on
  performance rather than participation. Do not convert the shop into a gate.
- Only a game over costs a compulsory problem, and it is pitched easier than anything in
  the shop. It is a coin slot, not a test.

## Controls

- **Every control must be visible on screen.** Swipe and arrow keys both worked in a
  build that was still unplayable, because nothing told the player they existed. The
  smoke test asserts the on-screen pad is present and drives the game; keep it.

## Rendering

- Characters are procedural sprites extruded into voxels. A new character costs a seed.
- **Per-instance colour on an `InstancedMesh` comes from `instanceColor`, not
  `vertexColors`.** Setting `vertexColors: true` makes the shader look for an attribute
  that is not there and everything renders black.
- **Colours must be written `hsl(h, s%, l%)` with commas.** Canvas accepts the modern
  space-separated form; three.js does not, and silently renders white.
- **A board game uses an orthographic camera.** Perspective makes the far side of a maze
  smaller than the near side, and the grid a player is reasoning about stops being square.
- **A first-person view is composed for a phone held upright.** Portrait is about forty
  degrees across and seventy down, so anything held in shot — a bow, a gun — needs
  placing against the *narrow* axis. The meadow's bow was first put where it would sit
  in a landscape window and filled the middle of the screen with a brown hoop; canting
  it by turning the group parented to the camera then swung the whole thing off the
  side, because that rotates it about your eye rather than about the bow. Tilt the mesh,
  not the hands.
- **Characters seen from overhead must be laid flat** (`buildVoxel(..., { flat: true })`).
  An upright sprite is five voxels thick and from above that is all you see.

## Conventions

- Run `npm test` and `npm run build` before pushing. Both must be clean.
- `npm run smoke` needs a preview server running; set `CHROMIUM_PATH` if Playwright
  cannot find a browser.
- Engine and content changes need tests. The selector and the generators are where a
  silent bug does the most damage — a broken scheduler ruins the product without
  throwing anything.
- iPad first. Touch targets at least 60px, never use the system keyboard for numbers
  (`src/ui/Keypad.tsx` exists for this), and keep the layout working at phone width.
- Voice lines live in `src/voiceLines.ts` and taunts in `src/arcade/taunts.ts`.
- Tone: {papa} is smug and beatable. He gloats, he is a terrible loser, and he is
  transparently meant to be beaten. He is never disappointed in the player. The app is never disappointed in the
  player, and never congratulates him on being clever — only on what he actually did.
