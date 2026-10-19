# Rare UI Components for TypedDoc: Detailed Integration Plan

## Main conclusion

Rare UI has 25 named components across display, AI, navigation, input, and feedback categories. The best TypedDoc improvements are not to add every animation everywhere. TypedDoc already uses Motion, glass cards, gradients, and animated progress states, so the strongest result will come from using a small number of Rare UI components where their interaction model matches a real product need.

The highest-value additions are:

1. **Inline AI Status** for trustworthy OCR/formatting stages.
2. **Step Player** for the upload → OCR → verification → export workflow.
3. **Code Block** for technical notes, code, and diagnostics.
4. **Rail TOC** or **Proximity Sidebar** for long documents.
5. **Task List** for review checklists and unresolved regions.
6. **Delete Button** for low-risk document and queued-job removal.
7. **Notification Bell** for durable processing, review, and collaboration events.
8. **FAQ** for contextual help.
9. **Voice Note** if audio-backed documents or voice-note transcription is added.
10. **Web Search** only after TypedDoc has a real source-grounded research workflow.

Decorative components such as Fluid Orb, Matrix Orb, Gravity Letters, Folder, and Grid Reveal should be limited to the landing page, empty states, and one active processing surface. They should never replace semantic progress, upload controls, errors, or accessible text.

Rare UI’s official catalog describes the components as single-file components that can be copied into the project rather than installed as a large runtime library. The catalog groups them into Display, AI kit, Navigation, Inputs, and Feedback categories. [1]

## TypedDoc UI context used for the mapping

The current project already has:

- a public landing/sign-in screen;
- an authenticated sidebar;
- a document list with sorting and cards;
- a PDF/image upload dropzone;
- a processing feed and progress bar;
- an editor;
- a formatted document viewer;
- version history;
- offline status;
- toast notifications;
- React, Tailwind, Motion, lucide-react, Firebase, and KaTeX.

The existing theme uses warm paper colors, rounded glass cards, serif display typography, and animated transitions. This means Rare UI components should be adapted to the TypedDoc token system rather than copied with their demo colors unchanged.

## Priority matrix

### Tier A: Implement first

### Inline AI Status

**Best location:** upload/processing progress, editor AI actions, formatted-document generation, and version creation.

**Why it fits:** TypedDoc needs a reliable way to show the difference between queued, reading, OCR, layout analysis, verification, formatting, completed, and failed. Inline AI Status is designed around states such as thinking, researching, analyzing, writing, done, and error, with optional detail and elapsed time. [2]

**How to apply it:**

```jsx
<AIStatus
  state={jobState}
  detail={`${completedPages}/${totalPages} pages`}
  timer={elapsedSeconds}
  states={{
    queued: { label: 'Queued', icon: Clock },
    reading: { label: 'Reading document', icon: FileText },
    ocr: { label: 'Recognizing handwriting', icon: ScanText },
    verifying: { label: 'Verifying equations', icon: ShieldCheck },
    formatting: { label: 'Building formatted PDF', icon: FileOutput },
    done: { label: 'Ready', icon: CheckCircle2 },
    error: { label: 'Needs attention', icon: AlertTriangle }
  }}
/>
```

Drive the component from actual backend state. Do not allow animation timing to claim that OCR completed. Keep retry, cancel, and error details as ordinary accessible buttons and text beside it.

**Use with TypedDoc:** replace or supplement the current `ChunkedProgressBar` status label. Keep the progress bar for numeric progress and use Inline AI Status for the current phase.

**Caution:** do not use AI wording for ordinary offline sync or deterministic file validation. The component should not be the only state signal. Respect reduced motion and mount only one or two active instances.

### Step Player

**Best location:** the main processing screen.

**Why it fits:** TypedDoc has a real multi-stage workflow: upload, validate, render pages, OCR, verify, format, and complete. Step Player can make this workflow understandable at a glance. [3]

**Recommended steps:**

