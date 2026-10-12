# Playing on two devices

One of you runs the race and the other drives one of the cars in it. The two
devices need something in the middle to pass messages between them, because a
browser can open a connection but cannot accept one. That is all this folder
is: a relay with two seats to a room, which never looks inside a message and
keeps nothing.

It cannot run on a phone. Not won't — can't, twice over: a web page is not
allowed to sit and wait for someone to call it, and even if something else on
the phone did the waiting, the app would not be allowed to call it (the section
below the steps says why, and it was measured rather than assumed). So the relay
goes on the internet, where it is free and where there is nothing to keep awake.

## The one to pick: a Cloudflare Worker

Cloudflare runs small programs for people on its own machines. This one is
small enough to be free, and not marginally: the free allowance is a hundred
thousand connections a day and roughly a day's worth of a room being open, and
a race is two connections and a few minutes. Once it is up there is nothing to
start and nothing to keep awake, and it works whether the two devices are in
the same room or in different countries. You do this once, ever.

You need a computer with a terminal. About ten minutes.

**1. Node, if the computer hasn't got it.** In a terminal, type `node -v`. If it
prints a version, skip this. If it says "command not found", get the installer
from [nodejs.org](https://nodejs.org) and run it, then close the terminal and
open a new one.

**2. Get this folder onto the computer.**

```
git clone https://github.com/varunhiremath/terrible-inventions.git
cd terrible-inventions/server
```

**3. Make a Cloudflare account** at
[dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up), if there
isn't one. Email and a password; no card, and the free plan is the default. If
it asks you to add a website or pick a plan, skip past it — none of that is
needed for this.

**4. Deploy it.**

```
npx wrangler deploy
```

The first time, it asks to install `wrangler` (say yes) and then opens a browser
window asking you to allow it onto your Cloudflare account (say Allow). Then it
uploads, and the last thing it prints is an address like

```
https://terrible-inventions-relay.<something>.workers.dev
```

**That address is the answer.** Copy it. If you lose it, run `npx wrangler
deploy` again and it prints it once more, or find the Worker by name in the
Cloudflare dashboard.

**5. Check it works** by opening that `https://…` address in any browser. It
should answer with one line of text: `terrible-inventions relay`. That means
it's alive.

**6. Put it in the app.** On both devices: **Settings → Relay**, and paste the
address in. The app turns `https://` into `wss://` itself, so paste it exactly
as Cloudflare printed it.

Send me the address and I'll build it into the app as the default, so neither
device ever has to have it typed in again.

## Not a laptop on the same wifi, and not a phone

There is a relay in here that runs on a laptop — `node server/relay.mjs` — and
it cannot be used with the real site, however tempting it looks. It speaks
`ws://`, the site is `https://`, and a browser throws the connection out before
it is made: *an insecure WebSocket connection may not be initiated from a page
loaded over HTTPS*. Measured, from the live site, in `scripts/mixed.mjs`.

That rule is also why a relay on an Android phone under Termux does not help.
Node runs there perfectly well, and the other phone still would not be allowed
to talk to it. The exception is `127.0.0.1`, which the browser lets through
because nobody can be listening in on your own device — but the whole point is
the *other* device, and that one only has a wifi address.

So `relay.mjs` is for development: `npm run dev` serves the app over plain http
from the same machine, where the rule does not apply, and
`scripts/together-check.mjs` drives two browsers through it. It is the reason
this went unnoticed — the one place it was ever tried is the one place it works.

## Then, either way

On one device: **The Road → Play together → Start a race**. It shows a
four-letter code.

On the other: **The Road → Play together → Join a race**, and type the code.

Whoever started it runs the race; the other drives the quickest car in the
field. Both see their own car.
