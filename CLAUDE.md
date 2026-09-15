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

## The shop

- **Maths buys power, never permission.** A harder problem buys a better prize; a wrong
  answer costs nothing. Making the game contingent on the maths would turn it into a tax
  on fun, and the research this rests on turns on the reward being contingent on
  performance rather than participation. Do not convert the shop into a gate.
- Only a game over costs a compulsory problem, and it is pitched easier than anything in
  the shop. It is a coin slot, not a test.

## Rendering

- Characters are procedural sprites extruded into voxels. A new character costs a seed.
- **Per-instance colour on an `InstancedMesh` comes from `instanceColor`, not
  `vertexColors`.** Setting `vertexColors: true` makes the shader look for an attribute
  that is not there and everything renders black.
- **Colours must be written `hsl(h, s%, l%)` with commas.** Canvas accepts the modern
  space-separated form; three.js does not, and silently renders white.

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
