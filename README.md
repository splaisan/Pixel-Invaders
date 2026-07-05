# Pixel Invaders

A faithful reimplementation of classic 1978-style fixed-shooter arcade mechanics —
HTML5 Canvas + vanilla JavaScript ES modules, no framework, no build step, no
external asset files. Sprites are original pixel-art defined in code; all sound is
synthesized live with WebAudio (including the 4-note marching heartbeat that
speeds up as the formation shrinks).

*Inspired by the 1978 arcade classic. This is an original, independent clone — it
uses no original game code, artwork or sound. See [DISCLAIMER.md](DISCLAIMER.md).*

**Created by Stephane Plaisance — co-authored by Claude (Anthropic)**
Version 1.1.0 — 2026-07-05
Licensed under the [MIT License](LICENSE).

---

## Run it (local / dev)

ES modules will **not** load from `file://` — the page must be served over HTTP.
Do not double-click `index.html`; serve it:

```bash
cd Pixel-Invaders
python3 -m http.server 8080
# open http://localhost:8080
```

### On a Docker/Linux host (conda dev serve)

Any host with conda works; the only "dependency" is a web server:

```bash
conda env create -f environment.yml
conda activate pixel-invaders
python -m http.server 8080 --bind 127.0.0.1
```

The `--bind 127.0.0.1` is deliberate: play through an SSH tunnel rather than
exposing an open port on shared infrastructure:

```bash
# from your workstation
ssh -L 8080:127.0.0.1:8080 your-docker-host
# then open http://localhost:8080 locally
```

### Docker

```bash
docker compose up -d --build
# or manually:
docker build -t pixel-invaders:1.1.0 .
docker run -d --name pixel-invaders -p 127.0.0.1:8080:80 pixel-invaders:1.1.0
```

The compose file binds to `127.0.0.1` only. If you deploy via Portainer, keep
that binding (or an equivalent firewall scope) — this is an unauthenticated
static page and should not be reachable from the open internet.

---

## Controls (default — all rebindable)

| Action | Keys |
|---|---|
| Move | ← / → or A / D |
| Fire | Space (single bullet on screen — authentic rule) |
| Start / restart | Enter or Space |
| Pause | P |
| Settings panel | C (or the ⚙ button) |
| Mute toggle | M |

## Settings panel

Press **C** or click **⚙**. The game holds while the panel is open. Everything
is applied live and saved in the browser (localStorage); **Reset to defaults**
restores the shipped values.

- **Game** — master game speed, starting lives, extra-life threshold, per-wave pace-up
- **Player** — cannon speed, bullet speed
- **Invaders** — march step interval range (the emergent speed-up curve), bomb
  cap / speed / drop-delay range
- **Mystery UFO** — interval, speed, scoring mode (random vs. authentic
  shot-count rule)
- **Display** — mono green / white / arcade overlay color bands
- **Audio** — mute, volume
- **Key bindings** — click a key, press the new one (two slots per action)

## Gameplay rules implemented

- 5×11 formation (1 top row = 30 pts, 2 middle rows = 20 pts, 2 bottom rows = 10 pts),
  2-frame walk animation flipping on each lockstep step.
- Formation drops one row and reverses at the walls; step interval shrinks with
  the number of aliens alive — the last alien is frantic. One heartbeat note per
  step, so the music speeds up with the march.
- Single player bullet on screen; 3 lives; freeze-frame death and respawn.
- Bombs drop only from the bottom-most alien of each column, capped count,
  tightening cadence per wave. Bullets can shoot bombs down.
- 4 destructible bunkers as per-pixel grids — bullets, bombs and marching aliens
  all erode them.
- Mystery UFO crosses the top strip on a randomized interval with a warbling tone.
- Wave clear → next wave starts one row lower and faster.
- Game over when lives run out **or** the formation reaches the invasion line.
- Session high score (in-memory only — no storage APIs for scores).

## Project layout

```
index.html          shell: canvas, CSS, settings drawer, module entry point
src/
  config.js         ALL tunables + defaults + localStorage persistence
  main.js           bootstrap, fixed-timestep loop, FSM, game wiring
  input.js          held-key state, edge-triggered presses, key capture (rebind)
  audio.js          WebAudio synthesis: shoot/booms/UFO warble/march heartbeat
  sprites.js        pixel bitmaps, 5×7 pixel font, cached sprite renderer
  entities.js       Player, Formation, Bullet, Bomb, Ufo, Bunker
  collision.js      AABB helpers (bunkers do per-pixel erosion themselves)
  panel.js          settings control panel (DOM overlay)
environment.yml     conda env for the dev serve (python http.server)
Dockerfile          nginx:alpine static-serve image
docker-compose.yml  loopback-bound service for Portainer / compose
LICENSE             MIT
DISCLAIMER.md       IP / trademark notice
```

## Display

Internal resolution is 224×256 (classic arcade portrait ratio), upscaled by
the largest integer factor that fits your window with `image-rendering:
pixelated` for crisp pixels. Rendering is framerate-independent (fixed
60 Hz update accumulator).

## Assets note

No original arcade ROM code, graphics or sound is used. Visuals are original
pixel bitmaps written in code and audio is synthesized in code. See
[DISCLAIMER.md](DISCLAIMER.md) for the trademark/IP notice.

## Roadmap

- Persistent leaderboard (the only feature that would justify a backend;
  needs auth-scoping and rate-limiting if it ever lands on a shared host)
- Touch controls / gamepad, CRT scanline shader, high-score initials entry
