# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run stitchfy                              # Run full agent pipeline on input/project.md
npm run stitchfy -- --input path/to/file.md  # Run pipeline on a specific input file
npm run build:site                            # Template generator → output/static-site/
npm run build:site -- --blueprint path/to/blueprint.json
npm run build:site:stitch                     # Stitch MCP generator → output/stitch-site/
npm run audit                                 # HTML accessibility + SEO audit → output/reports/
npm run validate                              # Validate input file and last generated blueprint
npm run typecheck                             # TypeScript check without emitting
```

There is no test suite. `npm run typecheck` is the primary correctness gate before submitting changes.

`build:site:stitch` requires `STITCH_API_KEY` in `.env`. Optional: `STITCH_MODEL` (`GEMINI_3_1_PRO` default, or `GEMINI_3_FLASH`).

## Architecture

Stitchfy is a CLI framework: one Markdown file in → one static website out. There is no web server, no database, and no runtime.

### Pipeline flow — blueprint (shared)

```
input/project.md
  → markdown-parser.ts       (ParsedMarkdown)
  → orchestrator.ts          (drives 5 agents sequentially via agent-runner.ts)
  → [intake → ux → seo → accessibility → frontend agents]
  → blueprint.schema.ts      (Zod validation)
  → blueprint-writer.ts      (output/blueprint/website-blueprint.v1.json)
```

### Pipeline flow — template generator (`build:site`)

```
website-blueprint.v1.json
  → site-generator.ts        (output/generated-site/ — full Next.js 14 app)
  → Next.js export           (output/static-site/ — deployable HTML/CSS/JS)
```

### Pipeline flow — Stitch generator (`build:site:stitch`)

```
website-blueprint.v1.json
  → stitch-client.ts         (create_project → generate_screen_from_text per page → get_screen)
  → stitch-post-processor.ts (inject SEO meta, skip link, lang, JSON-LD)
  → stitch-seo.agent.ts      (review SEO → patches + findings)
  → stitch-a11y.agent.ts     (review A11y → patches + findings)
  → stitch-patcher.ts        (apply all attribute-level patches)
  → output/stitch-site/      (deployable HTML/CSS/JS)
  → stitch-review-reporter.ts → output/reports/stitch-review-report.html
```

### Key structural rules

- **`framework/schemas/blueprint.types.ts`** is the single source of truth for all TypeScript interfaces. The Zod schema in `framework/schemas/blueprint.schema.ts` must stay in sync with it.
- Each blueprint agent in `framework/agents/` receives the `WorkflowState` and returns a partial `WebsiteBlueprint` slice. The orchestrator merges slices via spread: `state.blueprint = { ...state.blueprint, ...output }`.
- **`site-template/`** is the template layer. `site-generator.ts` copies these components into every generated site and injects brand data. Components added to `site-template/components/` are picked up automatically.
- All five blueprint agents contain a commented-out OpenAI API call block marked `// OPENAI INTEGRATION POINT:`. In default mode they run deterministically with no API key. The Zod validation runs regardless of mode.
- **Stitch review agents** (`stitch-seo.agent.ts`, `stitch-a11y.agent.ts`) implement a different interface than blueprint agents. They receive `(html, page, blueprint)` and return `HtmlReviewResult` from `stitch-html-review.types.ts`. Patches must be **attribute-level only** — no structural DOM changes.
- **`stitch-client.ts`** uses JSON-RPC 2.0 over HTTP POST to `https://stitch.googleapis.com/mcp`. Auth header: `X-Goog-Api-Key`. Available tools verified via `tools/list`: `create_project`, `generate_screen_from_text`, `get_screen`, `list_projects`, `list_screens`, `edit_screens`, `generate_variants`, design system tools. `build_site` and `get_screen_code` are **not** on the official endpoint.

### Adding a new blueprint agent

1. Create `framework/agents/myagent.agent.ts` implementing the `AgentConfig` interface from `framework/orchestrator/agent-runner.ts`
2. Add the agent to the `PIPELINE` array in `framework/orchestrator/orchestrator.ts`
3. Add any new blueprint fields to `framework/schemas/blueprint.types.ts` first, then update `framework/schemas/blueprint.schema.ts`

### Adding a new Stitch review agent

1. Create `framework/agents/stitch-mycheck.agent.ts` exporting a function `(html, page, blueprint) → HtmlReviewResult`
2. Import and call it in `framework/core/stitch-generator.ts` after `reviewA11y`, merge its patches and findings

### Output directories (all gitignored)

| Path | Contents |
|---|---|
| `output/blueprint/` | `website-blueprint.v1.json` — validated spec |
| `output/generated-site/` | Next.js 14 App Router source (template) |
| `output/static-site/` | Pure HTML/CSS/JS — deploy this (template) |
| `output/stitch-site/` | Pure HTML/CSS/JS — deploy this (Stitch) |
| `output/reports/` | Audit reports + `stitch-review-report.html` |

### OpenAI integration

Add `OPENAI_API_KEY=sk-...` to a `.env` file, then replace the deterministic logic in each agent with the commented API call. Default model is `gpt-4o` (via `process.env.OPENAI_MODEL`).

### Industry-aware defaults

The UX and SEO agents key off industry keywords (`beauty`, `wellness`, `medical`, `restaurant`) to choose Schema.org type, color palette style, and gallery seeds. Unrecognized industries fall back to `LocalBusiness` / neutral blue-grey.
