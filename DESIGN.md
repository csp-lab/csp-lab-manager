# Design System Specification: CSP Lab Manager

## 1. Executive Summary & Design Philosophy

The **CSP Lab Manager** interface uses a refined **technical/developer-focused design language** inspired by engineering workbench UI, grid-based layout systems, and code editors. It combines precise typography, high-contrast code snippets, subtle background grid patterning, and functional metadata badges to communicate complex Content Security Policy (CSP) security concepts clearly and interactively.

### Key Aesthetic Principles

* **Grid Architecture:** Subtle full-page background grid providing structural rigor.

* **Code-First Visual Hierarchy:** Technical concepts and HTTP headers are emphasized with monospaced typography, dark high-contrast cards, and inline tag styling.

* **Minimal & Functional Palette:** Monochromatic base tones (light blue-grey, slate dark gray) paired with purposeful accent colors (rust/burnt orange for tags, emerald green for live indicators).

* **Asymmetric Grid Layout:** Two-column desktop grid with action triggers on the left and real-time report telemetry stream pinned on the right.

## 2. Color Palette & Theming

```css
:root {
  /* Surface & Background Colors */
  --bg-page: #e7ecee;              /* Soft grid canvas background */
  --bg-grid-line: #d8dedf;          /* Grid pattern lines */
  --bg-card: #f4f7f8;              /* Interactive card surface */
  --bg-card-border: #d0d7de;       /* Clean boundary border */
  --bg-terminal: #0b1928;          /* High-contrast code/header preview */
  --bg-panel: #fbfcfd;             /* Floating feed sidebar surface */

  /* Text & Content Colors */
  --text-primary: #0f172a;         /* High-contrast primary text */
  --text-secondary: #475569;       /* Secondary body/description text */
  --text-muted: #64748b;           /* Captions, timestamps, small labels */
  --text-code-light: #e2e8f0;      /* Code text on dark background */

  /* Brand & Status Accents */
  --red: #c63a20;                  /* Brand mark accent red */
  --accent-amber: #b45309;        /* Nonce/Directive highlight badge */
  --bg-badge-amber: #c25e00;       /* Badge fill color */
  --text-badge-amber: #ffffff;
  
  --accent-green: #10b981;        /* Live endpoint indicator dot */
  --accent-blue: #3b82f6;         /* Code directive key highlight */

  /* Code Syntax Highlighting */
  --code-directive: #60a5fa;      /* CSP directive keys (e.g., script-src) */
  --code-value: #f1f5f9;          /* Directive values */
  --code-keyword: #f59e0b;        /* High-priority directives */
}
```

## 3. Typography System

The design utilizes a dual-font structure pairing a modern sans-serif for UI titles/body with a clean monospaced font for all technical directives, code snippets, and data streams.

| Usage | Font Family | Size / Weight | Line Height | Letter Spacing | 
| ----- | ----- | ----- | ----- | ----- | 
| **Hero Title** | Sans-Serif (Inter / SF Pro Display) | `48px` / Bold (700) | 1.05 | \-0.02em | 
| **Section Header** | Sans-Serif | `28px` / Bold (700) | 1.2 | \-0.01em | 
| **Card Title** | Sans-Serif | `16px` / Semi-Bold (600) | 1.3 | Normal | 
| **Body Text** | Sans-Serif | `15px` / Regular (400) | 1.5 | Normal | 
| **Code / Directives** | Monospace (Fira Code / JetBrains Mono) | `13px` / Regular (400) | 1.6 | Normal | 
| **Status Badges** | Monospace | `11px` / Medium (500) | 1.0 | +0.03em | 

## 4. Page Layout Structure & Grid Architecture

### Canvas Background

* **Pattern:** `background-size: 24px 24px` SVG or CSS linear-gradient graph paper grid.

* **Border Frame:** A dark horizontal divider line separating the persistent top navbar from the main work area.

```css
.grid-bg {
  background-color: var(--bg-page);
  background-image: 
    linear-gradient(to right, var(--bg-grid-line) 1px, transparent 1px),
    linear-gradient(to bottom, var(--bg-grid-line) 1px, transparent 1px);
  background-size: 24px 24px;
}
```

### Main Sections Architecture

