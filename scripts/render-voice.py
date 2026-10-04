"""
Render every spoken line to an audio file, once, here.

The phone's own speech synthesiser was the original answer: no key, no
network, nothing leaves the device, and it speaks any line ever written. The
trouble is how it sounds. It was reported as "not good" three times, and the
last report was the telling one — "even if I loop over all the available
countries they all sound the same", which is exactly right, because on Android
they are all the same engine wearing different accents.

So the lines are rendered here instead, with a neural voice that runs locally,
and shipped as audio. The set of lines is known and small: the six intro
stories, the taunts, and a handful of one-liners. Anything not in the set still
falls back to the synthesiser at runtime, so nothing ever goes silent.

    pip install piper-tts soundfile
    python3 scripts/render-voice.py

Voices are Piper's (MIT), from the rhasspy/piper-voices collection.
"""
import glob
import hashlib
import io
import json
import os
import re
import sys
import wave

import numpy as np
import soundfile as sf
from piper import PiperVoice, SynthesisConfig

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HERE, 'public', 'spoken')
MODELS = os.environ.get('PIPER_MODELS', '/tmp')

# Two speakers. The narrator sets the scene; the villain is a different person
# entirely, and a story where both are read by the same voice is a story read
# by one person doing both parts.
SPEAKERS = {
    'narrator': 'en_GB-alan-medium',
    # Chosen by ear out of five candidates put on a page and listened to on a
    # phone. There is no Indian-English Piper voice at all; this is the closest
    # thing to the Indian-and-American mix that was asked for.
    'papa': 'en_US-kusal-medium',
}

# What the placeholders become. The repo never contains a real name — these
# are the defaults the app itself shows when nobody has set one.
FILL = {'{papa}': 'Papa', '{kid}': 'you'}

# --- how Papa talks ----------------------------------------------------------
#
# The voice was asked to be funnier, and funny in a read-aloud line is mostly
# two things: pace and variety. A flat, even delivery is what makes a machine
# sound like a machine, and it is also what makes a joke die.
#
# So three dials, and the third matters most.
#
# LIFT       plays the finished clip back faster than it was recorded, which
#            raises its pitch with it — the oldest trick there is for making a
#            voice sound daft. Measured rather than guessed: 1.12 takes him
#            from about 114 Hz to about 128, which is bright and pleased with
#            itself without tipping into squeaky.
# PACE       is how slowly Piper is asked to say it in the first place, and it
#            exists to take the tempo back off the lift. Raising pitch by
#            speeding a recording up also makes it gallop; asking for a
#            slightly slower read first means the pitch comes without the
#            gallop, and what is left over is chosen on purpose. 1.05 against a
#            1.12 lift leaves him about six per cent quicker than before, which
#            is roughly the difference between reading a line and performing
#            one.
# WOBBLE     is Piper's own variability in how long each sound is held. Turned
#            up, he stops metering syllables out evenly and starts leaning on
#            some of them.
# SWING      varies the pace per line, seeded off the words, so the fifteenth
#            thing he says does not arrive at the same clip as the first. This
#            is the one that stops a run of lines sounding like a list being
#            read out.
#
# The narrator gets none of it. He is the straight man, and half of why Papa is
# funny is that the other voice in the story is not.
PAPA_LIFT = 1.12
PAPA_PACE = 1.05
PAPA_WOBBLE = 1.3
PAPA_SWING = 0.07


def delivery(voice, line):
    """Piper's settings for one line, and what to do to the audio afterwards."""
    if voice != 'papa':
        return SynthesisConfig(), 1.0
    # Seeded off the line itself, so a given line always sounds the same — a
    # clip that came out differently on every render would mean re-uploading
    # ninety files for no reason.
    swing = (hashlib.sha1(line.encode()).digest()[0] / 255 - 0.5) * 2 * PAPA_SWING
    return (
        SynthesisConfig(
            length_scale=PAPA_PACE * (1 + swing),
            noise_w_scale=PAPA_WOBBLE,
        ),
        PAPA_LIFT,
    )


def lines_from_stories(path):
    """
    Every beat's voice and line.

    Matched as one pattern rather than by carving the beat out first. Carving
    it out was the first attempt and it stopped at the first closing brace it
    found — which, on any line containing `{papa}`, is inside the line itself.
    Those beats silently produced no clip, and the ones that mattered most
    (the opening line of four of the six stories) were exactly the ones with
    his name in them.
    """
    text = open(path).read()
    for voice, line in re.findall(r"voice: '(\w+)', line: '((?:[^'\\]|\\.)*)'", text):
        yield voice, line


