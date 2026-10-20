# TypedDoc Logo Usage and Opening Animation Plan

## 1. What the logo communicates

The supplied logo is a strong visual explanation of TypedDoc’s purpose:

- the left sheet represents handwritten notes;
- the right sheet represents a clean typed document;
- the curved arrow communicates transformation;
- the warm brown, cream, and amber colors match TypedDoc’s existing paper-based interface;
- the `TypedDoc` wordmark gives the product a recognizable identity.

This logo should be used as a transformation story, not only as a static decoration. The best animation should make users feel that handwritten content is becoming organized, readable, and useful.

## 2. Important asset preparation before animation

The supplied file is a flattened 1254 × 1254 PNG with a light background. It is excellent as a complete logo image, but it is not ideal for a high-quality layered animation because the handwritten sheet, typed sheet, arrow, and wordmark cannot be animated independently.

Prepare these assets as separate transparent PNG or SVG files:

```text
logo-full.png / logo-full.svg
logo-mark.png / logo-mark.svg
logo-wordmark.png / logo-wordmark.svg
logo-handwritten-sheet.png / logo-handwritten-sheet.svg
logo-typed-sheet.png / logo-typed-sheet.svg
logo-arrow.png / logo-arrow.svg
logo-sparkles.png / logo-sparkles.svg
```

Recommended variants:

1. **Full logo:** for the landing page and brand/about surfaces.
2. **Mark only:** the document icon for favicon, app icon, sidebar, loading screen, and compact mobile header.
3. **Wordmark only:** for desktop navigation and email/document headers.
4. **Layered animation assets:** handwritten page, typed page, arrow, and sparkles as separate layers.
5. **Monochrome mark:** for browser tab, grayscale printing, and small-size contexts.

Do not animate the current flattened image by repeatedly scaling or rotating the whole square. That makes the animation feel like an image zoom rather than a transformation.

## 3. Best places to use the logo

### A. Opening/splash animation

Use the mark and layered transformation assets during the initial application load. This should be a short branded introduction, not a long loading screen.

Recommended duration:

```text
1.8–2.6 seconds on the first visit
0.6–0.9 seconds on later visits
```

Show it once per browser session or once per day, not on every route change. Store a flag in `sessionStorage` so returning to the document list does not replay the animation.

### B. Public landing page

Use the complete logo near the top-left header and a larger version in the hero section. The hero should show the full transformation image beside the text:

```text
Transform handwritten notes into beautiful typed documents.
```

The logo should support the headline, not compete with the sign-in button. Keep the hero logo around 360–520 px wide on desktop and 240–300 px wide on mobile.

### C. Authenticated application header

Use the mark plus the `TypedDoc` wordmark in the sidebar header. On smaller screens, use the mark only and show the wordmark after the mobile drawer opens.

The current application header uses a BookOpen icon and text. Replace that combination with the TypedDoc mark and wordmark so the brand is consistent across public and authenticated screens.

### D. Loading and authentication states

Replace the current rotating BookOpen loader with a compact TypedDoc mark animation. Use a gentle pulse or paper-to-document transition, not an aggressive spinner.

Use the logo when:

- Firebase authentication is loading;
- the user’s workspace is being restored;
- a document-processing route is initializing;
- the app is waiting for the first document snapshot.

### E. Upload/dropzone empty state

Use the small mark or handwritten-to-typed illustration above the upload copy. It can subtly animate when a file is dragged over the dropzone.

For example:

- handwritten sheet shifts slightly left;
- arrow glows amber;
- typed sheet moves slightly right;
- the title changes from `Drop your handwritten notes` to `Release to transform`.

Do not make the logo itself the drop target. Keep the actual `react-dropzone` root as the accessible interaction.

### F. Processing progress screen

Use the mark as a compact process indicator beside the current stage:

```text
Reading handwritten pages
Recognizing text
Checking equations and tables
Building formatted PDF
Ready to download
```

A small arrow sweep from the handwritten side to the typed side is appropriate here. The numeric progress bar and accessible status text must remain the authoritative feedback.

### G. Completion state

After processing completes, show a small transformation celebration:

- typed page settles into place;
- arrow makes one final short sweep;
- a soft amber glow appears;
- the success message fades in;
- Download PDF and Open Editor buttons appear.

Keep this animation under one second so it does not delay access to the result.

