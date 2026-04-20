# Style Guide
## Elan Greens — Design System v1.0.0

> This guide applies to **both** the Main App (`elan-greens`) and Admin App
> (`elan-greens-admin`). Shared tokens ensure visual consistency. App-specific
> sections are clearly marked.

---

## 1. Brand Colours

```css
/* Primary palette */
--color-green-900: #1B5E20;   /* deepest — used for active nav, pressed states */
--color-green-700: #2E7D32;   /* BRAND PRIMARY — buttons, badges, header bg */
--color-green-500: #4CAF50;   /* hover states, secondary actions */
--color-green-100: #C8E6C9;   /* light backgrounds, selected chip bg */
--color-green-050: #F1F8E9;   /* page background tint on main app */

/* Neutrals */
--color-grey-900: #212121;    /* body text */
--color-grey-600: #757575;    /* secondary text, captions */
--color-grey-300: #E0E0E0;    /* borders, dividers */
--color-grey-100: #F5F5F5;    /* card backgrounds */
--color-white:    #FFFFFF;

/* Semantic */
--color-amber:   #FF8F00;     /* TENTATIVE badge, caution states */
--color-red:     #D32F2F;     /* error states, toxicity warning */
--color-teal:    #00796B;     /* Creeper/Climber category badge */
```

### Category badge colours

| Category | Background | Text |
|----------|-----------|------|
| Tree | `#E8F5E9` | `#2E7D32` |
| Palm | `#E0F2F1` | `#00796B` |
| Shrub | `#F3E5F5` | `#6A1B9A` |
| Herb | `#FFF8E1` | `#F57F17` |
| Creeper | `#E3F2FD` | `#1565C0` |
| Climber | `#FCE4EC` | `#880E4F` |
| Hedge | `#F9FBE7` | `#558B2F` |
| Grass | `#EFEBE9` | `#4E342E` |

---

## 2. Typography

```css
/* Google Fonts — loaded in layout.tsx */
/* Dancing Script: logo only */
/* Inter: all UI text */

--font-logo: 'Dancing Script', cursive;     /* élan wordmark */
--font-body: 'Inter', sans-serif;           /* everything else */

/* Scale */
--text-xs:   12px / 1.4;    /* attribution captions, metadata */
--text-sm:   14px / 1.5;    /* secondary labels, badges */
--text-base: 16px / 1.6;    /* body copy */
--text-lg:   18px / 1.5;    /* card common names */
--text-xl:   24px / 1.3;    /* section headings */
--text-2xl:  32px / 1.2;    /* page headings */
--text-3xl:  48px / 1.1;    /* hero plant name overlay */

/* Weights */
--weight-regular: 400;
--weight-medium:  500;
--weight-bold:    700;
```

---

## 3. Spacing

Uses a 4px base unit. All spacing values are multiples of 4.

```
4px   → micro gaps (badge padding, icon margins)
8px   → tight spacing (inside chips, small cards)
12px  → default padding-y for inputs
16px  → card padding, section gaps
24px  → between card rows
32px  → section top/bottom padding
48px  → page section breaks
```

---

## 4. Border Radius

```css
--radius-sm:   6px;    /* inputs, table cells */
--radius-md:   12px;   /* cards */
--radius-lg:   16px;   /* filter chips, badges */
--radius-full: 9999px; /* pill badges */
```

---

## 5. Shadows

```css
--shadow-card:   0 2px 8px rgba(0,0,0,0.08);
--shadow-raised: 0 4px 16px rgba(0,0,0,0.12);
--shadow-none:   none;
```

---

## 6. Breakpoints

```css
/* Mobile-first — styles written for 390px, then overridden upward */
sm:  640px    /* large phones, small tablets */
md:  768px    /* tablets */
lg:  1024px   /* small laptops */
xl:  1280px   /* desktop */
```

Grid columns per breakpoint for plant listing:

| Breakpoint | Columns |
|------------|---------|
| default (mobile) | 2 |
| sm (640px) | 2 |
| md (768px) | 3 |
| lg (1024px) | 4 |
| xl (1280px) | 4 |

---

## 7. Logo

```
Font    : Dancing Script (Google Fonts)
Text    : élan   (lowercase, with accent on e)
Size    : 28px in nav bar
Colour  : #2E7D32 on white bg / #FFFFFF on green bg
Weight  : 700
```

Do not use the logo as an image file. Render it as a `<span>` with the font applied. This keeps it sharp at all sizes and requires no image asset.

---

## 8. Component Patterns

### Plant Card (Main App)
```
┌─────────────────────┐
│  [thumbnail image]  │  ← 4:3 aspect ratio, object-cover
│  [Category badge]   │  ← top-left overlay
├─────────────────────┤
│  Common Name        │  ← text-lg, bold
│  Botanical name     │  ← text-sm, italic, grey-600
│  Hindi / Kannada    │  ← text-xs, grey-600
│  📍 3 locations     │  ← text-xs, green-700
└─────────────────────┘
  [TENTATIVE] badge shown below card if tentative=true
```

### Filter Chip
```
Inactive: bg-white, border grey-300, text grey-900
Active:   bg-green-100, border green-700, text green-900
```

### Toast Messages (Admin App)
```
Success: bg-green-700, white text, ✅ icon
Error:   bg-red-600, white text, ❌ icon
Warning: bg-amber, dark text, ⚠️ icon
Duration: 4 seconds, dismissible
Position: bottom-right (desktop), bottom-centre (mobile)
```

---

## 9. Main App vs Admin App Differences

| Element | Main App | Admin App |
|---------|---------|-----------|
| Page background | `#F1F8E9` (green tint) | `#F5F5F5` (neutral grey) |
| Nav | Bottom bar (mobile), top bar (desktop) | Left sidebar (desktop), hamburger (mobile) |
| Card style | Elevated, image-first | Flat table rows |
| Decoration | Plant imagery, nature-themed | Minimal, functional |
| Font size base | 16px | 14px (data-dense screens) |

---

## 10. Accessibility

- All interactive elements meet WCAG AA contrast ratio (4.5:1 for text)
- `#2E7D32` on white = 5.1:1 ✅
- Touch targets minimum 44×44px on mobile
- All images have `alt` text (plant name + type)
- Keyboard navigation works on all forms and nav elements
