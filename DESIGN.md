# Rank & Guess — Design Spec

## Overview

**Rank & Guess** is an in-person party game inspired by [The ID Game](https://idgame.app/). One player secretly ranks the group based on a prompt, and everyone else guesses what the prompt was from a multiple-choice list.

The key differentiator: players can **submit their own custom prompts**, and the prompt creator earns **bonus points** when their prompt gets picked — incentivising people to write the funniest, most controversial questions possible.

---

## Inspiration

The ID Game (idgame.app / id-game.com) is a viral party game popular on TikTok (~7M posts). Players physically rank each other's IDs on a table based on a secret "most likely to" prompt. Others guess the prompt.

**What we liked:** The core loop is brilliant — ranking friends creates arguments, guessing creates tension, and the reveal is always funny.

**What we wanted to fix:**
- Many default prompts are boring or generic
- No way to add your own prompts
- No incentive for creative prompt writing
- No prompt categories (everything is PG)

---

## Game Flow

### 1. Setup (Home Screen)

Players configure the game:

- **Add Players** (minimum 2) — names are cached in localStorage and restored on restart
- **Select Prompt Packs** — toggle any combination of:
  - **Standard** (52 prompts) — cheeky, pub-banter style
  - **Unhinged** (43 prompts) — absurd, chaotic scenarios
  - **NSFW** (37 prompts) — adult/spicy content
  - **Custom** — player-submitted prompts
- **Set Rounds** (default: 2) — 1 round = every player ranks once
- **Set Timer** (default: 60s, adjustable in 15s increments, 0 = off)

### 2. Prompt Submission Phase (if Custom pack selected)

If the Custom pack is enabled and no custom prompts exist yet, each player takes a turn submitting prompts:

- Phone is passed to each player in turn
- Randomised placeholder text cycles through starters ("Most likely to...", "Biggest...", "Worst at...", etc.) to inspire creativity
- Each player must submit at least 1 prompt
- Prompts are tagged with the creator's name
- Custom prompts can be **saved to localStorage** and **loaded** in future games

### 3. Game Rounds

Each round consists of every player taking one turn as the **ranker**. With 4 players and 2 rounds, that's 8 total turns.

#### Turn Flow:

**a) Pass Device**
- Screen shows who the ranker is
- Displays current round/turn progress

**b) Pick Prompt (Ranker Only)**
- Ranker sees 5 randomly selected prompts from the active pool
- Creator names are hidden to prevent bias
- Ranker taps to select one — this becomes the secret prompt
- The other 4 unchosen prompts are discarded

**c) Rank Players (Ranker Only)**
- Ranker sees their chosen prompt displayed prominently
- All other players appear in a draggable list
- Ranker drag-and-drops to rank them (1 = most fitting)
- Supports both mouse drag and touch drag on mobile
- Timer counts down if enabled (auto-submits when expired)

**d) Guess Phase (Everyone Except Ranker)**
- The ranking is revealed (read-only)
- 4 multiple-choice options shown (1 correct + 3 decoys from the pool)
- Each guesser gets a tab — tap your name, pick your guess
- **800ms lock animation** after each selection prevents accidental double-taps
- Auto-advances to next ungessed player
- Timer counts down if enabled (auto-fills random guesses on expiry)

**e) Results**
- Banner shows how many guessed correctly
- The secret prompt is revealed
- If a custom prompt was chosen, the creator's name is shown
- Per-player scores for the turn
- Running total leaderboard

### 4. Game Over

- Final scores displayed, sorted by points
- Winner(s) announced (ties handled)
- **Play Again** — same players, fresh prompts (re-enters submission if Custom active)
- **New Game** — full reset back to setup

---

## Scoring

| Event | Points |
|---|---|
| Correct guess | **100** |
| Your custom prompt was picked by the ranker | **50** (creator bonus) |

The 100-point base was chosen over 1-point to allow future scoring adjustments (e.g., speed bonuses, streak multipliers) without needing decimal points.

The ranker scores nothing for their own turn — they're the facilitator. They score when they guess on other people's turns.

The creator bonus only applies to custom prompts (not built-in packs) and only if the creator is not the current ranker.

---

## Prompt Design

All built-in prompts are written to be:
- **Funny/rude** — this is a party game, not a corporate icebreaker
- **Debate-provoking** — the ranking should cause arguments
- **Universal** — works for any friend group without needing specific context

### Categories

**Standard (52 prompts)**
Pub banter tier. Cheeky but not over the line.
> "Most likely to get kicked out of a pub", "Biggest drama queen when they're ill", "Worst at keeping a secret"

**Unhinged (43 prompts)**
Absurd, chaotic, "what the fuck" energy.
> "Most likely to fight a swan and lose badly", "Most likely to accidentally join a cult", "Most likely to eat a candle because it smelled nice"

**NSFW (37 prompts)**
Adult content — dating, hookups, nights out.
> "Most likely to shag someone from this group", "Biggest liability on a night out", "Most likely to send a nude to the wrong person"

---

## Persistence (localStorage)

| Key | What's Stored | Purpose |
|---|---|---|
| `rg_players` | `string[]` of player names | Restore player list between sessions |
| `rg_custom_prompts` | `{text, creator}[]` | Save/load custom prompt lists for reuse |

No server, no accounts, no sign-ups. Everything is local to the device.

---

## Timer

- Configurable from 0 (off) to 180 seconds in 15-second increments
- Visual countdown bar with percentage fill
- Turns red (bar + text) at 10 seconds remaining
- **Ranking phase timeout:** auto-submits the current ranking as-is
- **Guessing phase timeout:** auto-fills random guesses for any player who hasn't picked yet, then reveals results

---

## UI/UX Decisions

**Light theme** — chosen over the original dark theme for better readability in social/party settings (pubs, living rooms) where screens are often viewed at angles or in mixed lighting.

**Pass-and-play** — single device, no server needed. The game is inherently in-person (you're ranking people sitting around you), so multi-device adds complexity without much benefit for MVP.

**Guess lock animation** — 800ms delay with a subtle scale animation after each guess pick. Prevents the common problem of accidentally registering multiple guesses when passing the phone quickly between players.

**Randomised placeholder starters** — the submit prompt input cycles through "Most likely to...", "Biggest...", "Worst at...", etc. to lower the creative barrier for players who freeze up when asked to write a prompt.

**Category toggles (not tabs)** — categories are multi-select (you can enable Standard + NSFW but not Unhinged). This mirrors Picolo's approach and lets groups calibrate the vibe.

**Round = full rotation** — 1 round means every player ranks once. This is more intuitive than "round = 1 turn" and makes the round count setting meaningful (2 rounds with 5 players = 10 turns).

---

## Tech Stack

- **Single HTML file** — entire app is self-contained in `index.html`
- **Vanilla JS** — no framework, no build step, no dependencies
- **CSS custom properties** — theming via CSS variables
- **Google Fonts (Inter)** — clean, modern typography
- **GitHub Pages** — static hosting, zero cost

---

## Future Considerations

These are not planned, just noted for potential iteration:

- **Multi-device play** — room codes via WebSocket/Firebase for remote play
- **Speed bonus** — faster guesses earn more points (using the 100-point base)
- **Streak multiplier** — consecutive correct guesses increase points
- **Prompt voting** — at end of game, vote on best/worst custom prompt
- **Share results** — screenshot-friendly results card for social media
- **More prompt packs** — themed packs (e.g., "Work Night Out", "Uni Freshers", "Couples")
- **Prompt import/export** — share custom prompt lists as JSON/link