```js
const processingSteps = [
  { id: 'upload', label: 'Upload' },
  { id: 'render', label: 'Prepare pages' },
  { id: 'ocr', label: 'Recognize text' },
  { id: 'verify', label: 'Verify risky regions' },
  { id: 'export', label: 'Build PDF' },
  { id: 'done', label: 'Ready' }
];
```

Use controlled `value` and `playing` state. The server is authoritative. The component is a visual representation of progress, not the progress engine. For retry, cancellation, provider failure, or pause, stop the player and show the real error/status message.

**Best configuration:** `showControl={false}` for passive job progress. Enable seeking only for an instructional walkthrough or completed-process explanation where jumping to a stage is valid.

### Code Block

**Best location:** editor preview, technical document viewer, diagnostics, and version comparison.

**Why it fits:** TypedDoc processes computer-science notes, pseudocode, and code. Code Block provides syntax highlighting, filename/language labels, line numbers, highlighted lines, and copy behavior. [4]

**How to apply it:**

- render fenced code from the OCR AST;
- show filename and language when detected;
- highlight changed lines in version comparison;
- add a copy button connected to TypedDoc toasts;
- keep the block read-only unless a real code editor is provided.

Do not use it for normal prose, upload controls, or processing progress. For very large code blocks, cap height or virtualize rendering.

### Rail TOC

**Best location:** formatted document viewer and long editor pages.

**Why it fits:** converted documents may be many pages long. Rail TOC provides an in-document outline and scroll-linked navigation. [5]

**Implementation:** derive stable heading IDs from the AST:

```js
const tocItems = headings.map((heading) => ({
  id: heading.id,
  label: heading.text,
  depth: heading.level - 1
}));
```

Pass the editor/viewer scroll container through `containerRef` when the content is inside an `overflow-auto` pane. Hide or replace the rail with a compact outline button on mobile.

Do not use Rail TOC as the authenticated product sidebar. Its meaning is document-section navigation, not application navigation.

### Task List

**Best location:** OCR review queue, upload preflight, and version restore checklist.

**Why it fits:** TypedDoc will eventually need to show unresolved regions, equation checks, table checks, and diagram checks. Task List can provide a clear review checklist. [6]

**Example:**

```js
const reviewTasks = [
  { id: 'math-3-2', label: 'Review equation on page 3' },
  { id: 'table-8-1', label: 'Confirm table cells on page 8' },
  { id: 'diagram-12-1', label: 'Check diagram labels on page 12' }
];
```

Use controlled state. Do not let the visual checklist be the only processing status. Keep the authoritative review state in the document AST/version data.

### Delete Button

**Best location:** document cards, failed/queued jobs, obsolete versions, and removable attachments.

**Why it fits:** the current document list has a trash icon that immediately calls delete. Delete Button provides an inline confirmation without opening a modal. [7]

**How to apply:**

```jsx
<DeleteButton
  onConfirm={() => deleteDocument(doc.id)}
  onCancel={() => undefined}
  aria-label={`Delete ${doc.title}`}
/>
```

For permanent account deletion, published documents, or bulk deletion, use a stronger confirmation dialog with explicit text. Add loading/error handling so the animation is not treated as proof that the server mutation succeeded.

### Notification Bell

**Best location:** authenticated sidebar header or top workspace bar.

**Why it fits:** durable events should survive after a toast disappears, such as OCR completion, failed processing, review requests, comments, version restores, or offline conflicts. Notification Bell is a compact unread indicator. [8]

Wrap it in a real notification popover containing:

- title;
- timestamp;
- document link;
- read/unread state;
- retry or review action;
- clear-all action.

The bell itself is only the trigger. Do not use it as a notification center or processing indicator. Deduplicate events and animate only on genuinely new unread notifications.

## Tier B: Implement when the related feature exists

### Source-oriented navigation: Proximity Sidebar

**Best location:** document viewer or editor minimap for long documents.

Proximity Sidebar expands nearby markers as the pointer approaches and maps them to document sections. It can complement Rail TOC when TypedDoc wants a quieter minimap. [9]

