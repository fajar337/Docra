# Design — Docra

A locked design system for Docra. Visual changes should preserve the editor's
MuPDF, Konva, Zustand, history, and export flows.

## Genre

Modern-minimal application workbench with a dark-first iOS-inspired liquid
glass material layer.

## Macrostructure family

- App screens: Workbench — floating command surface, content canvas, contextual inspector.
- Content screens: Long Document — typography-first, using the same material and tokens.
- Marketing screens: Marquee Hero — allowed only outside the editor route.

## Theme

- Paper: `oklch(96.5% 0.009 250)`
- Ink: `oklch(18% 0.016 255)`
- Accent: `oklch(56% 0.2 252)`
- Dark paper: `oklch(10.5% 0.018 255)`
- Dark ink: `oklch(95% 0.008 250)`
- Glass is reserved for navigation, inspector, status, and transient overlays.
- Dark mode leads the material direction with cool navy tint, a restrained
  cyan-blue refraction, thin specular edges, and no neon halo.
- Nested controls use translucent fills and reflective gradients without
  additional backdrop blur.

## Typography

- Display: Apple system display stack, weight 650, roman.
- Body: Apple system text stack, weight 400–550.
- Mono: SF Mono / JetBrains Mono for diagnostics and tabular metadata only.
- Display tracking: `-0.025em` to `-0.035em`.
- UI body anchor: `0.9375rem` with `1.5` line-height.

## Spacing

4-point named scale. Production CSS must use the variables in `tokens.css`.

## Motion

- Easings: `--ease-out`, `--ease-in`, and `--ease-in-out`.
- Material entrance: opacity + 8px translation, 420ms, once.
- Toolbar refraction follows fine-pointer movement and keyboard focus through a
  requestAnimationFrame-scheduled transform; no document-canvas repaint.
- Direct controls: immediate press feedback at 120ms.
- Reduced motion: no spatial entrance; functional loaders remain slowed.

## Microinteractions stance

- Silent success when the edited result is already visible.
- Focus rings appear instantly and use a two-stage contrast ring.
- Hover is supplementary; every action remains available by keyboard and touch.
- No decorative loops, parallax, cursor effects, or overshoot.

## CTA voice

- Primary action: restrained system-blue fill, compact rounded rectangle, direct verb.
- Secondary action: translucent fill with a thin material border.

## Per-page allowances

- App pages must not use decorative enrichment; the document is the content.
- Modal or popover surfaces may use Glass Level 3.
- Ambient illumination remains static and below the functional surfaces.

## What pages MUST share

- Docra wordmark and file-document mark.
- Cool neutral palette and system-blue accent.
- System typography, control heights, focus treatment, and corner hierarchy.
- The three-level glass material primitives.

## What pages MAY differ on

- Inspector content and available tool groups.
- Canvas density and responsive placement.
- Whether a status capsule is shown.

## Exports

### tokens.css

```css
:root {
  --color-paper: oklch(96.5% 0.009 250);
  --color-paper-2: oklch(94.5% 0.01 250);
  --color-paper-3: oklch(91.5% 0.012 250);
  --color-ink: oklch(18% 0.016 255);
  --color-ink-2: oklch(29% 0.018 255);
  --color-muted: oklch(47% 0.022 254);
  --color-rule: oklch(84% 0.014 250);
  --color-accent: oklch(56% 0.2 252);
  --color-accent-ink: oklch(98% 0.006 250);
  --color-focus: oklch(42% 0.2 255);

  --font-display: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif;
  --font-body: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif;
  --font-mono: "SFMono-Regular", "JetBrains Mono", ui-monospace, monospace;

  --space-3xs: 0.25rem;
  --space-2xs: 0.5rem;
  --space-xs: 0.75rem;
  --space-sm: 1rem;
  --space-md: 1.5rem;
  --space-lg: 2rem;
  --space-xl: 3rem;
  --space-2xl: 4rem;

  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in: cubic-bezier(0.7, 0, 0.84, 0);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
  --dur-micro: 120ms;
  --dur-short: 220ms;
  --dur-long: 420ms;
  --radius-control: 0.75rem;
  --radius-panel: 1.5rem;
  --radius-pill: 999px;
}
```

The complete production source, including dark mode and glass tokens, is
[`tokens.css`](tokens.css).

### Tailwind v4 `@theme`

```css
@theme {
  --color-paper: oklch(96.5% 0.009 250);
  --color-paper-2: oklch(94.5% 0.01 250);
  --color-ink: oklch(18% 0.016 255);
  --color-ink-2: oklch(29% 0.018 255);
  --color-accent: oklch(56% 0.2 252);
  --color-focus: oklch(42% 0.2 255);
  --font-display: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
  --font-body: -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif;
  --spacing-xs: 0.75rem;
  --spacing-sm: 1rem;
  --spacing-md: 1.5rem;
  --radius-panel: 1.5rem;
  --radius-pill: 999px;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
}
```

### DTCG `tokens.json`

```json
{
  "$schema": "https://design-tokens.github.io/community-group/format/",
  "color": {
    "paper": { "$value": "oklch(96.5% 0.009 250)", "$type": "color" },
    "ink": { "$value": "oklch(18% 0.016 255)", "$type": "color" },
    "accent": { "$value": "oklch(56% 0.2 252)", "$type": "color" },
    "focus": { "$value": "oklch(42% 0.2 255)", "$type": "color" }
  },
  "font": {
    "display": { "$value": "-apple-system, BlinkMacSystemFont, Helvetica Neue, Arial, sans-serif", "$type": "fontFamily" },
    "body": { "$value": "-apple-system, BlinkMacSystemFont, Helvetica Neue, Arial, sans-serif", "$type": "fontFamily" },
    "mono": { "$value": "SFMono-Regular, JetBrains Mono, ui-monospace, monospace", "$type": "fontFamily" }
  },
  "space": {
    "xs": { "$value": "0.75rem", "$type": "dimension" },
    "sm": { "$value": "1rem", "$type": "dimension" },
    "md": { "$value": "1.5rem", "$type": "dimension" }
  },
  "duration": {
    "micro": { "$value": "120ms", "$type": "duration" },
    "short": { "$value": "220ms", "$type": "duration" },
    "long": { "$value": "420ms", "$type": "duration" }
  }
}
```

### shadcn/ui CSS variables

```css
:root {
  --background: 96.5% 0.009 250;
  --foreground: 18% 0.016 255;
  --card: 94.5% 0.01 250;
  --card-foreground: 18% 0.016 255;
  --popover: 98.7% 0.006 250;
  --popover-foreground: 18% 0.016 255;
  --primary: 56% 0.2 252;
  --primary-foreground: 98% 0.006 250;
  --secondary: 91.5% 0.012 250;
  --secondary-foreground: 29% 0.018 255;
  --muted: 84% 0.014 250;
  --muted-foreground: 47% 0.022 254;
  --border: 84% 0.014 250;
  --input: 84% 0.014 250;
  --ring: 42% 0.2 255;
  --radius: 1.5rem;
}
```