def lines_from_taunts(path):
    text = open(path).read()
    for line in re.findall(r"'((?:[^'\\]|\\.)*)'", text):
        # Taunts are sentences; the file also holds keys and ids, which are not.
        if len(line) > 12 and (' ' in line):
            yield 'papa', line


def lines_from_openers(path):
    """
    The one-liners each game opens with, from the module that holds them.

    They used to be written inline at each call site and scraped from there,
    which meant a reworded call site silently lost its clip. One list, read by
    the app and by this.
    """
    text = open(path).read()
    for line in re.findall(r": '((?:[^'\\]|\\.)*)',", text):
        yield 'papa', line


# Opus only speaks a few sample rates and Piper's 22,050 is not one of them.
OPUS_RATE = 24000


def lowpass(audio, cut, rate, taps=129):
    """A windowed-sinc, zero phase, for use before throwing samples away."""
    n = np.arange(taps) - (taps - 1) / 2
    h = np.sinc(2 * cut / rate * n) * np.hamming(taps)
    h /= h.sum()
    return np.convolve(audio, h, mode='same').astype('float32')


def resample(audio, rate, to):
    """
    Linear resampling, with the filter that has to come first when going down.

    Throwing samples away without filtering first folds everything above the
    new Nyquist back down into the audible band, and the lift below goes down
    by twelve per cent. Worth saying how much this actually mattered, because
    it was a suspect for the crackling and it is not the culprit: a control
    tone above the new Nyquist comes back six million times quieter with the
    filter than without, so the filter works — but on real speech the aliased
    band is half a per cent of the signal and the filter removes a tenth of
    that. It is here because it is correct, not because it fixed anything.
    """
    if rate == to:
        return audio
    if to < rate:
        audio = lowpass(audio, to / 2 * 0.92, rate)
    want = int(round(len(audio) * to / rate))
    return np.interp(
        np.linspace(0, len(audio) - 1, want),
        np.arange(len(audio)),
        audio,
    ).astype('float32')


# --- how loud a clip comes out ------------------------------------------------
#
# Reported as a crackling noise on some of the spoken lines, and the measuring
# is worth keeping because three likelier-sounding suspects were wrong.
#
#   The music     could not be it. The loudest moment in any tune or cue sums
#                 to 0.67 of the mixer before the master gain of 0.27 — 0.18 out
#                 of a possible 1.0, and a cue on top of a tune is 0.28. There
#                 is no arithmetic by which that clips.
#   The aliasing  could not be it either; see resample above.
#   The bitrate   is 38 kbps of Opus at 24 kHz, which is fine for speech.
#
# What was left is that Piper normalises every clip to a peak of exactly 1.0,
# so these went out with no headroom whatsoever: thirty-one of the eighty-four
# shipped files had samples at or past full scale after encoding, the worst at
# 1.023. A decoder hands those to a phone that is also playing a game, and the
# mixer has nowhere to put them.
#
# So every clip is brought to the same loudness and then held well under the
# ceiling. Both halves matter: the peak is what stops the crackle, and the
# loudness is what stops one line arriving four decibels louder than the last.
TARGET_RMS = 0.11
CEILING = 0.72


def level(audio):
    """One loudness for every line, and room above it."""
    rms = float(np.sqrt(np.mean(audio ** 2)))
    if rms > 1e-6:
        audio = audio * (TARGET_RMS / rms)
    peak = float(np.max(np.abs(audio)))
    if peak > CEILING:
        audio = audio * (CEILING / peak)
    return audio.astype('float32')


def key_of(voice, line):
    """What the runtime will look a clip up by: the line as written, unfilled."""
    return hashlib.sha1(f'{voice}|{line}'.encode()).hexdigest()[:16]


