# Quiet Hour — Design Direction

## Three Directions Considered

| Theme Name | Very Brief Intro | Probability |
|---|---|---:|
| Quiet Cartography | A city-wellness directory shaped like a refined field guide: confident wayfinding, textured editorial spaces, and calm service discovery. It feels useful enough for a weekday search and considered enough to inspire a reset. | 0.06 |
| Sunroom Apothecary | A warm, domestic wellness mood built from mineral surfaces, sunlight, and gently collected rituals. It is intimate and tactile rather than overtly luxurious. | 0.03 |
| After-Rain Studio | A more graphic, gallery-like system with clear geometry, misty color, and sharp typography. It offers a contemporary cultural directory feel, with wellness as the quieter counterpoint. | 0.08 |

## Chosen Direction: Quiet Cartography

### Design Movement

**Contemporary civic wayfinding meets tactile wellness editorial.** Quiet Hour will feel like an intelligent city guide that happens to be deeply restorative: a clear directory first, softened by art-book restraint, natural texture, and slow moments of invitation.

### Core Principles

The experience will make **place** the primary organizing idea, using city, neighbourhood, and modality as immediate navigational anchors. It will pair **decisive utility**—search, filters, transparent listing type, concise pricing—with a calm editorial pace. It will use **asymmetry with purpose**, allowing imagery, headings, and listing bands to lead the eye in a way that resembles a well-designed guidebook rather than a dashboard. Finally, every interaction must signal **credible calm**: considered, quick, and never showy.

### Color Philosophy

The visual field is built from limestone, unbleached paper, mossed grey, and deep inky blue. These tones make information easy to read and create space around therapies and practitioners without relying on stereotypical spa pastels. The ownable signature color is **Copperleaf**—a muted burnt orange used sparingly to signal premium status, a live action, and the human warmth inside the directory.

### Layout Paradigm

The site follows a **field-guide flow**, not a conventional centered grid. Oversized editorial prompts sit left of action modules; an offset city index punctuates the page; listings are arranged as collectable “places” in a staggered rhythm; and neighbourhood or topic trails help people orient themselves. The main directory has a split exploration layout, with filters as a quiet side rail and results occupying the more expressive field.

### Signature Elements

Quiet Hour uses a numbered **rest index** to make category and listing groupings instantly scannable. It uses a thin **city coordinate line**—a small text-and-rule motif—to mark place and context across cards, profiles, and articles. It also uses a **slow premium ribbon** that becomes active only after the fourth premium city listing; until then, its arrangement is deliberately static.

### Interaction Philosophy

Interactions should behave like good wayfinding. Search and filter changes provide immediate, legible feedback. Listing cards lift slightly and reveal a tiny directional arrow rather than adding loud visual effects. Premium ribbon motion is ambient, not promotional; it pauses on hover and is removed for reduced-motion preferences. The purchase path makes the US$21 weekly price clear before a user enters any payment information.

### Animation

Motion is reserved for orientation and attention. Intro elements enter by short opacity and vertical-transform transitions, staggered at 45–60ms. Card hover changes use 160–220ms cubic-bezier easing, with active press feedback at 0.97 scale. The premium ribbon uses an exceptionally slow linear loop only when the listing count exceeds three, pauses on hover or focus, and reverts to an ordinary static flex layout for one to three listings. All non-essential animation respects `prefers-reduced-motion`.

### Typography System

**DM Serif Display** is the voice for feature headlines and article moments: quietly literary, warm, and specific. **Manrope** handles navigation, data, filters, labels, and body copy for high legibility at small sizes. Headlines use deliberate contrast and left alignment; metadata is compact, uppercase, and letter-spaced. No generic welcome language or dense all-caps blocks will be used.

### Brand Essence

**Quiet Hour is the city guide for people seeking better ways to feel well—clearer, calmer, and closer to home.** Its personality is **curious, composed, and discerning**.

### Brand Voice

Headlines are observant rather than inflated, CTAs are specific rather than generic, and microcopy treats time and wellbeing with a light, human touch. Example: “Your next exhale has an address.” Example: “Find a practitioner worth leaving your neighbourhood for.”

### Wordmark & Logo

The wordmark will be a custom-styled Quiet Hour lockup that uses a serif-led cadence with measured letter spacing. The mark is a bold, text-free **double-arch waypoint**: two nested, imperfect arcs forming a calm horizon and a subtle Q-shaped negative space. It is distinctive at favicon scale and strong enough to lead the header.
