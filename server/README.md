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

## Put it up from a browser, with nothing installed

This is the one to pick unless you already have a recent Node on a machine you
like. Cloudflare builds it from GitHub on its own machines, so it does not
matter what the computer in front of you is — Windows, an ancient Linux box, or
the phone itself. Nothing is installed, and there is no terminal.

Cloudflare runs small programs for people on its own machines, and this one is
small enough to be free, not marginally: a hundred thousand connections a day
and roughly a day's worth of a room being open, against a race that costs two
connections and a few minutes. You do this once, ever.

**1.** Make a free account at
[dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up). Email and a
password, no card. If it pushes you to add a website or pick a plan, skip past
it.

**2.** In the dashboard, find **Workers** (it has been called Workers & Pages,
and sits under Compute), then **Create application**, then **Import a
repository**. Connect your GitHub account when it asks, and allow it to see
`terrible-inventions`.

**3.** Before deploying, set three things:

| Field | What to put |
| --- | --- |
| Root directory | `server` |
| Build command | leave it empty |
| Deploy command | `npm run deploy` |

The root directory is the only one it cannot guess: the relay is this folder,
not the app in the folder above it. The deploy command is what `server/package.json`
is there for, and Cloudflare takes the wrangler version from it.

**4.** Deploy. It builds for a minute or two and prints an address like
`https://terrible-inventions-relay.<something>.workers.dev`. **That address is
the answer.** Copy it.

**5.** Check it is alive: open that address in any browser. It answers with one
line — `terrible-inventions relay`. (Building fine and answering nothing means
it deployed but something is wrong; building at all means the hard part worked.)

**6.** On both phones: **Settings → Relay**, and paste the address in. That is
the last time anybody needs it; from then on it is the four-letter code, below.

Builds are free within three thousand minutes a month and this one takes about
one, so the usual thing of accidentally spending money cannot happen here. A
push to `main` rebuilds it, which costs nothing and changes nothing unless the
relay itself changes.

## Or from a terminal, if you have a recent Node

Same thing, three commands, no GitHub involved:

```
git clone https://github.com/varunhiremath/terrible-inventions.git
cd terrible-inventions/server
npm install && npm run deploy
```

The first run asks to open a browser so you can allow it onto your Cloudflare
account; then it prints the same `workers.dev` address.

This works on Windows 11 (PowerShell, with Node from
[nodejs.org](https://nodejs.org) — and if you would rather not install git,
GitHub's green **Code** button has **Download ZIP**). It needs a current Node,
and wrangler is only supported on Windows 11, macOS 13.5 and up, and Linux with
glib 2.35 and up — which rules out a box old enough to be running an old Node,
even if you upgrade Node on it. On a Linux machine that is merely a bit behind,
[nvm](https://github.com/nvm-sh/nvm) puts a new Node in your home directory
without touching the system one — run the install line from its README, then
`nvm install 22`.

If any of that bites, use the browser route above — it is the same deploy, run
on a machine that is already set up for it.

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
