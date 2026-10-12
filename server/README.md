# Playing on two devices

One of you runs the race and the other drives one of the cars in it. The two
devices need something in the middle to pass messages between them, because a
browser can open a connection but cannot accept one. That is all this folder
is: a relay with two seats to a room, which never looks inside a message and
keeps nothing.

It cannot run on a phone. Not won't — can't: the app is a web page, and a web
page is not allowed to sit and wait for someone to call it. Whatever runs the
relay has to be something that can, which means a laptop in the house or a
small free thing on the internet.

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

## The other one: a laptop on the same wifi

Worth it only if you want to try it in the next five minutes without making an
account. It needs the laptop awake, on the same wifi, with the terminal open the
whole time you are playing.

```
git clone https://github.com/varunhiremath/terrible-inventions.git
cd terrible-inventions
npm install
node server/relay.mjs
```

It prints one or more addresses like `ws://192.168.1.24:8787`. Put one into
**Settings → Relay** on both devices.

If it will not connect, open the same address in a phone browser with `http://`
in place of `ws://` — it should answer with a line of text. If it does not, the
address is wrong, or the wifi is keeping the two devices apart (guest networks
usually do).

## Then, either way

On one device: **The Road → Play together → Start a race**. It shows a
four-letter code.

On the other: **The Road → Play together → Join a race**, and type the code.

Whoever started it runs the race; the other drives the quickest car in the
field. Both see their own car.