Use only for actual document headings with stable IDs. Do not use it for the global sidebar, upload, offline status, or processing progress. Hide it on narrow screens behind an outline button.

### Scroll Progress

**Best location:** long formatted-document viewer.

Scroll Progress provides a small reading-position indicator and can expand into section navigation. [10]

Use it for reading position, not OCR progress. It must not replace a determinate progress bar, offline status, or save indicator. Pass the correct scroll container and update section IDs whenever the document AST changes.

### Hook Sidebar

**Best location:** authenticated sidebar if a more structured active-row indicator is preferred.

Hook Sidebar uses an animated rail to identify the active navigation item. [11]

It is a possible replacement for the current sidebar active-state styling, but adoption is optional because TypedDoc already has a clear sidebar. Use it only if the product wants a stronger navigation identity. Replace any Next.js-specific link/router imports with the project’s router primitives.

### Bounce Sidebar

**Best location:** authenticated sidebar alternative.

Bounce Sidebar uses a spring-animated active dot. [12]

It can make the sidebar feel more distinctive, but it may be too playful during serious document processing. Use reduced motion and avoid combining it with multiple other animated navigation effects. Choose Bounce Sidebar or Hook Sidebar, not both.

### Gooey Nav

**Best location:** document workspace view switcher.

Use it for real selectable modes such as:

```text
Editor | Formatted view | Versions
```

Gooey Nav is a poor fit for passive progress or offline status because its visual model implies a user-selectable navigation choice. [13]

Keep labels short and provide an overflow strategy on small screens because the navigation does not wrap.

### FAQ

**Best location:** contextual help drawer on landing, upload, editor, viewer, and offline states.

FAQ is useful for explaining accepted files, privacy, processing behavior, formatting limitations, and recovery steps. [14]

Use stable IDs, accessible disclosure semantics, concise answers, and reduced motion. Do not put the complete documentation inside the editor canvas.

### Voice Note

**Best location:** only if TypedDoc supports audio input or voice-note attachments.

Voice Note provides playback, scrubbing, elapsed time, speed control, and a waveform. [15]

It can support:

- audio-backed handwritten notes;
- voice-note transcription;
- source audio beside corrected text;
- version-specific audio provenance.

It is not a recorder, OCR engine, or processing indicator. Add a transcript and accessible label. Lazy-load players and coordinate one active player per screen.

### Searchable scanned PDF support with Grid Reveal

Grid Reveal is suitable only for a real image-preview generation state. It reveals an image from a splitting grid while the image is loading. [16]

Use it when TypedDoc generates a page thumbnail or preview image. Do not use it as the only OCR or textual processing progress indicator. The actual progress text and percentage must remain visible.

### Web Search

**Best location:** future document research assistant in the editor or viewer.

Web Search is valuable if TypedDoc adds an external research feature with source cards and citations. It presents a streaming answer with source previews and citation chips. [17]

It should not be used for ordinary OCR. External search must be clearly separated from document-grounded transcription. The backend must control retrieval, source validation, citation-to-claim mapping, cancellation, rate limits, and offline behavior.

## Tier C: Use sparingly for branding and empty states

### Folder component

**Best location:** document-list empty state, folder-management feature card, or upload onboarding. [18]

The built-in cards are decorative and not real user folders. Do not attach a document list to the internal decorative click handler without refactoring it. Provide a real button or link next to it, keyboard support, visible focus, and a reduced-motion state.

### Gravity Letters

**Best location:** landing hero, idle upload dropzone, or low-stakes empty state. [19]

Use document icons rather than random letters where possible. Keep the real dropzone and file picker semantic and fully interactive. Cap the glyph count and unmount the physics field when not visible.

### Fluid Orb

**Best location:** landing hero or central processing empty/loading state. [20]

Fluid Orb is a decorative WebGL visual. It is not a progress meter or connection indicator. Render one instance only, lazy-mount it, provide a still/reduced-motion state, and avoid rendering it in document lists or repeated cards.

