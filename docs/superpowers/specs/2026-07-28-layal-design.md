# Layal Birthday Page — Design

## Purpose
A hidden subpage (`/layal/`) as a birthday gift for the author's sister Layal: an
on-screen retro TV showing a DVD-style menu with one "disc" per 5-year mark since
2012 (2012, 2017, 2022, 2026). Each disc opens into photos and videos from that era.

## Scope
- Self-contained folder, same pattern as `/deanos/`: no build step, no dependencies.
- Single `index.html` with inline `<style>` and `<script>`.
- `media/2012/`, `media/2017/`, `media/2022/`, `media/2026/` folders for the
  author to drop real photos/videos into after the page ships. Ships with
  placeholders since media isn't ready yet.
- Not in scope: real DVD-menu audio loop, video transcoding/optimization,
  server-side code, real security (the passcode is obscurity only, not auth).

## Structure
```
/layal/
  index.html        (all CSS + JS inline)
  media/
    2012/  2017/  2022/  2026/   (photo/video files go here later)
```
A JS config object lists expected filenames per year/type. If a referenced file
404s, the screen renders a placeholder box naming the exact path to drop the
file in (e.g. "drop photo here: media/2012/1.jpg") instead of a broken image.

## Interaction Flow
1. **Power-on**: TV screen off; "press ENTER / click screen" prompt. Selecting
   it triggers a brief static-flicker transition.
2. **Passcode gate**: on-screen numeric keypad styled like a TV remote; a
   hardcoded 4-digit PIN. Correct entry sets a flag in `localStorage` so the
   gate is skipped on return visits from the same browser. This is obscurity,
   not real security — acceptable per requirements.
3. **DVD root menu**: 4 discs, one per year (2012 / 2017 / 2022 / 2026).
   Navigable by mouse click or arrow keys + Enter (a highlight cursor moves
   between options).
4. **Scene menu**: selecting a year shows a grid mixing photo thumbnails and
   video thumbnails for that era.
5. **Viewer**: selecting an item shows the photo full-size or plays the video
   inside the TV screen area. Esc / on-screen Back returns to the scene menu;
   Back again returns to the root menu.

## Visual Style
Warm retro TV chrome: wood-panel CSS background, amber/warm glow, screen
curvature vignette, CRT scanlines. Deliberately distinct from the main site's
green-terminal theme — its own nostalgic look, not a reskin of `/deanos/`.

## Error Handling
- Missing media file → placeholder box with the expected path, not a broken
  `<img>`/`<video>` element.
- Wrong passcode → shake/error flicker, stays on keypad screen, no lockout
  needed (low-stakes, family-only link).

## Testing
No build step, so verification is manual: open `/layal/index.html` in a
browser and walk the full flow (power-on → passcode → all 4 discs → a photo
item → a video item → back navigation) with both mouse and keyboard. No
automated test harness — YAGNI for a static one-page gift site.
