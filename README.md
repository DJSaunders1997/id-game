# Rank & Guess 🎉

A party game where one player secretly ranks the group based on a prompt, and everyone else guesses what the prompt was.

**[Play now](https://djsaunders1997.github.io/id-game/)**

## How it works

1. **Add players** (2+) and pick prompt packs
2. One player becomes the **ranker** - they secretly pick a prompt and rank everyone
3. Everyone else sees the ranking and **guesses** which prompt was used from multiple-choice options
4. Correct guesses earn **100 points** - custom prompt creators get a **50 point bonus** when their prompt is picked

## Prompt packs

| Pack | Description |
|------|-------------|
| 🍻 Standard | Pub banter - cheeky but won't get you disowned |
| 🤪 Unhinged | Chaotic energy - genuinely absurd scenarios |
| 🔞 NSFW | Spicy - not for the faint-hearted |
| ✏️ Custom | Write your own prompts - earn bonus points when they're picked |

## Features

- **Pass-and-play** - one device, no sign-ups, no server
- **Custom prompts** with creator bonus scoring
- **Drag-and-drop ranking** with touch support
- **Configurable timer** (0-180s, default 2 min)
- **Sound effects** via Web Audio API
- **localStorage** saves players and custom prompts between sessions
- **PWA-ready** - add to home screen for an app-like feel

## Tech stack

Vanilla HTML/CSS/JS. No framework, no build step, no dependencies (aside from Google Fonts).

Deployed to GitHub Pages via Actions.

## Project structure

```
index.html          - App shell and all screens
css/style.css       - All styles and animations
js/prompts.js       - Prompt packs, metadata, and placeholder starters
js/sounds.js        - Web Audio API synthesised sound effects
js/game.js          - Game state, logic, and event handling
assets/favicon.svg  - SVG favicon
manifest.json       - PWA manifest
DESIGN.md           - Detailed design spec
```

## Local development

Just open `index.html` in a browser, or serve with any static file server:

```bash
npx serve .
```