### H. Formatted document viewer

Use the mark as a compact badge in the viewer header. Add a very subtle watermark in the viewer footer if desired:

```text
TypedDoc Formatted Engine
```

Do not place the large transformation image inside every page of the generated PDF. It would consume space and reduce document professionalism. Use the logo only on an optional cover page or small footer mark.

### I. Generated PDF/DOCX branding

Use the monochrome or small mark in exported documents only when the user enables branding. Recommended options:

- optional cover page with full logo;
- small logo in the generated document header;
- tiny mark in the footer next to TypedDoc metadata;
- no branding mode for academic or professional documents.

Make this a user setting rather than forcing the logo into every export.

### J. Favicon, app icon, and PWA icon

Use the document-shaped mark only. Do not use the full square logo with the handwritten page and wordmark because it will become unreadable at 16–32 px.

Prepare:

```text
favicon.svg
favicon-16x16.png
favicon-32x32.png
apple-touch-icon.png
icon-192.png
icon-512.png
```

Use a clean mark with strong contrast and no tiny text.

## 4. Recommended opening animation

### Animation concept: “From handwriting to TypedDoc”

The opening should tell the product story in five short beats.

#### Beat 1: Paper appears

Duration: 300–400 ms.

The handwritten sheet fades in from 0 opacity and moves upward by 16–24 px. Add a subtle paper shadow and a very small rotation correction so it feels like a real sheet settling on a desk.

```text
opacity: 0 → 1
translateY: 20px → 0
rotate: -4deg → -2deg
scale: 0.96 → 1
```

#### Beat 2: Handwriting reveals

Duration: 350–500 ms.

Reveal the handwritten content with a masked wipe from top to bottom or left to right. If the source is a raster layer, use a CSS mask or an animated clipping container. Avoid trying to trace every handwritten stroke unless a vector version is available.

#### Beat 3: Transformation arrow sweeps

Duration: 450–600 ms.

Animate the arrow along its natural curved path from the handwritten page toward the typed page. Add a warm amber glow that travels with the arrow tip.

A good effect is:

- arrow starts at 0.2 opacity;
- arrow moves across the curve;
- arrow reaches full opacity at the center;
- a soft glow follows the tip;
- arrow settles at 1 opacity.

If an SVG path is available, use `pathLength` and `strokeDasharray/strokeDashoffset` to draw the arrow naturally.

#### Beat 4: Typed document resolves

Duration: 400–550 ms.

The typed sheet fades and slides in from the right. Its text lines can appear in three small groups rather than one line at a time:

```text
heading lines → 100 ms delay
body lines → 180 ms delay
final line → 260 ms delay
```

The typed page should feel stable and clean, contrasting with the organic handwritten page.

#### Beat 5: Wordmark assembles

Duration: 350–500 ms.

Reveal the `TypedDoc` wordmark after the transformation is complete. The `D` document mark can glow first, followed by the remaining letters. Finish with a soft scale settle:

```text
opacity: 0 → 1
scale: 0.94 → 1.02 → 1
filter: blur(4px) → blur(0)
```

Then crossfade into the landing page or authenticated workspace.

## 5. Recommended total timeline

```text
0.00–0.35  Handwritten page appears
0.25–0.75  Handwriting reveals
0.65–1.25  Arrow sweeps across
0.95–1.55  Typed page resolves
1.40–1.95  Wordmark assembles
1.95–2.30  Logo fades into the website
```

The beats should overlap. Sequential animation with no overlap will feel slow and mechanical.

## 6. React/Motion implementation pattern

Create a dedicated component:

```text
src/components/brand/TypedDocOpeningAnimation.jsx
```

Use it in `App.jsx` before the public/authenticated shell is rendered.

Example structure:

```jsx
import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

export function TypedDocOpeningAnimation({ onComplete }) {
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) {
      const timer = setTimeout(onComplete, 500);
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(onComplete, 2300);
    return () => clearTimeout(timer);
  }, [onComplete, reduceMotion]);

  return (
    <motion.div
      className="typedoc-opening fixed inset-0 z-[100] flex items-center justify-center"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduceMotion ? 0.1 : 0.35 }}
      aria-label="TypedDoc is loading"
      role="status"
    >
      <div className="typedoc-opening__scene">
        <motion.img className="typedoc-opening__handwritten" src="/brand/handwritten-sheet.svg" ... />
        <motion.img className="typedoc-opening__typed" src="/brand/typed-sheet.svg" ... />
        <motion.img className="typedoc-opening__arrow" src="/brand/arrow.svg" ... />
        <motion.img className="typedoc-opening__wordmark" src="/brand/wordmark.svg" ... />
      </div>
    </motion.div>
  );
}
```

