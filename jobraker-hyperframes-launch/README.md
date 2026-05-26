# Jobraker HyperFrames Launch

A 42-second HyperFrames launch video for Jobraker, built with HTML, CSS, GSAP, and modular HyperFrames compositions.

## Structure

- `index.html` stitches six scene compositions into the 42-second master timeline.
- `meta.json` sets 1920x1080, 30fps, and duration metadata.
- `compositions/` contains one HTML file per scene.
- `DESIGN.md`, `SCRIPT.md`, and `STORYBOARD.md` define the creative system.
- `HANDOFF.md` tracks validation, known issues, and production replacement notes.

## Commands

On this Windows machine, PowerShell blocks `npx.ps1`, so use `npx.cmd`:

```powershell
npx.cmd hyperframes lint
npx.cmd hyperframes validate
npx.cmd hyperframes inspect
npx.cmd hyperframes preview
npx.cmd hyperframes render --quality draft
```

The equivalent cross-platform commands are the standard `npx hyperframes ...` commands.
