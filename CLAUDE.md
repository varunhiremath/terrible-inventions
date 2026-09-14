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

## The world

- `src/world/` holds the map, the characters and the canvas renderer; `src/screens/World.tsx`
  runs it. Movement lives in refs against an animation frame — never put the player
  position in React state, and keep the world screen's store subscriptions narrow, or the
  loop restarts on every unrelated change.
- Machines are characters with names and dialogue, never topic labels. A new machine needs
  a name, a personality, a fault that matches its problem kinds, and lines for all three
  states (broken, just fixed, working).
- Every mission must visibly change the world. A repaired machine stops shaking, loses its
  marker and says something. That payoff is the point of the structure; do not add a
  mission that leaves the place identical.
- `map.test.ts` flood-fills from the spawn to prove every room is reachable, and checks the
  rows are a consistent length. Keep both — a short row silently becomes wall and can seal
  a room off.

## Conventions

- Run `npm test` and `npm run build` before pushing. Both must be clean.
- `npm run smoke` needs a preview server running; set `CHROMIUM_PATH` if Playwright
  cannot find a browser.
- Engine and content changes need tests. The selector and the generators are where a
  silent bug does the most damage — a broken scheduler ruins the product without
  throwing anything.
- iPad first. Touch targets at least 60px, never use the system keyboard for numbers
  (`src/ui/Keypad.tsx` exists for this), and keep the layout working at phone width.
- Voice lines live in `src/voiceLines.ts`. Ids are storage keys and filenames — add
  freely, never renumber. Keep several takes per cue.
- Tone: {papa} is hopeless and cheerful about it. The app is never disappointed in the
  player, and never congratulates him on being clever — only on what he actually did.
