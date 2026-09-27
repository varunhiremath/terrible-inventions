# Playing on two devices

One of you runs the race and the other drives one of the cars in it. The two
devices need something in the middle to pass messages between them, because a
browser can open a connection but cannot accept one. That is all this folder
is: a relay with two seats to a room, which never looks inside a message and
keeps nothing.

Pick whichever of the two suits where you are.

## Same wifi — a laptop in the house

Nothing to sign up for and nothing to deploy.

```
node server/relay.mjs
```

It prints one or more addresses like `ws://192.168.1.24:8787`. Put one into the
app on both devices, under **Settings → Playing together → Relay**. Both
devices have to be on the same wifi as the laptop, and the laptop has to stay
awake.

If it will not connect, open the same address in a phone browser with `http://`
in place of `ws://` — it should answer with a line of text. If it does not, the
address is wrong or something is blocking the port.

## Two different houses — a Cloudflare Worker

Free for this amount of traffic, and it stays up without a laptop.

```
cd server
npx wrangler deploy
```

It prints an address like `https://terrible-inventions-relay.<you>.workers.dev`.
Put that into the app with `wss://` in place of `https://`.

## Then

On one device: **The Road → Play together → Start a race**. It shows a four-letter
code.

On the other: **The Road → Play together → Join a race**, and type the code.

Whoever started it runs the race; the other drives the quickest car in the
field. Both see their own car.