### Matrix Orb

**Best location:** future AI assistant or focused processing state. [21]

Use a typed state machine such as `idle`, `listening`, and `thinking`. Pair every state with readable text. Do not use the orb alone to communicate OCR completion, offline status, or failure.

### Animated Counter

**Best location:** dashboard metrics and processing totals. [22]

Good metrics include:

- total documents;
- pages processed;
- unresolved regions;
- saved versions;
- queued jobs.

Use it for a changing number, not as a replacement for a progress bar or status label. Keep the number of counters small and ensure accessible static values exist.

### GitHub Activity

**Best location:** optional account analytics or document activity dashboard.

Map contributions to document edits, reviews, exports, or uploads, but label the meaning clearly. The GitHub metaphor can be misleading if used for processing status. [23]

Do not expose private document activity in shared views without permissions. Use it only after the product has a real activity-event model.

### Emoji Reaction

**Best location:** completed document, review block, or collaboration comment. [24]

Use it for lightweight feedback such as “useful” or “needs review,” not as a replacement for approval, comments, or structured review. Rate-limit repeated reactions and ensure the reaction menu is keyboard accessible.

### Duration Picker

**Best location:** future retention, reminder, review-by, or cache-duration settings.

Duration Picker is for hours/minutes durations, not dates or times. [25]

Use controlled state and persist only on confirmation. It is not needed for the current core OCR flow unless TypedDoc adds scheduled processing, auto-delete, or review reminders.

### OTP Input

**Best location:** future MFA, invite-code, or account recovery flow.

OTP Input is appropriate for authentication codes, not document data or upload metadata. [26]

Use server-side verification, do not log values, and provide non-animated text errors and resend/expiration controls.

## Recommended screen-by-screen mapping

### Landing and sign-in

Use:

- Fluid Orb: one ambient hero visual;
- Gravity Letters: optional low-density document icon field;
- FAQ: public product/privacy questions;
- Animated Counter: only if metrics are real and trustworthy;
- OTP Input: only if MFA or recovery is added.

Avoid:

- Web Search;
- GitHub Activity;
- Notification Bell before authentication;
- multiple continuous animations at once.

### Authenticated sidebar

Use one of:

- current sidebar with improved active state;
- Bounce Sidebar;
- Hook Sidebar;
- Gooey Nav for a compact workspace-mode switcher.

Add:

- Notification Bell for durable events;
- small FAQ/help entry;
- optional Folder illustration only in an empty-state card.

Avoid putting Fluid Orb, Matrix Orb, or Gravity Letters in the sidebar.

### Document list

Use:

- Delete Button for low-risk document removal;
- Notification Bell at workspace level;
- Animated Counter for document/page totals;
- GitHub Activity only in an optional analytics panel;
- Folder component only in empty state or a future folder feature.

Keep the current card grid as the main content. Do not add animation to every document card.

### Upload/dropzone

Use:

- Inline AI Status after the file is accepted;
- Step Player for staged processing;
- Task List for preflight checks or review preparation;
- Gravity Letters or Folder only as decoration;
- Grid Reveal only when a real thumbnail is being generated.

Keep `react-dropzone` as the actual upload interaction. Rare UI visuals must not intercept keyboard, drag, or file-picker behavior.

### Processing progress

Use:

- Inline AI Status for the current phase;
- Step Player for the workflow stages;
- Animated Counter for processed page totals;
- Task List for completed/remaining verification tasks;
- Matrix Orb only as a small optional AI-state accent;
- Notification Bell for durable completion/failure after the job ends.

Do not use:

- Scroll Progress;
- Rail TOC;
- GitHub Activity;
- Web Search unless external enrichment really runs.

### Editor

Use:

- Code Block for code/pseudocode;
- Rail TOC or Proximity Sidebar for long documents;
- Web Search only for a real research assistant;
- Voice Note for audio-backed source material;
- Emoji Reaction for optional collaboration feedback;
- Inline AI Status for AI formatting or region verification.

