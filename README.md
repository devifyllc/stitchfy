# Stitchfy v2

**Turn a plain Markdown file into a production-ready static website — in minutes.**

[![Version](https://img.shields.io/badge/version-2.0.0-brightgreen.svg)](package.json)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-green.svg)](package.json)
[![Next.js](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org)

---

## What is Stitchfy?

Stitchfy is an open-source, AI-assisted code generation framework that takes a single Markdown file describing a business and produces a fully structured, accessible, SEO-optimized static website — deployable to any static host with no server required.

You describe the business in plain language. Stitchfy runs a pipeline of specialized agents that each handle a distinct concern (intake, UX strategy, SEO, accessibility, frontend assembly), then generates a complete Next.js site and exports it as static HTML/CSS/JS.

**Who it's built for:** Developers and agencies building websites for small and mid-sized local businesses — beauty salons, nail studios, massage spas, medical clinics, dental offices, restaurants, and similar service providers.

---

## The Problem It Solves

Building a professional website for a local business involves repetitive work: establishing page structure, writing meta tags, ensuring WCAG compliance, setting up routing, wiring navigation, and applying brand colors — all before a single line of content is written.

Stitchfy encodes that professional knowledge into a pipeline. Each agent applies best practices for its domain so you don't have to rediscover them for every client:

- The UX Agent decides page hierarchy and hero strategy based on industry type
- The SEO Agent writes structured data (JSON-LD), Open Graph tags, and per-page meta descriptions
- The Accessibility Agent enforces WCAG 2.1 AA requirements — skip links, landmarks, keyboard navigation, color contrast, ARIA
- The Frontend Agent assembles everything into a validated blueprint that drives real code generation

The output is a complete Next.js static site with 12 pre-built components and an HTML audit report — all from one Markdown file.

---

## Quick Start

```bash
# 1. Install
git clone https://github.com/devifyllc/stitchfy.git
cd stitchfy
npm install

# 2. Describe your business
cp examples/beauty-salon.md input/project.md
# (edit input/project.md with the real business details)

# 3. Generate blueprint + website
npm run stitchfy
npm run build:site

# 4. Audit accessibility and SEO
npm run audit
```

Open `output/static-site/index.html` in any browser. Deploy the `output/static-site/` folder to S3, Netlify, Vercel, or any static host.

---

## How It Works

```
input/project.md
       │
       ▼
┌─────────────────────┐
│  1. Intake Agent    │  Parses Markdown → structured business data
└────────┬────────────┘  (name, hours, services, contact, socials, brand tone)
         │
         ▼
┌─────────────────────┐
│  2. UX Agent        │  Industry-aware page strategy, color palette,
└────────┬────────────┘  navigation, hero visual spec, typography
         │
         ▼
┌─────────────────────┐
│  3. SEO Agent       │  Per-page titles + descriptions, JSON-LD schema.org,
└────────┬────────────┘  Open Graph tags, canonical URLs
         │
         ▼
┌─────────────────────┐
│  4. Accessibility   │  WCAG 2.1 AA checklist (30 checks), landmark
│     Agent           │  requirements, ARIA guidelines, reduced-motion rules
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  5. Frontend Agent  │  Component map, routing plan, unsupported features
└────────┬────────────┘  list, implementation notes
         │
         ▼
┌─────────────────────┐
│  Schema Validation  │  Zod validates the entire blueprint before writing
└────────┬────────────┘
         │
         ▼
output/blueprint/website-blueprint.v1.json   ← Validated, machine-readable spec
         │
         ▼ (npm run build:site)
┌─────────────────────┐
│  Site Generator     │  Reads blueprint → writes a complete Next.js app
└────────┬────────────┘  with real brand data embedded in every component
         │
         ▼
output/generated-site/    ← Next.js 14 App Router project (generated)
output/static-site/       ← Pure HTML/CSS/JS export (deployable)
         │
         ▼ (npm run audit)
output/reports/
  ├── accessibility-report.html
  ├── seo-report.html
  └── final-report.html
```

---

## Writing Your Input

Create `input/project.md` with the following sections. All sections are optional but the more you include, the better the output.

```markdown
# Project: Your Business Name

## Business Information
- **Business Name:** Luxe Beauty Studio
- **Industry:** Beauty Salon
- **Description:** One-paragraph description of what you do and who you serve.

## Operating Hours
- Monday–Friday: 9:00 AM – 7:00 PM
- Saturday: 9:00 AM – 6:00 PM
- Sunday: Closed

## Services
- Service Name One
- Service Name Two
- Service Name Three

## Location
- Address: 1234 Main St, Suite 1, City, ST 00000
- Neighborhood: Optional — neighborhood name helps local SEO

## Contact Information
- Phone: (555) 555-0100
- Email: hello@yourbusiness.com

## Social Networks
- Instagram: @yourhandle
- Facebook: /yourpage
- TikTok: @yourhandle

## Booking Preference
- Online booking via Vagaro (https://www.vagaro.com/yourbusiness)
- Phone call during business hours

## Desired Pages
- Home
- Services
- Gallery
- About Us
- Contact
- Book Online

## Brand Tone
- Warm and welcoming
- Modern and visually polished

## Color Preferences
- Primary: #C4847A
- Secondary: #FAF8F5
- Accent: #C9A96E
- Text: #2C2C2C
- Borders/subtle backgrounds: #EDD9D5

## Special Notes
- Any additional instructions for the agents go here.
```

See the `examples/` directory for complete working inputs: `beauty-salon.md`, `massage-spa.md`, and `medical-center.md`.

---

## Commands

| Command | Description |
|---|---|
| `npm run stitchfy` | Run the full agent pipeline on `input/project.md` |
| `npm run stitchfy -- --input path/to/file.md` | Run pipeline on a specific input file |
| `npm run validate` | Validate the input file and the last generated blueprint |
| `npm run build:site` | Generate the Next.js app and export to `output/static-site/` |
| `npm run build:site -- --blueprint path/to/blueprint.json` | Build from a specific blueprint file |
| `npm run audit` | Run 14-point HTML accessibility + SEO audit; write HTML reports |
| `npm run typecheck` | TypeScript type-check the framework without emitting |

---

## Generated Output

### Blueprint

`output/blueprint/website-blueprint.v1.json` is a versioned, Zod-validated JSON document with eight sections:

| Section | Content |
|---|---|
| `project` | Schema version, generation timestamp, source file, framework version |
| `business` | All extracted business data — hours, services, contact, socials, booking |
| `pages` | Page definitions with purpose, sections, CTAs, and component hints |
| `ux` | Color palette, typography, navigation, header/footer config, hero visual spec |
| `seo` | Site title, per-page meta, JSON-LD fields, Open Graph values |
| `accessibility` | WCAG 2.1 AA target, 30-item QA checklist, landmark + ARIA requirements |
| `frontend` | Component map, routes, asset plan, unsupported features list |
| `qa` | Lighthouse targets, known limitations, expected report list |

### Pages

The standard page set for a local business site:

| Route | Page | Key Sections |
|---|---|---|
| `/` | Home | Hero, Services preview, Testimonials, Gallery preview, Booking CTA, Hours |
| `/services` | Services | ServicesGrid, FAQ, Booking CTA |
| `/gallery` | Gallery | Filterable GallerySection by service category |
| `/about` | About Us | Hero, Services, Testimonials, CTA, Contact |
| `/contact` | Contact | ContactSection, Hours, FAQ |
| `/book` | Book Online | Booking CTA with external link (Vagaro, phone, or email) |

### Components

12 pre-built accessible React components in `site-template/components/`:

| Component | Description |
|---|---|
| `AccessibilitySkipLink` | Visually hidden skip-to-main link; revealed on keyboard focus |
| `Header` | Sticky header with navigation, phone link, and booking CTA button |
| `Footer` | 3-column footer: brand + contact, navigation, hours; social icons |
| `SocialIcons` | Inline SVG icons for Instagram, Facebook, Twitter/X, TikTok, YouTube, Pinterest, Yelp, LinkedIn |
| `Hero` | Full-width hero with brand gradient or solid background, headline, CTA buttons |
| `ServicesGrid` | Responsive 3-column service card grid |
| `HoursBlock` | Operating hours rendered as an accessible `<dl>` list |
| `ContactSection` | Phone, email, address with `tel:` and `mailto:` links |
| `CTASection` | Accent-background call-to-action with headline and button |
| `FAQSection` | Expandable FAQ accordion with ARIA |
| `GallerySection` | Photo grid with optional category filter buttons and `aria-pressed` state |
| `TestimonialsSection` | Testimonial card grid with author attribution |
| `BookingCTA` | Standalone booking section; supports external link, phone, or email |

### Reports

Three self-contained HTML reports in `output/reports/`:

- **`accessibility-report.html`** — WCAG 2.1 AA compliance checklist (30 checks), per-page HTML analysis (14 regex-based checks per route), pass/warn/fail badges
- **`seo-report.html`** — Per-page meta title + description table, structured data recommendations, Open Graph tag audit
- **`final-report.html`** — Pipeline summary, route table, unsupported features, recommended next steps

> All reports include the disclaimer: *"Stitchfy completed an automated and structured accessibility-oriented review against the framework checklist. This does not constitute legal certification. Lighthouse scores were not generated in this run."*

---

## Deployment

The `output/static-site/` folder is pure static HTML/CSS/JS with no Node.js runtime required. Deploy it anywhere:

```bash
# AWS S3 + CloudFront
aws s3 sync output/static-site/ s3://your-bucket --delete

# Netlify
netlify deploy --prod --dir output/static-site

# Vercel
vercel --prebuilt output/static-site

# GitHub Pages — copy contents into your gh-pages branch
```

Or simply open `output/static-site/index.html` directly in a browser for local preview.

---

## Industry Support

The UX and SEO agents apply industry-specific defaults for color palette, typography, page strategy, JSON-LD schema type, and gallery content. Supported verticals:

| Industry keyword | Schema.org type | Palette style | Gallery seeds |
|---|---|---|---|
| `beauty`, `salon`, `hair`, `nail`, `lash` | `BeautySalon` | Warm rose + cream gradient | Hair, nails, skincare |
| `wellness`, `massage`, `yoga`, `spa` | `HealthAndBeautyBusiness` | Soft green + warm off-white | Massage, classes, body |
| `medical`, `clinic`, `dental`, `doctor` | `MedicalClinic` | Clean white + navy | Facility, team, technology |
| `restaurant`, `cafe`, `bistro`, `dining` | `Restaurant` | Warm cream + tan gradient | Food, drinks, ambiance |
| *(any other)* | `LocalBusiness` | Neutral blue-grey | Services, team, facility |

---

## Design System

Brand colors from `input/project.md` are wired into CSS custom properties applied across the entire site:

```css
--color-primary      /* main brand color — buttons, accents */
--color-secondary    /* background tone */
--color-accent       /* highlight color — hover states, badges */
--color-text         /* body text */
--color-border       /* subtle dividers and card borders */
--font-heading       /* heading typeface (Google Fonts, loaded via <link>) */
--font-body          /* body typeface */
```

The hero background is derived from `ux.heroStyle` — a structured field the UX Agent generates from the palette — so the hero always uses the actual brand gradient rather than defaulting to white.

Gallery images use [picsum.photos](https://picsum.photos) with deterministic seeds for realistic layout previews. Replace the URLs in `site.config.ts` with real photos before going live.

---

## OpenAI Integration

All five agents are structured to support an OpenAI API call but run **fully deterministically** in the default mode — no API key required. The integration point is marked in each agent file:

```typescript
// OPENAI INTEGRATION POINT:
//   const response = await openai.chat.completions.create({
//     model: process.env.OPENAI_MODEL ?? "gpt-4o",
//     messages: [
//       { role: "system", content: readPrompt("ux.prompt.md") },
//       { role: "user", content: JSON.stringify(businessData) },
//     ],
//     response_format: { type: "json_object" },
//   });
```

To enable AI generation:
1. Add `OPENAI_API_KEY=sk-...` to a `.env` file in the project root
2. Replace the deterministic logic in each agent with the commented API call
3. Parse the `response.choices[0].message.content` into the expected typed output

The framework's Zod schema validates the agent output regardless of whether it comes from AI or local logic — so the pipeline stays safe either way.

---

## What This Does NOT Include

By design, Stitchfy generates **informational static websites only**. The following are deliberately out of scope:

- Real booking, scheduling, or appointment systems
- Payment flows, e-commerce, or product catalogs
- User accounts, authentication, or session management
- Backend APIs, databases, or server-side logic
- CRM or email marketing integrations
- HIPAA-grade forms or protected health information handling

Booking links point to third-party platforms the business already uses (Vagaro, Mindbody, OpenTable, etc.). Stitchfy generates the page that links out — not the booking engine itself.

---

## Repository Structure

```
stitchfy/
├── input/
│   └── project.md                ← Your business spec goes here
│
├── examples/
│   ├── beauty-salon.md
│   ├── massage-spa.md
│   └── medical-center.md
│
├── framework/
│   ├── orchestrator/
│   │   ├── orchestrator.ts       ← Pipeline driver (9 steps)
│   │   ├── agent-runner.ts       ← Runs each agent, handles errors
│   │   └── workflow-state.ts     ← Shared state passed between agents
│   ├── agents/
│   │   ├── intake.agent.ts       ← Stage 1: business data extraction
│   │   ├── ux.agent.ts           ← Stage 2: UX strategy + hero spec
│   │   ├── seo.agent.ts          ← Stage 3: meta tags + structured data
│   │   ├── accessibility.agent.ts← Stage 4: WCAG 2.1 AA checklist
│   │   └── frontend.agent.ts     ← Stage 5: component map + routes
│   ├── core/
│   │   ├── site-generator.ts     ← Blueprint → Next.js source code
│   │   ├── report-generator.ts   ← Static HTML audit reports
│   │   ├── markdown-parser.ts    ← Parses input/project.md
│   │   └── blueprint-writer.ts   ← Writes output/blueprint/*.json
│   ├── schemas/
│   │   ├── blueprint.types.ts    ← TypeScript interfaces (source of truth)
│   │   └── blueprint.schema.ts   ← Zod validation + error messages
│   └── validators/
│       ├── validate-input.ts
│       └── validate-blueprint.ts
│
├── site-template/                ← React components copied into every generated site
│   ├── app/
│   │   ├── layout.tsx            ← Root layout: JSON-LD, Google Fonts, metadata
│   │   └── page.tsx              ← Template placeholder (overwritten per site)
│   ├── components/               ← 12 accessible React components
│   └── lib/types.ts              ← Shared TypeScript types
│
├── scripts/
│   ├── run-stitchfy.ts           ← Entry point: npm run stitchfy
│   ├── build-site.ts             ← Entry point: npm run build:site
│   ├── audit-site.ts             ← Entry point: npm run audit
│   └── validate.ts               ← Entry point: npm run validate
│
├── output/                       ← All generated artifacts (gitignored)
│   ├── blueprint/
│   ├── generated-site/
│   ├── static-site/
│   └── reports/
│
├── assets/                       ← Project images and diagrams
├── LICENSE
├── NOTICE
└── package.json
```

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Agents live in `framework/agents/` — one file per stage, following the `AgentConfig` interface in `framework/orchestrator/agent-runner.ts`
4. Add or update the Zod schema in `framework/schemas/blueprint.schema.ts` for any new blueprint fields
5. Keep TypeScript types in `framework/schemas/blueprint.types.ts` in sync with the Zod schema
6. Run `npm run typecheck` before submitting a pull request

When adding a new component to `site-template/components/`, the site generator picks it up automatically — no additional copy step needed.

---

## License

Apache License 2.0 — see [LICENSE](LICENSE) and [NOTICE](NOTICE) for full terms.

Copyright 2024–2025 Devify LLC

---

*Stitchfy v2.0.0 — Built by [Devify LLC](https://github.com/devifyllc)*
