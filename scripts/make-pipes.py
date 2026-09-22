import json, random, sys
sys.path.insert(0, 'scripts')
from pipes import build

NAMES = ['The Waterworks', "Papa's Plumbing", 'The Deep End', 'Overflow', 'The Cistern']
out = []
for i, name in enumerate(NAMES):
    tries = []
    for attempt in range(30):
        rng = random.Random((i + 1) * 977 + attempt)
        tries.append({'name': name, 'rows': build(rng, i + 1)})
    out.append(tries)
print(json.dumps(out))
