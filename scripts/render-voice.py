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
import hashlib
import io
import json
import os
import re
import sys
import wave

import numpy as np
import soundfile as sf
from piper import PiperVoice

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

        buffer = io.BytesIO()
        with wave.open(buffer, 'wb') as w:
            loaded[model].synthesize_wav(spoken, w)
        buffer.seek(0)
        audio, rate = sf.read(buffer, dtype='float32')

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

    with open(os.path.join(OUT, 'index.json'), 'w') as f:
        json.dump(index, f, separators=(',', ':'), sort_keys=True)

    print(f'{len(index)} clips, {total / 1024:.0f} KB')
    return 0


if __name__ == '__main__':
    sys.exit(main())