def main():
    os.makedirs(OUT, exist_ok=True)
    wanted = {}
    for voice, line in lines_from_stories(os.path.join(HERE, 'src/intro/stories.ts')):
        wanted[key_of(voice, line)] = (voice, line)
    for voice, line in lines_from_taunts(os.path.join(HERE, 'src/arcade/taunts.ts')):
        wanted[key_of(voice, line)] = (voice, line)
    for voice, line in lines_from_openers(os.path.join(HERE, 'src/lines.ts')):
        wanted[key_of(voice, line)] = (voice, line)

    """
    A line that already has a clip is left alone.

    Piper is not deterministic: re-running it over a hundred unchanged lines
    rewrote every one of them, with durations moving by up to two seconds in
    both directions. Nothing was wrong with the new readings, but every clip in
    the repository was a changed binary and the narration of eight games had
    quietly been re-read because one new game needed ten lines.

    So the only thing a run does is fill in what is missing and throw away what
    is no longer wanted. To deliberately re-record everything, delete the
    folder first — which is then an obvious thing somebody did on purpose.
    """
    have = {
        os.path.basename(path)[: -len('.opus')]
        for path in glob.glob(os.path.join(OUT, '*.opus'))
    }
    kept = {}
    if os.path.exists(os.path.join(OUT, 'index.json')):
        with open(os.path.join(OUT, 'index.json')) as f:
            kept = json.load(f)
    todo = {k: v for k, v in wanted.items() if k not in have or k not in kept}

    print(f'{len(wanted)} lines, {len(todo)} to render')

    loaded = {}
    index = {k: v for k, v in kept.items() if k in wanted and k in have}
    total = 0
    for key, (voice, line) in sorted(todo.items()):
        model = SPEAKERS.get(voice, SPEAKERS['narrator'])
        if model not in loaded:
            path = os.path.join(MODELS, f'{model}.onnx')
            if not os.path.exists(path):
                print(f'missing model {path}', file=sys.stderr)
                return 1
            loaded[model] = PiperVoice.load(path)

        spoken = line
        for token, word in FILL.items():
            spoken = spoken.replace(token, word)

        config, lift = delivery(voice, line)

        """
        Synthesised, and checked, and synthesised again if it came out wrong.

        Piper occasionally returns something about thirty-two seconds long for
        a line of ten words. Not often, not the same line twice, and running
        that line again on its own produces the right two and a half seconds —
        so it is something going astray inside a voice that has already spoken
        a hundred times, and not anything about the words.

        It matters because nothing downstream could catch it. A long clip is a
        perfectly valid clip; it went into a build, and into the beat timings
        that are measured against these lengths, and the only reason it was
        noticed at all is that a story beat was asked to be thirty-two seconds
        long. Two of a hundred and four, on two consecutive runs.

        So: a clip gets as long as its words can account for, and a few goes to
        produce one.
        """
        words = len(spoken.split())
        most = words / 1.6 + 3
        audio = None
        rate = 22050
        for go in range(4):
            buffer = io.BytesIO()
            with wave.open(buffer, 'wb') as w:
                loaded[model].synthesize_wav(spoken, w, syn_config=config)
            buffer.seek(0)
            got, rate = sf.read(buffer, dtype='float32')
            if len(got) / rate <= most * 1.4:
                audio = got
                break
            print(
                f'  {key}: {len(got) / rate:.1f}s for {words} words, going again '
                f'({go + 1}) — "{line[:40]}"',
                file=sys.stderr,
            )
        if audio is None:
            print(f'{key}: never came out a sensible length — "{line}"', file=sys.stderr)
            return 1

        # And the lift: played back faster than it was recorded, which raises
        # the pitch with it. See the note on PAPA_LIFT.
        if lift != 1.0:
            audio = resample(audio, rate, int(round(rate / lift)))

        # Trim the silence Piper leaves at each end, which is most of a second
        # across ninety clips and is dead air in a game.
        loud = np.abs(audio) > 0.01
        if loud.any():
            first, last = np.argmax(loud), len(loud) - np.argmax(loud[::-1])
            pad = int(rate * 0.04)
            audio = audio[max(0, first - pad):min(len(audio), last + pad)]

        seconds = round(len(audio) / rate, 2)
        if seconds > most:
            print(f'{key}: {seconds}s for {words} words — "{line}"', file=sys.stderr)
            return 1

        out = os.path.join(OUT, f'{key}.opus')
        sf.write(out, level(resample(audio, rate, OPUS_RATE)), OPUS_RATE, format='OGG', subtype='OPUS')
        total += os.path.getsize(out)
        index[key] = seconds

    # Anything left over from a line that has since been reworded.
    #
    # A clip is named after the words in it, so changing a word writes a new
    # file and abandons the old one. Nothing read them any more, but they were
    # still being committed, still being deployed, and still being taken into
    # the service worker's cache on every phone — sixteen of them after one
    # pass of rewriting.
    dropped = 0
    for path in glob.glob(os.path.join(OUT, '*.opus')):
        if os.path.basename(path)[:-len('.opus')] not in index:
            os.remove(path)
            dropped += 1
    total = sum(
        os.path.getsize(os.path.join(OUT, f'{key}.opus')) for key in index
    )

    with open(os.path.join(OUT, 'index.json'), 'w') as f:
        json.dump(index, f, separators=(',', ':'), sort_keys=True)

    print(f'{len(index)} clips, {total / 1024:.0f} KB, {dropped} stale removed')
    return 0


if __name__ == '__main__':
    sys.exit(main())
