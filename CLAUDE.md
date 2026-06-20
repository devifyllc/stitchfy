# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run stitchfy                              # Run full agent pipeline on input/project.md
npm run stitchfy -- --input path/to/file.md  # Run pipeline on a specific input file
npm run build:site                            # Generate Next.js app + export to output/static-site/
npm run build:site -- --blueprint path/to/blueprint.json
npm run audit                                 # HTML accessibility + SEO audit → output/reports/
npm run validate                              # Validate input file and last generated blueprint
npm run typecheck                             # TypeScript check without emitting
```

There is no test suite. `npm run typecheck` is the primary correctness gate before submitting changes.

## Architecture

Stitchfy is a CLI framework: one Markdown file in → one static website out. There is no web server, no database, and no runtime.

### Pipeline flow

```
input/project.md
  → markdown-parser.ts       (ParsedMarkdown)
  → orchestrator.ts          (drives 5 agents sequentially via agent-runner.ts)
  → [intake → ux → seo → accessibility → frontend agents]
  → blueprint.schema.ts      (Zod validation)
  → blueprint-writer.ts      (output/blueprint/website-blueprint.v1.json)
  → site-generator.ts        (output/generated-site/ — full Next.js 14 app)
  → Next.js export           (output/static-site/ — deployable HTML/CSS/JS)
```

### Key structural rules

- **`framework/schemas/blueprint.types.ts`** is the single source of truth for all TypeScript interfaces. The Zod schema in `framework/schemas/blueprint.schema.ts` must stay in sync with it.
- Each agent in `framework/agents/` receives the `WorkflowState` and returns a partial `WebsiteBlueprint` slice. The orchestrator merges slices via spread: `state.blueprint = { ...state.blueprint, ...output }`.
- **`site-template/`** is the template layer. `site-generator.ts` copies these components into every generated site and injects brand data. Components added to `site-template/components/` are picked up automatically.
- All five agents contain a commented-out OpenAI API call block marked `// OPENAI INTEGRATION POINT:`. In default mode they run deterministically with no API key. The Zod validation runs regardless of mode.

### Adding a new agent

1. Create `framework/agents/myagent.agent.ts` implementing the `AgentConfig` interface from `framework/orchestrator/agent-runner.ts`
2. Add the agent to the `PIPELINE` array in `framework/orchestrator/orchestrator.ts`
3. Add any new blueprint fields to `framework/schemas/blueprint.types.ts` first, then update `framework/schemas/blueprint.schema.ts`

### Output directories (all gitignored)

| Path | Contents |
|---|---|
| `output/blueprint/` | `website-blueprint.v1.json` — validated spec |
| `output/generated-site/` | Next.js 14 App Router source |
| `output/static-site/` | Pure HTML/CSS/JS, deploy this folder |
| `output/reports/` | `accessibility-report.html`, `seo-report.html`, `final-report.html` |

### OpenAI integration

Add `OPENAI_API_KEY=sk-...` to a `.env` file, then replace the deterministic logic in each agent with the commented API call. Default model is `gpt-4o` (via `process.env.OPENAI_MODEL`).

### Industry-aware defaults

The UX and SEO agents key off industry keywords (`beauty`, `wellness`, `medical`, `restaurant`) to choose Schema.org type, color palette style, and gallery seeds. Unrecognized industries fall back to `LocalBusiness` / neutral blue-grey.
