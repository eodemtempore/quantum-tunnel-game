# Quantum Tunnel

Quantum Tunnel is a mobile-first browser game built with Vite, TypeScript, Three.js, and the Web Audio API. You race as a subatomic particle through an endless cyberpunk quantum tunnel with procedural music, uploaded-track audio reactivity, collectibles, shields, near-miss scoring, local high scores, and a local prototype admin playlist.

## Install

```bash
npm install
```

## Run Locally

```bash
npm run dev
```

Open the local Vite URL shown in the terminal.

## Test On iPhone Over Wi-Fi

1. Put the computer and iPhone on the same Wi-Fi network.
2. Find the computer LAN IP address, for example `192.168.1.24`.
3. Start Vite with host mode:

```bash
npm run dev -- --host 192.168.1.24
```

4. Open the shown `http://192.168.1.24:5173/` URL in iPhone Safari.
5. Tap `Tap to Start` once so Safari allows audio playback.

If your firewall blocks the connection, allow inbound connections to the Vite port.

## Build And Preview

```bash
npm run build
npm run preview
```

## Controls

Mobile supports drag steering and swipe lane changes when 5-lane mode is enabled. Desktop supports Arrow keys and A/D. Optional tilt steering is available from Settings and only activates after explicit permission.

## Music

The game starts with a procedural electronic soundtrack using Web Audio oscillators, noise hats, bass, synth arps, and glitch effects. The tunnel reacts to analyser energy.

To upload personal music:

1. Open the Music section.
2. Choose an audio file from the upload field.
3. Tap play if Safari pauses it.
4. Use the track controls to play, pause, or restart.

The upload is one-time and local to the current browser session. If decoding or analyser setup fails, the game keeps running with procedural audio.

## Admin Playlist

Open the small gear button on the start screen or visit `/admin`. Add entries with title, artist/name, audio URL or local path, optional BPM, and mood tag. Entries are saved in localStorage and appear in the public music selector as admin-added tracks.

Admin playlist URLs must be direct browser-reachable audio file URLs. Good examples are `/tracks/default.mp3`, `/tracks/my-loop.wav`, or a CORS-enabled `https://.../track.mp3` CDN/object-storage URL. Regular SoundCloud, YouTube, Spotify, Dropbox preview, or web page links are not direct audio files and will not play in this no-backend prototype. SoundCloud playback would need a proper licensed/API-backed integration or a hosted audio file that the browser can fetch directly.

This is a prototype-only local admin system. A production playlist would need authentication, backend storage, file uploads, CDN/object storage, and moderation around allowed audio URLs.

## Levels

The first 30 stages live in `src/game/levels/LevelConfig.ts`. Level score gaps get larger over time, so harder levels last longer than early ones. The tunnel shape shifts every five levels:

- Levels 1-5: circular tunnel
- Levels 6-10: square tunnel
- Levels 11-15: hex tunnel
- Levels 16-20: circular tunnel
- Levels 21-25: square tunnel
- Levels 26-30: hex tunnel

1. Quantum Awakening
2. Code Rain Descent
3. Proton Drift
4. Electron Surge
5. Neutron Silence
6. Decoherence Field
7. Antimatter Veil
8. Probability Storm
9. Singularity Approach
10. Higgs Threshold
11. Planck Corridor
12. Tachyon Lattice
13. Muon Overdrive
14. Photon Blackout
15. Wavefunction Cathedral
16. Qubit Rupture
17. Vacuum Bloom
18. Chronon Switchyard
19. Gravity Static
20. Event Horizon Run
21. Neon Casimir Vault
22. Entropy Spiral
23. Dark Current Relay
24. Boson Crown
25. Quantum Noir Apex
26. Planck Stormwall
27. Superposition Grid
28. Hawking Afterimage
29. Omega Decoherence
30. Final Eigenstate

Each level defines score threshold, palette, speed multiplier, obstacle density, collectible frequency, music intensity, special visual effect, obstacle pattern, and tunnel shape. After Level 30, `Quantum Drift` continues endlessly and scales speed, density, intensity, and tunnel shape by score bands. To expand toward 1000 levels, add generated or authored `LevelConfig` entries and keep the game loop using `getStageForScore`.

## Higgs Boson Unlock

Higgs Boson is locked at the start. Reach 50,000 points in a run or hold a high score of at least 50,000 to unlock it permanently in localStorage. Higgs has a gold/violet aura and a slight score multiplier.

## Deploy

### Vercel

1. Push the project to GitHub.
2. Import the repo in Vercel.
3. Use the default Vite settings:
   - Build command: `npm run build`
   - Output directory: `dist`

### Netlify

1. Push the project to GitHub.
2. Import the repo in Netlify.
3. Use:
   - Build command: `npm run build`
   - Publish directory: `dist`

## Add To iPhone Home Screen

1. Open the deployed URL or local network URL in Safari.
2. Tap Share.
3. Tap `Add to Home Screen`.
4. Launch from the home screen for a fullscreen PWA-style experience.

## Project Structure

```text
src/main.ts
src/game/Game.ts
src/game/Player.ts
src/game/Particles.ts
src/game/Tunnel.ts
src/game/Obstacles.ts
src/game/Collectibles.ts
src/game/levels/LevelConfig.ts
src/audio/AudioEngine.ts
src/audio/PlaylistManager.ts
src/input/InputManager.ts
src/ui/UI.ts
src/ui/AdminPlaylist.ts
src/storage/Storage.ts
src/styles.css
```

## Build Notes

- The visible default music source is `public/tracks/default.mp3`.
- Uploaded music is session-local; use the Music tab's `Default` button to return to the built-in default track.
- Music stops on death and resets to the beginning, so the next run starts from the top instead of resuming.
- If a decoded track ends while the run is still active, it restarts from the beginning with a slightly higher playback rate, capped for control.
- Procedural audio remains in code as an internal fallback/dev path, but it is not exposed in the front-end playlist.
- Mobile play is landscape-first: the manifest requests landscape and portrait mobile browsers show a rotate overlay.
- Runtime resize handling uses window resize, orientation change, visual viewport resize, and ResizeObserver so the canvas/camera adapt while playing.
- iPhone settings include optional haptics. When supported by the browser/device, obstacle impacts trigger vibration.

## Next Improvements

- Add hand-tuned level packs or generated 1000-level progression.
- Add calibrated difficulty curves from real device testing.
- Add richer obstacle telegraphs and boss-like stage events.
- Add optional low-power graphics mode for older iPhones.
- Replace local admin storage with authenticated backend playlist management.