Keep the editor itself calm. Document content should dominate decorative motion.

### Formatted document viewer

Use:

- Rail TOC for headings;
- Scroll Progress for reading position;
- Proximity Sidebar for a compact minimap alternative;
- Code Block for code sections;
- Voice Note for audio provenance;
- Task List for unresolved review regions;
- Web Search for optional source citations.

### Versions and review

Use:

- Task List for review completion;
- Delete Button for removable obsolete versions;
- Notification Bell for review requests;
- Emoji Reaction for lightweight feedback;
- Code Block with highlighted lines for technical diffs;
- Step Player for a guided restore flow.

### Offline status

Use:

- ordinary accessible banner and toast as the primary status;
- Notification Bell for durable sync conflicts;
- FAQ for recovery instructions;
- Task List for queued offline actions if they are actionable.

Avoid using decorative AI or navigation components as the only connectivity signal.

## How to add Rare UI components safely

### 1. Treat each component as local source code

Rare UI’s catalog describes a single-file ownership model and shadcn-style installation. Copy the source into a local `src/components/ui/rare/` or similar directory and record the source URL, version/date, license, and any modifications. [1]

Do not add a component directly to production without reviewing:

- imports;
- client/browser API assumptions;
- Next.js-specific router imports;
- Motion version compatibility;
- Tailwind class assumptions;
- accessibility semantics;
- reduced-motion behavior;
- bundle impact.

### 2. Normalize project tokens

Map Rare UI colors to existing tokens:

```css
:root {
  --rareui-accent: var(--color-accent);
  --rareui-accent-soft: color-mix(in srgb, var(--color-accent) 12%, transparent);
  --rareui-surface: var(--color-surface);
  --rareui-border: var(--color-border);
  --rareui-text: var(--color-text-main);
  --rareui-muted: var(--color-text-dim);
}
```

Prefer TypedDoc colors over component-demo colors. Keep red for errors/destructive actions, green for success, amber for review, and blue/purple only for neutral AI or informational states.

### 3. Add a shared motion policy

Create a small utility or hook:

```js
export function useTypedDocMotion() {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  return {
    reduce,
    duration: reduce ? 0 : 0.35,
    spring: reduce ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 24 }
  };
}
```

Use it to disable decorative animation while preserving focus, state, and usability.

### 4. Keep semantics outside decoration

Every component used in TypedDoc must have:

- a semantic button, link, checkbox, input, or navigation landmark;
- visible focus state;
- keyboard operation;
- a text equivalent for important status;
- sufficient contrast;
- a reduced-motion presentation;
- clear loading/error states.

### 5. Add an attribution record

The component pages and repository guidance mention MIT with Commons Clause and attribution requirements for the copied components. Keep source notices and add an appropriate visible Rare UI credit/link in the About/Credits surface, footer, or README. Verify the current repository license before distribution. [1]

### 6. Test visual performance

Measure before and after:

- production bundle size;
- first contentful paint;
- interaction latency;
- mobile GPU/battery behavior;
- reduced-motion behavior;
- long-list performance;
- screen-reader navigation;
- keyboard-only operation.

Avoid mounting multiple WebGL/physics components or many animated instances in document grids.

## Suggested implementation order

### Sprint 1: processing clarity

1. Add Inline AI Status to processing jobs.
2. Add Step Player to the processing screen.
3. Add Animated Counter for processed pages.
4. Keep existing numeric progress, cancel, retry, and error controls.

### Sprint 2: document navigation and review

1. Add Rail TOC to the formatted viewer.
2. Add Task List for unresolved OCR blocks.
3. Add Code Block to the editor/viewer AST renderer.
4. Add Delete Button to low-risk row/card deletion.

### Sprint 3: durable events and help

1. Add Notification Bell with a real notification panel.
2. Add contextual FAQ drawers.
3. Add version/review notifications.