1. **Persistent Top Navigation Bar**

   * Brand Wordmark (`.wordmark` with `.wordmark-mark`).

   * Live endpoint indicator with active green status dot.

   * External mode link (`See the enforced page`).

2. **Hero Header & Response Header Terminal Block**

   * **Left Column:** Large display copy (*"Nothing is blocked. Everything is reported."*), concise explanation, metadata chips (`Report-Only`, `Fresh nonce per response`, `12 directives`).

   * **Right Column:** Dark terminal block (`#0b1928`) showcasing the raw `Content-Security-Policy-Report-Only` response header with syntax highlighting.

3. **Violation Demonstration Grid (4 Cards)**

   * Grid showing triggered/attempted elements: `img-src`, `frame-src`, `script-src` (inline without nonce), `script-src` (strict-dynamic).

   * Display items feature dashed boundary frames or code blocks overlaying light/dark card slots.

4. **Interactive Trigger Grid & Live Reports Console**

   * **Left Section (Main Workspace):** 2-column layout of interactive test triggers (`Inline event handler`, `Remote stylesheet`, `Remote image`, `Cross-origin iframe`, `Outbound fetch`, `Inline script with the nonce`, `Same-origin fetch`, `Inline style`).

   * Each card contains:

     * Title + Status badge (`Not run` / `Executed`).

     * Monospace target snippet box.

     * Description text detailing expected CSP behavior.

     * Primary action button (`Run test`).

   * **Right Section (Sticky Sidebar):** Floating **Live Reports** stream box showing incoming POST payload details from `/api/csp-report` in real time with a `Clear` button.

5. **Footer / Architecture Summary**

   * Key-value metadata table covering Policy mode (`Observe only`), Reporting directive (`report-uri`), Transport protocol (`HTTP + HTTPS`), and Storage engine (`in memory`).

## 5. Component Patterns & UI Elements

### 5.1 Brand Logo & Wordmark

The header mark consists of a small, hard-shadowed square accent paired with monospaced typography.

```css
.wordmark {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  font-family: var(--font-code);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
  text-decoration: none;
  color: var(--text-primary);
} 
  
.wordmark-mark {
  width: 11px;
  height: 11px;
  background: var(--red);
  box-shadow: 3px 3px 0 rgba(10, 28, 39, 0.22);
}
```

### 5.2 Status Badges & Tag Chips

* **Report-Only Tag:** Dark orange/amber background (`#c25e00`), crisp rounded border (`2px`), white monospace text.

* **Directive Tag (e.g., `img-src`, `script-src`):** Embedded top-left inside code blocks or image previews as high-contrast labels.

* **Execution Status Tag (`Not run`):** Light grey background with monospaced subtle text.

### 5.3 Interactive Cards

```css
.test-card {
  background: var(--bg-card);
  border: 1px solid var(--bg-card-border);
  border-radius: 6px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}
```

### 5.4 Buttons

* **Primary Action (`Run test`):**

  * Dark dark blue/black background (`#0b1928`).

  * Text color: `#ffffff` (Monospace/Sans-serif hybrid).

  * Hover effect: Slight brightness shift or opacity change (`0.9`).

  * Radius: `4px`.

  * Padding: `8px 16px`.

* **Secondary Control (`Clear`):**

  * Light border button with subtle shadow and crisp rounded corners.

### 5.5 Live Telemetry Log Feed Item

* **Entry Structure:**

  * Header: Directive type (`script-src-elem`) on left, timestamp (`20:30:57`) on right.

  * Sub-label: Execution type (`inline`) and target endpoint (`/report-only`).

  * Code preview strip: Light grey container displaying blocked string (`window.__staticInlineScriptRan = true;`).

  * Footer pill: `report-uri` label paired with `report line 1`.

## 6. Design System Integration Guidelines

When implementing updates or additional pages in this environment:

1. Maintain strict grid alignment with existing 24px layout dimensions.

2. Ensure code blocks always use dark backgrounds for headers and light backgrounds for interactive input fields.

3. Keep live status indicators dynamic (green pulse dot for connected WebSocket/telemetry stream).

4. Preserve tone of voice: informative, developer-focused, clear, and focused on security mechanics.