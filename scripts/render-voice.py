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
    'papa': 'en_GB-northern_english_male-medium',
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


def resample(audio, rate, to):
    """Plain linear resampling. These are voice clips, not master tapes."""
    if rate == to:
        return audio
    want = int(round(len(audio) * to / rate))
    return np.interp(
        np.linspace(0, len(audio) - 1, want),
        np.arange(len(audio)),
        audio,
    ).astype('float32')


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

    print(f'{len(wanted)} lines to render')

    loaded = {}
    index = {}
    total = 0
    for key, (voice, line) in sorted(wanted.items()):
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
        buffer = io.BytesIO()
        with wave.open(buffer, 'wb') as w:
            loaded[model].synthesize_wav(spoken, w, syn_config=config)
        buffer.seek(0)
        audio, rate = sf.read(buffer, dtype='float32')

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

        out = os.path.join(OUT, f'{key}.opus')
        sf.write(out, resample(audio, rate, OPUS_RATE), OPUS_RATE, format='OGG', subtype='OPUS')
        total += os.path.getsize(out)
        index[key] = round(len(audio) / rate, 2)

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

    with open(os.path.join(OUT, 'index.json'), 'w') as f:
        json.dump(index, f, separators=(',', ':'), sort_keys=True)

    print(f'{len(index)} clips, {total / 1024:.0f} KB, {dropped} stale removed')
    return 0


if __name__ == '__main__':
    sys.exit(main())
