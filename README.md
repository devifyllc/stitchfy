# Stitchfy v2

**A solution-engineering framework that transforms structured Markdown requirements into traceable solution architecture and implementation-oriented artifacts.**

[![Version](https://img.shields.io/badge/version-2.1.0-brightgreen.svg)](package.json)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-green.svg)](package.json)
[![Next.js](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org)

---

## What is Stitchfy?

Stitchfy is an open-source framework that takes a plain Markdown file describing a business — its goals, processes, systems, and requirements — and generates a structured, traceable solution architecture: which capabilities apply, what each one specifies, and (where a real exporter exists) implementation-oriented scaffolding a team can review and build from.

It supports:

- **Static website generation** — Stitchfy's original, fully executable generation capability: a complete accessible, SEO-optimized static site from one Markdown file. Unchanged and still fully working — see "Website Quick Start" below.
- **Business process discovery** — structured extraction of goals, actors, processes, systems, integrations, and requirements from Markdown.
- **Workflow automation specification generation** — steps, decisions, notifications, and human-in-the-loop approvals derived from real process/requirement text.
- **Integration architecture generation** — REST/webhook contracts, authentication, and data contracts, plus a `generic-rest-typescript` export adapter for integrations with a complete contract.
- **AI agent architecture generation** — tool/permission/guardrail/memory specifications tied to real integrations, never assumed autonomous, persistent, or bound to a specific model by default.
- **Security and governance architecture generation** — requirements, trust boundaries, and risk assessment derived from real integration/data/workflow evidence.
- **Observability architecture generation** — signals, alerts, and operational objectives citing real architecture entities, with no fabricated thresholds.
- **Cloud/deployment architecture generation** — vendor-neutral deployment topology, never assuming a provider unless one is explicitly stated.
- **Legacy modernization architecture generation** — assessment and migration-strategy architecture, optionally enriched with read-only local repository evidence, plus a `generic-java-replatform` export adapter that proposes (never applies) a migration recipe.

Each of the eight non-website capabilities is **selected**, not always run: a planning stage assesses every registered capability against structured evidence in the input document (an explicit `## Deployment Requirements` section, an explicit REST integration, an explicit `## AI Agent Needs` section, ...) before any of them execute, and records why each one was or wasn't selected — see `output/reference/<scenario>/reports/solution-plan.md` after running any example. Stitchfy never blindly runs every capability on every input. Most of the pipeline is fully deterministic; no AI/LLM call is required anywhere in the solution-architecture pipeline (see "OpenAI Integration" below for the one, optional, opt-in exception in the website blueprint pipeline).

**Three canonical, end-to-end worked examples** exercising real combinations of these capabilities together live under `examples/reference/` — see `docs/reference/END_TO_END.md` for the full walkthrough.

**Who it's built for:** Developers and agencies who need to turn a business requirements document into reviewable architecture — from a small-business website, through workflow/integration/AI-agent specifications, to a legacy-modernization migration recipe.

---

## Architecture at a glance

```
Markdown Requirements
        ↓
Business Discovery              (extracts explicit facts — never infers)
        ↓
Solution Planning               (selects capabilities from structured evidence)
        ↓
Capability Registry
        ↓
┌─────────────────────────────────────────┐
│ Website                                  │
│ Workflow Automation                      │
│ Integrations                             │
│ AI Agents                                │
│ Security / Governance                    │
│ Observability                            │
│ Cloud / Deployment                       │
│ Legacy Modernization                     │
└─────────────────────────────────────────┘
        ↓
Validated Solution Architecture  (SolutionBlueprint)
        ↓
Optional Exporters / Codebase Evidence
   (generic-rest-typescript, generic-java-replatform, read-only repo analysis)
```

Not every capability executes on every input — only the ones structured evidence actually supports. See `docs/reference/CAPABILITY_MATRIX.md` for exactly which capability fires on each of the three canonical references.

---

## The Problem It Solves (Website Generation)

Building a professional website for a local business involves repetitive work: establishing page structure, writing meta tags, ensuring WCAG compliance, setting up routing, wiring navigation, and applying brand colors, all before a single line of content is written.

Stitchfy encodes that professional knowledge into a pipeline. Each agent applies best practices for its domain so you don't have to rediscover them for every client:

- The UX Agent decides page hierarchy and hero strategy based on industry type
- The SEO Agent writes structured data (JSON-LD), Open Graph tags, and per-page meta descriptions
- The Accessibility Agent enforces WCAG 2.1 AA requirements: skip links, landmarks, keyboard navigation, color contrast, ARIA
- The Frontend Agent assembles everything into a validated blueprint that drives real code generation

The output is a complete static site with pre-built components and an HTML audit report, all from one Markdown file.

---

## Solution Architecture Quick Start

```bash
# 1. Install
git clone https://github.com/devifyllc/stitchfy.git
cd stitchfy
npm install

# 2. Run one of the three canonical, end-to-end reference solutions
npm run solution -- --input examples/reference/appointment-automation-ai.md --output output/reference/appointment-automation-ai

# 3. Or write your own — see templates/solution/ for starting points
npm run solution -- --input path/to/your-requirements.md
```

Produces, under the output directory (`output/` by default):

| Directory | Contents |
|---|---|
| `context/` | `business-context.json` — the derived `BusinessContext` |
| `blueprints/` | `solution-blueprint.v1.json` — the full validated `SolutionBlueprint` |
| `artifacts/` | Per-capability generated JSON/Markdown, plus any exporter scaffolding |
| `reports/` | `solution-plan.md` — the human-readable capability-selection report |

See `docs/reference/END_TO_END.md` for the full 8-step pipeline walkthrough, `docs/reference/CAPABILITY_MATRIX.md` for real per-scenario capability coverage, and `examples/reference/README.md` for all three canonical scenarios (including the two optional flags, `--codebase`/`--system-id` and `--modernization-export`, used by the legacy-modernization scenario). Run all three plus semantic validation at once with `npm run reference:validate`.

---

## Website Quick Start

```bash
# 1. Install
git clone https://github.com/devifyllc/stitchfy.git
cd stitchfy
npm install

# 2. Describe your business
cp examples/beauty-salon.md input/project.md
# (edit input/project.md with the real business details)

# 3. Generate the blueprint: no API key required
#    The five blueprint agents run deterministically by default.
#    An OpenAI key is optional and only needed if you replace the
#    deterministic logic with the AI calls (see OpenAI Integration below).
npm run stitchfy

# 4a. Generate website: template-based (no API key required)
npm run build:site

# 4b. Generate website: AI-designed via Google Stitch (only STITCH_API_KEY required)
#    No OpenAI key needed for this path.
npm run build:site:stitch

# 5. Audit accessibility and SEO
npm run audit
```

Open `output/static-site/index.html` (template) or `output/stitch-site/index.html` (Stitch) in any browser.

> **Which generator should I use?**
> - **No API key?** Use `npm run build:site` (template-based, always works).
> - **Have a `STITCH_API_KEY`?** Use `npm run build:site:stitch` for AI-generated layouts. No OpenAI key needed.
> - **Have an `OPENAI_API_KEY`?** See the [OpenAI Integration](#openai-integration) section. This enables AI-driven blueprints, not a different site generator.

---

## How It Works

### Stage 1: Blueprint pipeline (shared by both generators)

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
```

### Stage 2: Code generation (choose one)

```
output/blueprint/website-blueprint.v1.json
         │
         ├─── npm run build:site ──────────────────────────────────────────────┐
         │    Template-based generator                                         │
         │    Reads blueprint → writes Next.js app → next build → static export│
         │                                                                     ▼
         │                                                      output/static-site/
         │
         └─── npm run build:site:stitch ──────────────────────────────────────┐
              Google Stitch MCP generator                                      │
              Creates Stitch project → generates one AI screen per page        │
              → fetches HTML → post-processes → SEO Agent review               │
              → A11y Agent review → auto-patches → writes HTML                 │
                                                                               ▼
                                                              output/stitch-site/
                                                    output/reports/stitch-review-report.html

         └─── npm run audit ──────────────────────────────────────────────────┐
              Runs on output/static-site/ or output/stitch-site/              │
                                                                               ▼
                                              output/reports/accessibility-report.html
                                              output/reports/seo-report.html
                                              output/reports/final-report.html
```

---

## Commands

### Solution Architecture

| Command | Description |
|---|---|
| `npm run solution -- --input path/to/file.md` | Run business discovery, capability selection, and every selected capability's architecture generation |
| `npm run solution -- --input path/to/file.md --output path/to/output` | Write output to a specific directory |
| `npm run solution -- --input path/to/file.md --codebase path/to/repo --system-id SYS-001` | Also run read-only repository evidence analysis, mapped to one explicit system |
| `npm run solution -- ... --modernization-export generic-java-replatform` | Also generate a modernization migration recipe (requires `--codebase`/`--system-id`; never runs without this explicit flag) |
| `npm run analyze:codebase -- --path path/to/repo` | Standalone repository inventory — no solution/system mapping required |
| `npm run reference:validate` | Run all three canonical reference solutions and check them against semantic invariants |

### Website Generation

| Command | Description |
|---|---|
| `npm run stitchfy` | Run the full agent pipeline on `input/project.md` |
| `npm run stitchfy -- --input path/to/file.md` | Run pipeline on a specific input file |
| `npm run validate` | Validate the input file and the last generated blueprint |
| `npm run build:site` | Generate Next.js app and export to `output/static-site/` |
| `npm run build:site -- --blueprint path/to/blueprint.json` | Build from a specific blueprint file |
| `npm run build:site:stitch` | Generate AI-designed site via Google Stitch MCP |
| `npm run audit` | Run 14-point HTML accessibility + SEO audit; write HTML reports |

### Both

| Command | Description |
|---|---|
| `npm run typecheck` | TypeScript type-check the framework without emitting |
| `npm run test` | Run the full deterministic test suite |

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
- Neighborhood: Optional (helps local SEO)

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

## Generated Output

### Blueprint

`output/blueprint/website-blueprint.v1.json` is a versioned, Zod-validated JSON document with eight sections:

| Section | Content |
|---|---|
| `project` | Schema version, generation timestamp, source file, framework version |
| `business` | All extracted business data: hours, services, contact, socials, booking |
| `pages` | Page definitions with purpose, sections, CTAs, and component hints |
| `ux` | Color palette, typography, navigation, header/footer config, hero visual spec |
| `seo` | Site title, per-page meta, JSON-LD fields, Open Graph values |
| `accessibility` | WCAG 2.1 AA target, 30-item QA checklist, landmark + ARIA requirements |
| `frontend` | Component map, routes, asset plan, unsupported features list |
| `qa` | Lighthouse targets, known limitations, expected report list |

### Template site (`output/static-site/`)

Generated by `npm run build:site`. A Next.js 14 App Router project built from 12 pre-built accessible React components in `site-template/components/`. Pure HTML/CSS/JS export. No Node.js runtime required.

### Stitch site (`output/stitch-site/`)

Generated by `npm run build:site:stitch`. Each page is AI-designed by Google Stitch using Gemini, then post-processed and reviewed by the framework's SEO and Accessibility agents before being written to disk.

### Reports (`output/reports/`)

| Report | Generator | Contents |
|---|---|---|
| `accessibility-report.html` | `npm run audit` | WCAG 2.1 AA checklist, per-page HTML analysis |
| `seo-report.html` | `npm run audit` | Per-page meta, structured data, Open Graph audit |
| `final-report.html` | `npm run audit` | Pipeline summary, route table, next steps |
| `stitch-review-report.html` | `npm run build:site:stitch` | Per-page: auto-patches applied, manual findings |

---

## Google Stitch Integration

Stitchfy integrates with [Google Stitch](https://stitch.google.com) as an alternative code generator. Stitch uses Gemini to transform text prompts into production HTML/CSS. Stitchfy drives Stitch via its official MCP server, using the blueprint as the structured brief for each page.

### Setup

`STITCH_API_KEY` is the **only** API key required for this flow. The blueprint pipeline (`npm run stitchfy`) runs deterministically with no AI calls, so no OpenAI key is needed.

```bash
# Add to your .env file
STITCH_API_KEY=your-key-here

# Optional: choose the generation model (default: GEMINI_3_1_PRO)
STITCH_MODEL=GEMINI_3_FLASH   # faster; GEMINI_3_1_PRO for higher quality
```

### Stitch pipeline flow

```
blueprint.json
    ↓
Create Stitch project
    ↓
For each page:
  generate_screen_from_text   ← Gemini generates the visual design
    ↓
  get_screen                  ← fetch HTML via downloadUrl
    ↓
  post-processor              ← inject SEO meta, skip link, lang, JSON-LD
    ↓
  stitch-seo.agent            ← fix JSON-LD @type/url/hours, flag dead links
    ↓
  stitch-a11y.agent           ← fix data-alt→alt, nav aria-label, icon aria-hidden
    ↓
  stitch-patcher              ← apply all attribute-level patches
    ↓
  write HTML                  → output/stitch-site/{route}/index.html
    ↓
stitch-review-reporter        → output/reports/stitch-review-report.html
```

### What the review agents do

After Stitch generates HTML, two agents run on each page before it is written to disk:

**SEO Agent (`stitch-seo.agent.ts`)**
- Patches: rewrites JSON-LD with correct `@type` (e.g. `BeautySalon`), absolute URL, and Schema.org-compliant opening hours (24hr format, individual days)
- Flags: missing `og:image`, relative canonical URL, meta description that contains internal blueprint text, title exceeding 60 chars, dead links to routes not in the blueprint

**Accessibility Agent (`stitch-a11y.agent.ts`)**
- Patches: converts `data-alt` → `alt` on all `<img>` elements, adds `aria-label` to unlabelled `<nav>`, adds `aria-label="Open menu"` to the icon-only mobile menu button, replaces `focus:outline-none` with a visible focus ring, adds `role="img"` and `aria-label` to star rating groups, adds `aria-hidden="true"` to decorative material icons
- Flags: footer links without a `<nav>` landmark, any remaining images without alt text, multiple `focus:outline-none` occurrences

All patches are **attribute-level only**: no structural changes, no content edits. The review report shows exactly what was patched automatically and what requires human review before deploying.

### Template vs. Stitch: choosing a generator

| | Template (`build:site`) | Stitch (`build:site:stitch`) |
|---|---|---|
| API key required | No | Yes (STITCH_API_KEY) |
| Visual quality | Consistent, predictable | Higher: AI-generated layouts |
| Control | Full | Partial: Stitch decides visual detail |
| Speed | Fast (no network calls) | Slower (~30–90s per page) |
| Offline use | Yes | No |
| Deterministic output | Yes | No: reruns differ |
| Post-generation review | Via `npm run audit` | Built-in (agents run automatically) |

---

## OpenAI Integration

> **Scope:** OpenAI is only used for the **blueprint pipeline** (the five agents that produce `website-blueprint.v1.json`). It has no role in the template generator or the Google Stitch generator. You do not need an OpenAI key to generate a website via either generator.

All five blueprint agents are structured to support an OpenAI API call but run **fully deterministically** in the default mode: no API key required. The integration point is marked in each agent file:

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

The framework's Zod schema validates the agent output regardless of whether it comes from AI or local logic, so the pipeline stays safe either way.

---

## Industry Support

The UX and SEO agents apply industry-specific defaults for color palette, typography, page strategy, JSON-LD schema type, and gallery content. The Stitch SEO agent uses the same mapping to set the correct `@type` in the generated JSON-LD.

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
--color-primary      /* main brand color: buttons, accents */
--color-secondary    /* background tone */
--color-accent       /* highlight color: hover states, badges */
--color-text         /* body text */
--color-border       /* subtle dividers and card borders */
--font-heading       /* heading typeface (Google Fonts, loaded via <link>) */
--font-body          /* body typeface */
```

The hero background is derived from `ux.heroStyle` (a structured field the UX Agent generates from the palette), so the hero always uses the actual brand gradient rather than defaulting to white.

In the Stitch generator, these same values are embedded directly into each page's generation prompt so Stitch stays constrained to the blueprint's brand.

Gallery images use [picsum.photos](https://picsum.photos) in the template generator. The Stitch generator uses Gemini-generated images via Google's CDN. Replace the URLs before going live.

---

## What This Does NOT Include

### Specification versus runtime (framework-wide)

Every capability in this framework generates a **specification or proposal**, never a running system. None of the following exist anywhere in Stitchfy:

- A live workflow runtime — `WorkflowDefinition` is never executed
- A live integration provider — no HTTP/webhook/JDBC call is ever made to a real external system
- LLM/model execution — `AIAgentDefinition` is a tool/permission/guardrail specification, not a running agent; no model API is called
- Cloud provisioning — `CloudArchitecture` never creates a server, container, or billable resource; no cloud SDK/Terraform/CloudFormation call exists
- Monitoring-provider deployment — `ObservabilityArchitecture` never configures a real Datadog/Grafana/CloudWatch/etc. instance
- Automatic patch or source-code transformation — `ModernizationExportBundle` is a reviewable proposal; no source file is ever written to

See `docs/reference/END_TO_END.md`'s "Artifact taxonomy" for the full architecture/evidence/scaffolding/runtime layering, and `docs/architecture/ROADMAP.md` for the specific deferred tracks (Runtime Integration Providers, AI Agent Runtime, Cloud/Observability Runtime Providers, Reviewed Source Transformation) that would eventually fill the runtime layer.

### Website capability limitations

By design, the website generator produces **informational static websites only**. The following are deliberately out of scope for it:

- Real booking, scheduling, or appointment systems
- Payment flows, e-commerce, or product catalogs
- User accounts, authentication, or session management
- Backend APIs, databases, or server-side logic
- CRM or email marketing integrations
- HIPAA-grade forms or protected health information handling

Booking links point to third-party platforms the business already uses (Vagaro, Mindbody, OpenTable, etc.). Stitchfy generates the page that links out, not the booking engine itself.

### Capability status

| Capability | Architecture Generation | Export / Scaffolding | Runtime |
|---|---|---|---|
| Website | Yes | Yes | Static HTML/CSS/JS output |
| Workflow Automation | Yes | No vendor exporter yet | No |
| Integrations | Yes | `generic-rest-typescript` | No |
| AI Agents | Yes | Deferred (Phase 6.5) | No |
| Security & Governance | Yes | N/A (cross-cutting) | No |
| Observability | Yes | Deferred (Phase 7C) | No |
| Cloud / Deployment | Yes | Deferred (Phase 7C) | No |
| Legacy Modernization | Yes | `generic-java-replatform` | No source mutation (proposals only) |

---

## Deployment

Both `output/static-site/` and `output/stitch-site/` are pure static HTML/CSS/JS with no Node.js runtime required. Deploy either folder anywhere:

```bash
# AWS S3 + CloudFront
aws s3 sync output/stitch-site/ s3://your-bucket --delete

# Netlify
netlify deploy --prod --dir output/stitch-site

# Vercel
vercel --prebuilt output/stitch-site

# GitHub Pages: copy contents into your gh-pages branch
```

---

## Architecture History

Stitchfy began as a website-only generator and evolved into the broader solution-engineering framework described above: website generation became one capability among eight, selected via a capability registry rather than hardcoded into the pipeline. The website pipeline documented earlier in this README is unchanged and keeps working exactly as described. See [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) for the full design rationale and [docs/architecture/ROADMAP.md](docs/architecture/ROADMAP.md) for the phase-by-phase history and what remains deferred.

### Codebase analysis (advanced)

Legacy Modernization can optionally be enriched with real, read-only, local
repository evidence (Maven/npm/Java) — see
[docs/architecture/CODEBASE_ANALYSIS.md](docs/architecture/CODEBASE_ANALYSIS.md)
for the full trust boundary and analyzer model, and
[docs/reference/LEGACY_JAVA_MODERNIZATION.md](docs/reference/LEGACY_JAVA_MODERNIZATION.md)
for a complete worked example including the `generic-java-replatform`
export adapter.

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
│   │   ├── orchestrator.ts       ← Blueprint pipeline driver (9 steps)
│   │   ├── agent-runner.ts       ← Runs each blueprint agent, handles errors
│   │   └── workflow-state.ts     ← Shared state passed between agents
│   ├── agents/
│   │   ├── intake.agent.ts       ← Blueprint stage 1: business data extraction
│   │   ├── ux.agent.ts           ← Blueprint stage 2: UX strategy + hero spec
│   │   ├── seo.agent.ts          ← Blueprint stage 3: meta tags + structured data
│   │   ├── accessibility.agent.ts← Blueprint stage 4: WCAG 2.1 AA checklist
│   │   ├── frontend.agent.ts     ← Blueprint stage 5: component map + routes
│   │   ├── stitch-seo.agent.ts   ← Stitch review: SEO audit + JSON-LD patch
│   │   ├── stitch-a11y.agent.ts  ← Stitch review: A11y audit + attribute patches
│   │   └── stitch-html-review.types.ts ← Shared types for review agents
│   ├── core/
│   │   ├── site-generator.ts     ← Blueprint → Next.js source code (template)
│   │   ├── stitch-client.ts      ← Google Stitch MCP JSON-RPC 2.0 client
│   │   ├── stitch-generator.ts   ← Stitch pipeline orchestrator
│   │   ├── stitch-prompt-builder.ts ← Blueprint → per-page Stitch prompt
│   │   ├── stitch-post-processor.ts ← Injects SEO meta + base a11y into Stitch HTML
│   │   ├── stitch-patcher.ts     ← Applies agent patches to HTML string
│   │   ├── stitch-review-reporter.ts ← Generates stitch-review-report.html
│   │   ├── report-generator.ts   ← Static HTML audit reports (template generator)
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
│   ├── build-site.ts             ← Entry point: npm run build:site (template)
│   ├── build-site-stitch.ts      ← Entry point: npm run build:site:stitch
│   ├── audit-site.ts             ← Entry point: npm run audit
│   └── validate.ts               ← Entry point: npm run validate
│
├── output/                       ← All generated artifacts (gitignored)
│   ├── blueprint/
│   ├── generated-site/           ← Next.js source (template generator)
│   ├── static-site/              ← Deployable HTML (template generator)
│   ├── stitch-site/              ← Deployable HTML (Stitch generator)
│   └── reports/
│       ├── accessibility-report.html
│       ├── seo-report.html
│       ├── final-report.html
│       └── stitch-review-report.html
│
├── examples/
├── assets/
├── .env.example                  ← OPENAI_API_KEY + STITCH_API_KEY placeholders
├── LICENSE
├── NOTICE
└── package.json
```

The tree above is the original website-pipeline layout and is still fully accurate for it. The Solution Architecture pipeline (see "Architecture at a glance" above) added, additively, alongside it:

```
stitchfy/
├── framework/
│   ├── discovery/            ← Business Discovery extractors (one per Discovery entity)
│   ├── planning/              ← Solution Planning (capability assessment, solution plan, risk)
│   ├── capabilities/          ← One directory per capability (workflow-automation, integrations,
│   │                            ai-agents, security-governance, observability, cloud, modernization),
│   │                            each with generators/, validators/, schemas/, and (where one exists)
│   │                            an exporters/ subdirectory
│   ├── analysis/codebase/     ← Phase 8.5A read-only repository evidence analyzer
│   └── orchestrator/
│       └── solution-orchestrator.ts   ← Drives the whole Solution Architecture pipeline
├── scripts/
│   ├── run-solution.ts        ← Entry point: npm run solution
│   ├── analyze-codebase.ts    ← Entry point: npm run analyze:codebase
│   └── reference-validate.ts  ← Entry point: npm run reference:validate
├── examples/
│   ├── solution/               ← Focused, single-capability worked examples
│   └── reference/               ← Three canonical, end-to-end reference solutions
├── templates/solution/         ← Reusable starting-point Markdown templates
├── docs/
│   ├── architecture/           ← Design rationale + docs/architecture/ROADMAP.md
│   └── reference/               ← End-to-end walkthrough + capability matrix
└── tests/                      ← node:test suite, including tests/reference/ (test infra only)
```

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Blueprint agents live in `framework/agents/`: one file per stage, following the `AgentConfig` interface in `framework/orchestrator/agent-runner.ts`
4. Stitch review agents live in `framework/agents/stitch-*.agent.ts`: implement `reviewSEO` / `reviewA11y` returning `HtmlReviewResult` from `stitch-html-review.types.ts`
5. Add or update the Zod schema in `framework/schemas/blueprint.schema.ts` for any new blueprint fields
6. Keep TypeScript types in `framework/schemas/blueprint.types.ts` in sync with the Zod schema
7. Run `npm run typecheck` before submitting a pull request

When adding a new component to `site-template/components/`, the site generator picks it up automatically. No additional copy step needed.

---

## License

Apache License 2.0: see [LICENSE](LICENSE) and [NOTICE](NOTICE) for full terms.

Copyright 2024–2025 Devify LLC

---

*Stitchfy v2.1.0, built by [Devify LLC](https://github.com/devifyllc)*
