# Terrible Inventions

A small, private maths app for one kid, built around hard problems rather than drills.

Papa builds machines. Every machine goes wrong in a specific mathematical way, and
somebody has to work out how. There is no subscription, no account, no server and no
analytics — it is a single page that runs offline on a tablet.

## Why it is built this way

Most maths apps for this age are fluency drills with a reward loop bolted on. That is
the wrong shape for a child already working above grade level: the ceiling arrives in
about a week. The design here follows the problem-solving tradition instead — genuinely
hard problems, presented so that a child wants to sit with them.

Four constraints fall out of that, and they drive most of the code:

**Difficulty has no ceiling.** Every generator takes a rating, not a level from one to
five, and keeps producing harder problems until it runs out of road — at which point it
declines to answer and says so, rather than quietly repeating itself. Player and problem
share one Elo scale, so the selector can aim at a chosen success rate by solving the
curve backwards.

**The app hunts for the player's level instead of protecting him from it.** The first
eight problems aim at a coin flip, which is where the estimate moves fastest; after that
it settles at about four in five, which is high enough to feel good and low enough to
bite. Every fifth problem is deliberately over his head and labelled as such before he
starts.

**Nothing is scored.** No percentages, no streaks, no correct-out-of-total, anywhere in
the interface. The evidence on children identified as gifted is that praising the result
pushes them toward defending a reputation for being clever, and the first thing to go is
any appetite for difficulty. The end-of-session screen reports only what the player
*did*: the hardest thing he cracked, where he kept going after a hint, what he took on.
The smoke test asserts that no score has crept in.

**Hints are free and unlimited.** Asking for help is never penalised and never recorded
as a failure.

## The problems

| Generator | What it is really about |
|---|---|
| **Rectangle Hunt** | Arranging blocks into rectangles — which is factoring, without the word |
| **Fraction Duel** | Comparing fractions, with pairs built so the easy rules stop working |
| **Short Circuit** | Counting routes through a grid; walks into Pascal's triangle unaided |
| **Papa's Mistake** | Finding the first wrong line in someone else's working |
| **Faulty Wiring** | Knights-and-knaves deduction, with no arithmetic at all |

Every generator is seeded, so a problem is reproducible from its seed; verifiable, so the
answer is computed rather than authored; and unbounded, so it scales past the player.
`Faulty Wiring` brute-forces every labelling before serving a puzzle, to guarantee the
solution is unique.

## Privacy

The repository is public; the family using it is not. No real name, photograph or
recording is in version control, and none is ever sent anywhere.

- Names ship as placeholders and are entered on the device, into that browser's
  IndexedDB. Authored strings use `{kid}` and `{papa}` placeholders.
- Voice recordings are made in the app's own booth (Settings > Record your voice) and
  stored in that device's IndexedDB. They are never uploaded and never committed. The
  booth can export them as a ZIP, and `public/voice/` accepts hand-placed files, but that
  directory is gitignored.
- All progress is local. There is no backend to leak, and no telemetry.
- Because storage is local, iOS can evict it — so Settings has a backup export.

## Papa's voice

The app plays recorded lines at eight cues — a greeting, a nudge, a warning that the next
problem is a hard one, and so on — with several takes per cue, picked at random so a clip
heard forty times does not turn into a sound effect.

The lines are in `src/voiceLines.ts`, and the largest group is deliberately the one where
{papa} admits a problem was hard. A child used to finding things easy needs to hear that
the adult he respects finds things hard too, and it lands better in a voice he knows than
in any amount of interface copy.

Recording happens in the app: Settings > Record your voice, read a line, tap to record,
tap to stop, listen back, redo if you like. The microphone needs a secure context, so it
works on localhost and over HTTPS.

## Running it

```bash
npm install
npm run dev        # development
npm test           # engine and generator unit tests
npm run build      # production build
npm run preview    # serve the build, then:
npm run smoke      # play a full session in a real browser
```

## Deploying

Pushing to `main` builds and publishes to GitHub Pages via `.github/workflows/deploy.yml`.

Pages has to be switched on once, by hand, under repository **Settings > Pages > Source:
GitHub Actions**. A workflow cannot do this for you — creating a Pages site is outside
what the build's `GITHUB_TOKEN` is allowed to do. Until it is switched on, the
`configure-pages` step fails and the deploy is skipped; everything before it still runs.

Once it is on, the app lives at `https://<user>.github.io/<repo>/` and every push
updates it.

CI sets `BASE_PATH` so the asset paths and the service worker's scope match the
subdirectory. Any other static host works too — leave `BASE_PATH` unset to build with
relative paths.

Note that a GitHub Pages site is public. Nothing personal is in the build: names, voice
and progress are all entered on the device and stay there.

## Installing it

Open the deployed URL on the device and add it to the home screen — Safari's Share menu
on iOS, Chrome's menu on Android. That gets the standalone, offline, no-browser-chrome
version, which is the way it is meant to be used. The microphone in the recording booth
needs HTTPS, which a Pages URL provides.

## Layout

```
src/
  engine/     rating, selection, persistence   — unit tested
  content/    the problem generators           — unit tested
  screens/    Lab, Gauntlet, Summary, Note, Settings
  ui/         keypad, per-problem inputs, primitives
  config/     the names placeholder layer
scripts/      icon generation, browser smoke test
```