### Sprint 4: advanced inputs and collaboration

1. Add Emoji Reaction after comments/review exist.
2. Add Voice Note only with audio workflows.
3. Add Duration Picker only with retention/reminder settings.
4. Add OTP Input only if MFA/recovery is implemented.

### Sprint 5: branding and optional AI features

1. Add one Fluid Orb or Matrix Orb to the landing/AI-assistant experience.
2. Add Grid Reveal only for real image preview generation.
3. Add Gravity Letters or Folder to a carefully chosen empty state.
4. Add Web Search only after a source-grounded research backend exists.

## Components that should not be integrated immediately

Do not add these only because they look attractive:

- Web Search without actual retrieval and citation logic;
- GitHub Activity without a real activity model;
- Voice Note without audio workflows;
- Duration Picker without retention/reminder settings;
- OTP Input without MFA or invite codes;
- multiple orb/physics components on the same screen;
- Rail TOC/Scroll Progress on short documents;
- Delete Button for irreversible destructive operations;
- Emoji Reaction as a replacement for review or approval.

## Final recommendation

Use Rare UI to improve TypedDoc’s clarity and trust first, then add decorative branding. The best initial combination is:

```text
Inline AI Status
+ Step Player
+ Rail TOC
+ Task List
+ Code Block
+ Delete Button
+ Notification Bell
+ FAQ
```

This combination improves the real workflows users care about: uploading, understanding processing, reviewing uncertain output, navigating long documents, handling versions, receiving durable notifications, and getting help.

Use Fluid Orb, Matrix Orb, Gravity Letters, Folder, and Grid Reveal as restrained supporting visuals. The interface should remain calm and document-focused rather than becoming a gallery of unrelated animations.

## References

[1]: https://www.rareui.com/components "Rare UI component catalog"
[2]: https://www.rareui.com/components/aistatus "Rare UI Inline AI Status"
[3]: https://www.rareui.com/components/stepplayer "Rare UI Step player"
[4]: https://www.rareui.com/components/codeblock "Rare UI Code Block"
[5]: https://www.rareui.com/components/railtoc "Rare UI Rail TOC"
[6]: https://www.rareui.com/components/tasklist "Rare UI Task list"
[7]: https://www.rareui.com/components/deletebutton "Rare UI Delete button"
[8]: https://www.rareui.com/components/notificationbell "Rare UI Notification bell"
[9]: https://www.rareui.com/components/proximitysidebar "Rare UI Proximity Sidebar"
[10]: https://www.rareui.com/components/scrollprogressindicator "Rare UI Scroll Progress"
[11]: https://www.rareui.com/components/hooksidebar "Rare UI Hook Sidebar"
[12]: https://www.rareui.com/components/bouncesidebar "Rare UI Bounce sidebar"
[13]: https://www.rareui.com/components/gooeynav "Rare UI Gooey nav"
[14]: https://www.rareui.com/components/faq "Rare UI FAQ"
[15]: https://www.rareui.com/components/voicenote "Rare UI Voice note"
[16]: https://www.rareui.com/components/gridreveal "Rare UI Grid Reveal"
[17]: https://www.rareui.com/components/websearch "Rare UI Web Search"
[18]: https://www.rareui.com/components/foldercomponent "Rare UI Folder component"
[19]: https://www.rareui.com/components/gravityletters "Rare UI Gravity Letters"
[20]: https://www.rareui.com/components/fluidorb "Rare UI Fluid Orb"
[21]: https://www.rareui.com/components/matrixorb "Rare UI Matrix orb"
[22]: https://www.rareui.com/components/animatedcounter "Rare UI Animated counter"
[23]: https://www.rareui.com/components/githubactivity "Rare UI GitHub activity"
[24]: https://www.rareui.com/components/emojireaction "Rare UI Emoji reaction"
[25]: https://www.rareui.com/components/durationpicker "Rare UI Duration Picker"
[26]: https://www.rareui.com/components/otpinput "Rare UI OTP Input"