For the arrow, SVG is preferred because path drawing gives a more natural transformation effect. For the paper sheets, transparent PNG or SVG layers are acceptable.

## 7. Session replay logic

Do not replay the full animation every time the user returns to the home screen.

```js
const OPENING_KEY = 'typeddoc_opening_seen_v1';

const shouldShowOpening = !sessionStorage.getItem(OPENING_KEY);

if (shouldShowOpening) {
  sessionStorage.setItem(OPENING_KEY, '1');
}
```

Recommended behavior:

- first visit in a tab: full 2.3-second animation;
- subsequent route changes: no opening animation;
- refresh in the same tab: short 0.6-second logo fade or no animation;
- reduced-motion users: static logo for 0.3–0.5 seconds;
- users returning from browser history: no replay.

## 8. Accessibility and performance rules

The opening animation must never block the application for users who need to work quickly.

Implement these rules:

1. Support `prefers-reduced-motion: reduce`.
2. Keep a `Skip animation` button available on keyboard focus.
3. Never hide the sign-in button until the animation is complete if the user presses Escape or Skip.
4. Use `aria-label="TypedDoc is loading"` and avoid announcing every animation stage to screen readers.
5. Keep the animation under 2.5 seconds.
6. Use `opacity` and `transform` instead of layout-heavy properties.
7. Preload the small mark and wordmark.
8. Lazy-load the large layered hero art if it is not needed immediately.
9. Avoid large blur filters on low-power devices.
10. Do not use audio by default.

Suggested CSS:

```css
@media (prefers-reduced-motion: reduce) {
  .typedoc-opening * {
    animation: none !important;
    transition: none !important;
  }
}
```

## 9. Visual styling recommendations

The current logo already matches TypedDoc’s warm palette. Use these tokens:

```css
--logo-brown: #3D2E1C;
--logo-paper: #FFFBF5;
--logo-amber: #C4853C;
--logo-gold: #D99A4A;
--logo-border: #E8DFD0;
```

For the opening background, use a quiet paper gradient rather than a black splash screen:

```css
background:
  radial-gradient(circle at 50% 42%, rgba(196,133,60,.12), transparent 32%),
  linear-gradient(135deg, #F5F0E8 0%, #FFFBF5 55%, #E8DFD0 100%);
```

The logo should have enough empty space around it. Do not put it inside a tight circular loader.

## 10. What not to do

Avoid these patterns:

- replaying a 4–6 second intro on every page visit;
- rotating the entire logo continuously;
- flashing bright gold or white effects;
- animating every handwritten letter individually with no purpose;
- making the arrow bounce endlessly;
- placing the full logo in every sidebar row or document card;
- using the full square PNG as a favicon;
- using the animation as the only processing status;
- forcing the logo into exported academic PDFs;
- using browser autoplay audio;
- delaying the sign-in button until the logo animation finishes.

## 11. Recommended implementation order

### Phase 1: brand foundation

1. Prepare transparent mark, wordmark, and layered assets.
2. Add the mark to the favicon and app header.
3. Replace the BookOpen loading icon with the mark.
4. Add accessible reduced-motion behavior.

### Phase 2: opening animation

1. Create `TypedDocOpeningAnimation.jsx`.
2. Implement the five-beat transformation sequence.
3. Add session-based replay control.
4. Add Skip and Escape behavior.
5. Test on mobile and low-power devices.

### Phase 3: product-state usage

1. Add a compact transformation animation to the upload dropzone.
2. Add a small mark/arrow state to processing progress.
3. Add a short completion celebration.
4. Add optional viewer/export branding.

## Final recommendation

Use the logo as a short story:

```text
handwritten page → transformation arrow → clean typed page → TypedDoc wordmark
```

The most beautiful implementation will be layered, calm, and purposeful. Use the full opening animation only once per session, use the mark throughout the product, and reserve the larger transformation artwork for the landing page, empty states, upload flow, and successful-completion state.
