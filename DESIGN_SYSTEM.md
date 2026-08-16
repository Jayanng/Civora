# Civora — Design System
**Archetype:** Infrastructure / OS for RWA
**Vibe:** Precise, trustworthy, operational
**Background:** White (all pages)

---

## COLOR

### Core light system (white background)

**From your palette:**
- Page background: `#FFFFFF`
- Surface: `#F1F2F4` (iron-grey-50)
- Surface elevated: `#FFFFFF`
- Border: `#E3E5E8` (shadow-grey-100)
- Border strong: `#C7CBD1` (shadow-grey-200)

### Text hierarchy

**From your palette:**
- Text primary: `#17191C` (iron-grey-900)
- Text secondary: `#737F8C` (iron-grey-500)
- Text tertiary: `#ABB2BA` (iron-grey-300)
- Text on accent: `#FFFFFF` (white on filled accents)

### Accent

- Primary: `#427FBD` (rich-cerulean-500)
- Primary hover: `#356897` (rich-cerulean-600)
- Primary muted: `#D9E6F2` (rich-cerulean-100)
- Primary strong: `#284C71` (rich-cerulean-700)
- Secondary: `#0073FF` (cobalt-blue-500)
- Secondary hover: `#005CCC` (cobalt-blue-600)
- Secondary muted: `#CCE3FF` (cobalt-blue-100)

### Dark panels

- Dark panel: `#101214`
- Dark surface: `#17191C`
- Dark border: `#2E3238`
- Dark text: `#F1F2F3`
- Dark text secondary: `#9098A2`

### Semantic colors

- Success / Attested: `#427FBD` (rich-cerulean-500)
- Success background: `#ECF2F8` (rich-cerulean-50)
- Error: `#17191C` (iron-grey-900)
- Error background: `#FDECEC`
- Warning / Pending: `#737F8C` (iron-grey-500)
- Warning background: `#FFF8E6`
- Info: `#0073FF` (cobalt-blue-500)
- Info background: `#E5F1FF` (cobalt-blue-50)

### Gradients

- Brand: `linear-gradient(135deg, #427FBD, #0073FF, #284C71)`
- Subtle surface: `linear-gradient(180deg, #FFFFFF, #F1F2F4)`
- Dark surfaces: `linear-gradient(180deg, #101214, #17191C)`

---

## TYPOGRAPHY

- Primary typeface: Space Grotesk
- Body typeface: IBM Plex Sans
- Mono typeface: JetBrains Mono

---

## SPACING & SHAPE

- Base grid: 8px
- Default radius:
  - 0px for controls
  - 4px for badges
  - 6px for cards and panels
- Shadows: avoided; prefer structure over elevation

---

## MOTION

- Fade-up for entry
- Stagger list loads
- Slide-in for detail expansion
- Pulse for state changes
- Counter tick for metrics

---

## COMPONENT TOKENS (summary)

- Primary button: `#427FBD` with white text
- Secondary button: transparent with `#0073FF` text and border
- Destructive button: `#17191C` with white text
- Input: white background, `#C7CBD1` border, focused `#427FBD`
- Table row: white background with hairline borders
- Badge: semantic color on tinted background

---

## ACCESSIBILITY BASELINE

- Body text meets WCAG AA on white
- UI chrome must keep sufficient contrast
- Focus states use `#427FBD`
- Reduced motion must disable decorative motion only