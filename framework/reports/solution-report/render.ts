/**
 * Renders SolutionReportProjection → a single self-contained HTML string.
 *
 * Design: every dynamic value is escaped once, at render time, via
 * html-escape.ts (see "Security" in the task brief). Interactivity (tabs,
 * search, filters, expandable detail rows) is plain DOM show/hide over
 * server-rendered markup — the client script never uses innerHTML on
 * blueprint-derived text, so there is no second place XSS could sneak in.
 * No external network resource is loaded (no CDN font/script/stylesheet) —
 * the file works fully offline (task: "portable... open directly in a
 * browser").
 */

import type {
  ArtifactGroup,
  BacklogItem,
  CapabilityCard,
  EntityIndexEntry,
  ReportEvidenceRef,
  SolutionReportProjection,
} from "./types.js";
import { escHtml, slugify } from "./html-escape.js";
import { STITCHFY_VERSION } from "../../core/version.js";

// ─── Small shared helpers ───────────────────────────────────────────────────

type PillTone = "positive" | "negative" | "warning" | "neutral" | "info";

const POSITIVE = new Set(["recommended", "selected", "executed", "complete", "ready", "defined", "confirmed", "retain", "explicit", "true"]);
const NEGATIVE = new Set(["not-recommended", "not-selected", "blocked", "failed", "high", "unresolved", "false"]);
const WARNING = new Set(["needs-review", "needs-information", "candidate", "draft", "proposed", "pending", "medium", "deferred", "review"]);

function pillTone(rawStatus: string | undefined): PillTone {
  if (!rawStatus) return "neutral";
  const v = rawStatus.toLowerCase();
  if (POSITIVE.has(v)) return "positive";
  if (NEGATIVE.has(v)) return "negative";
  if (WARNING.has(v)) return "warning";
  return "neutral";
}

function pill(text: string | undefined, tone?: PillTone): string {
  if (!text) return "";
  const t = tone ?? pillTone(text);
  return `<span class="pill pill-${t}">${escHtml(text)}</span>`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return escHtml(iso);
  return d.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

function dash(value: string | undefined | null): string {
  return value && value.length > 0 ? escHtml(value) : `<span class="dash">—</span>`;
}

function anchorId(id: string): string {
  return `entity-${slugify(id)}`;
}

/** Renders one id as a chip — a real in-page link when the id has a rendered anchor, otherwise plain text with a resolved-label tooltip. Never a dead link. */
function idChip(id: string, entityIndex: Record<string, EntityIndexEntry>, anchorable: Set<string>): string {
  const label = entityIndex[id]?.label;
  const title = label && label !== id ? ` title="${escHtml(label)}"` : "";
  if (anchorable.has(id)) {
    return `<a class="chip" href="#${anchorId(id)}"${title}><code>${escHtml(id)}</code></a>`;
  }
  return `<span class="chip chip-static"${title}><code>${escHtml(id)}</code></span>`;
}

function idChips(ids: string[] | undefined, entityIndex: Record<string, EntityIndexEntry>, anchorable: Set<string>): string {
  if (!ids || ids.length === 0) return "";
  return `<span class="chip-list">${ids.map((id) => idChip(id, entityIndex, anchorable)).join(" ")}</span>`;
}

function evidenceList(refs: ReportEvidenceRef[] | undefined): string {
  if (!refs || refs.length === 0) return "";
  const items = refs
    .map((r) => {
      if (r.kind === "codebase") {
        const loc = r.line ? `${r.filePath}:${r.line}` : r.filePath;
        return `<li class="evidence-item"><span class="evidence-kind">codebase</span> <code>${escHtml(loc)}</code>${
          r.symbol ? ` — symbol <code>${escHtml(r.symbol)}</code>` : ""
        } <span class="evidence-type">(${escHtml(r.entityType)})</span></li>`;
      }
      return `<li class="evidence-item"><span class="evidence-kind">${escHtml(r.kind)}</span> <code>${escHtml(r.entityId)}</code>${
        r.description ? ` — ${escHtml(r.description)}` : ""
      } <span class="evidence-type">(${escHtml(r.entityType)})</span></li>`;
    })
    .join("");
  return `<ul class="evidence-list">${items}</ul>`;
}

// ─── Header / summary ───────────────────────────────────────────────────────

function renderHeader(projection: SolutionReportProjection): string {
  const { project } = projection;
  return `
<header class="page-header">
  <div class="ph-title-row">
    <h1>${escHtml(project.businessName)}</h1>
    ${project.industry ? `<span class="pill pill-info">${escHtml(project.industry)}</span>` : ""}
  </div>
  <dl class="meta-grid">
    <div><dt>Source</dt><dd><code>${escHtml(project.sourceFile)}</code></dd></div>
    <div><dt>Framework</dt><dd>Stitchfy v${escHtml(project.frameworkVersion)}</dd></div>
    <div><dt>Blueprint schema</dt><dd>v${escHtml(project.schemaVersion)}</dd></div>
    <div><dt>Generated</dt><dd>${fmtDate(project.generatedAt)}</dd></div>
  </dl>
  ${project.goalSummary ? `<p class="goal-summary">${escHtml(project.goalSummary)}</p>` : ""}
</header>`;
}

function renderSummary(projection: SolutionReportProjection): string {
  if (projection.summary.length === 0) return "";
  const tiles = projection.summary
    .map((m) => `<li class="stat-tile"><span class="stat-value">${m.value}</span><span class="stat-label">${escHtml(m.label)}</span></li>`)
    .join("");
  return `
<section class="summary" aria-labelledby="summary-heading">
  <h2 id="summary-heading">Executive Summary</h2>
  <ul class="stat-tiles">${tiles}</ul>
</section>`;
}

// ─── Capabilities view ──────────────────────────────────────────────────────

function renderCapabilityCard(card: CapabilityCard, entityIndex: Record<string, EntityIndexEntry>, anchorable: Set<string>): string {
  const headPills = [
    card.assessmentStatus ? pill(card.assessmentStatus) : "",
    card.assessmentConfidence ? pill(`${card.assessmentConfidence} confidence`, "neutral") : "",
    pill(card.executionStatus, card.executionStatus === "executed" ? "positive" : card.executionStatus === "failed" ? "negative" : "neutral"),
  ]
    .filter(Boolean)
    .join(" ");

  const metricChips = card.metrics.map((m) => `<span class="chip-metric">${m.value} ${escHtml(m.label)}</span>`).join(" ");

  const reasons =
    card.reasons.length > 0
      ? `<div class="card-block"><h4>Why</h4><ul class="reason-list">${card.reasons
          .map((r) => `<li>${escHtml(r.description)}${evidenceList(r.evidenceRefs)}</li>`)
          .join("")}</ul></div>`
      : "";

  const relatedRows: string[] = [];
  const addRelated = (label: string, ids: string[]) => {
    if (ids.length > 0) relatedRows.push(`<div class="related-row"><span class="related-label">${escHtml(label)}</span>${idChips(ids, entityIndex, anchorable)}</div>`);
  };
  addRelated("Systems", card.relatedSystemIds);
  addRelated("Requirements", card.relatedRequirementIds);
  addRelated("Outcomes", card.relatedOutcomeIds);
  addRelated("Processes", card.relatedProcessIds);
  addRelated("Constraints", card.relatedConstraintIds);
  addRelated("Blocking gaps", card.blockingGapIds);

  const implementedNote =
    card.implemented === undefined
      ? ""
      : `<p class="implemented-note"><strong>Generated &amp; validated:</strong> ${card.implemented ? "Yes" : "No"} — indicates Stitchfy produced and validated an architecture specification for this capability, not that it was deployed, executed, or production-verified.</p>`;

  const statusReasons =
    card.statusReasons && card.statusReasons.length > 0
      ? `<div class="card-block"><h4>Status notes</h4><ul>${card.statusReasons.map((s) => `<li>${escHtml(s)}</li>`).join("")}</ul></div>`
      : "";

  const artifacts =
    card.artifactPaths.length > 0
      ? `<div class="card-block"><h4>Artifacts</h4><ul class="artifact-list">${card.artifactPaths
          .map((p) => `<li><code>${escHtml(p)}</code></li>`)
          .join("")}</ul></div>`
      : "";

  const errorNote = card.error ? `<p class="error-note">${escHtml(card.error)}</p>` : "";

  return `
<details class="capability-card" id="capability-${escHtml(slugify(card.capabilityId))}">
  <summary>
    <div class="cc-summary-main">
      <span class="cc-name">${escHtml(card.capabilityName)}</span>
      <span class="cc-pills">${headPills}</span>
    </div>
    ${card.summary ? `<p class="cc-oneliner">${escHtml(card.summary)}</p>` : ""}
    ${metricChips ? `<div class="cc-metrics">${metricChips}</div>` : ""}
  </summary>
  <div class="cc-body">
    ${errorNote}
    ${card.architectureStatus ? `<p class="architecture-status">Architecture status: ${pill(card.architectureStatus)}</p>` : ""}
    ${implementedNote}
    ${reasons}
    ${relatedRows.length > 0 ? `<div class="card-block"><h4>Related</h4>${relatedRows.join("")}</div>` : ""}
    ${statusReasons}
    ${artifacts}
  </div>
</details>`;
}

function renderCapabilitiesPanel(projection: SolutionReportProjection, anchorable: Set<string>): string {
  if (projection.capabilities.length === 0) {
    return `<p class="empty-note">No capabilities were assessed for this blueprint.</p>`;
  }
  const cards = projection.capabilities
    .map((c) => renderCapabilityCard(c, projection.entityIndex, anchorable))
    .join("\n");
  return `<div class="capability-grid">${cards}</div>`;
}

// ─── Backlog view ───────────────────────────────────────────────────────────

// "Explicitness" replaces the task's suggested "Confidence" column: no backlog item type
// carries a real AssessmentConfidence value (that's a Capabilities-view-only concept), and
// labeling a copied-verbatim explicit/derived/candidate value "Confidence" would conflate
// two distinct concepts the task explicitly requires stay separate.
const BACKLOG_COLUMNS = ["ID", "Item", "Type", "Capability", "Category", "Priority", "Status", "Explicitness"];

function backlogSearchText(item: BacklogItem): string {
  return [item.id, item.title, item.description, item.type, item.category, ...item.capabilityIds]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function renderCapabilityCell(capabilityIds: string[], capabilityCards: Map<string, CapabilityCard>): string {
  if (capabilityIds.length === 0) return `<span class="dash">—</span>`;
  return capabilityIds
    .map((id) => {
      const card = capabilityCards.get(id);
      const label = card?.capabilityName ?? id;
      return card ? `<a href="#capability-${escHtml(slugify(id))}">${escHtml(label)}</a>` : escHtml(label);
    })
    .join(", ");
}

function renderBacklogDetailRow(item: BacklogItem, entityIndex: Record<string, EntityIndexEntry>, anchorable: Set<string>, capabilityCards: Map<string, CapabilityCard>): string {
  const fields: string[] = [];
  const addField = (label: string, html: string) => {
    if (html) fields.push(`<div class="detail-field"><dt>${escHtml(label)}</dt><dd>${html}</dd></div>`);
  };

  addField("Description", item.description ? escHtml(item.description) : "");
  addField("Capability", capabilityCards.size > 0 ? renderCapabilityCell(item.capabilityIds, capabilityCards) : "");
  addField("Category", item.category ? escHtml(item.category) : "");
  addField("Priority", item.priority ? escHtml(item.priority) : "");
  addField("Impact", item.impact ? escHtml(item.impact) : "");
  addField("Likelihood", item.likelihood ? escHtml(item.likelihood) : "");
  addField("Status", item.status ? escHtml(item.status) : "");
  addField("Explicitness", item.explicitness ? escHtml(item.explicitness) : "");
  addField("Blocking", item.blocking === undefined ? "" : item.blocking ? "Yes" : "No");
  if (item.rationale.length > 0) addField("Rationale", `<ul>${item.rationale.map((r) => `<li>${escHtml(r)}</li>`).join("")}</ul>`);
  addField("Related systems", idChips(item.relatedSystemIds, entityIndex, anchorable));
  addField("Related requirements", idChips(item.relatedRequirementIds, entityIndex, anchorable));
  addField("Prerequisites", idChips(item.prerequisiteIds, entityIndex, anchorable));
  addField("Preservation requirements", idChips(item.preservationRequirementIds, entityIndex, anchorable));
  addField("Validation requirements", idChips(item.validationRequirementIds, entityIndex, anchorable));
  addField("Related risks", idChips(item.riskIds, entityIndex, anchorable));
  addField("Information gaps", idChips(item.informationGapIds, entityIndex, anchorable));
  if (item.architectureRefs.length > 0) {
    addField(
      "Architecture references",
      idChips(item.architectureRefs.map((r) => r.entityId), entityIndex, anchorable)
    );
  }
  if (item.evidenceRefs.length > 0) addField("Evidence", evidenceList(item.evidenceRefs));

  return `<tr class="detail-row" id="detail-${anchorId(item.id)}" hidden>
    <td colspan="${BACKLOG_COLUMNS.length + 1}">
      <dl class="detail-grid">${fields.join("")}</dl>
    </td>
  </tr>`;
}

function renderBacklogRow(item: BacklogItem, entityIndex: Record<string, EntityIndexEntry>, anchorable: Set<string>, capabilityCards: Map<string, CapabilityCard>): string {
  const detailId = `detail-${anchorId(item.id)}`;
  const capabilityAttr = escHtml(item.capabilityIds.join(" "));
  return `<tr id="${anchorId(item.id)}"
      data-type="${escHtml(item.type)}"
      data-capability="${capabilityAttr}"
      data-status="${escHtml(item.status ?? "")}"
      data-priority="${escHtml(item.priority ?? "")}"
      data-search="${escHtml(backlogSearchText(item))}">
    <td><code>${escHtml(item.id)}</code></td>
    <td>
      <button type="button" class="row-toggle" aria-expanded="false" aria-controls="${detailId}">
        ${escHtml(item.title)}
      </button>
    </td>
    <td>${escHtml(item.type)}</td>
    <td>${renderCapabilityCell(item.capabilityIds, capabilityCards)}</td>
    <td>${dash(item.category)}</td>
    <td>${item.priority ? escHtml(item.priority) : item.impact ? `impact: ${escHtml(item.impact)}` : `<span class="dash">—</span>`}</td>
    <td>${item.status ? pill(item.status) : `<span class="dash">—</span>`}</td>
    <td>${item.explicitness ? escHtml(item.explicitness) : `<span class="dash">—</span>`}</td>
  </tr>
${renderBacklogDetailRow(item, entityIndex, anchorable, capabilityCards)}`;
}

function renderBacklogPanel(projection: SolutionReportProjection, anchorable: Set<string>): string {
  const { backlog, entityIndex, capabilities } = projection;
  const capabilityCards = new Map(capabilities.map((c) => [c.capabilityId, c] as const));

  if (backlog.length === 0) {
    return `<p class="empty-note">No implementation-backlog items were derived from this blueprint.</p>`;
  }

  const distinct = (values: (string | undefined)[]) =>
    Array.from(new Set(values.filter((v): v is string => Boolean(v)))).sort();

  const types = distinct(backlog.map((i) => i.type));
  const capabilityIds = distinct(backlog.flatMap((i) => i.capabilityIds));
  const statuses = distinct(backlog.map((i) => i.status));
  const priorities = distinct(backlog.map((i) => i.priority));

  const option = (value: string, label?: string) => `<option value="${escHtml(value)}">${escHtml(label ?? value)}</option>`;

  const capabilityOptions = capabilityIds
    .map((id) => option(id, capabilityCards.get(id)?.capabilityName ?? id))
    .join("");

  const rows = backlog.map((item) => renderBacklogRow(item, entityIndex, anchorable, capabilityCards)).join("\n");

  return `
<div class="backlog-toolbar">
  <input type="search" id="backlog-search" placeholder="Search backlog…" aria-label="Search backlog">
  <select id="filter-capability" aria-label="Filter by capability"><option value="">All capabilities</option>${capabilityOptions}</select>
  <select id="filter-type" aria-label="Filter by type"><option value="">All types</option>${types.map((t) => option(t)).join("")}</select>
  <select id="filter-status" aria-label="Filter by status"><option value="">All statuses</option>${statuses.map((s) => option(s)).join("")}</select>
  <select id="filter-priority" aria-label="Filter by priority"><option value="">All priorities</option>${priorities.map((p) => option(p)).join("")}</select>
  <span id="result-count" role="status" aria-live="polite"></span>
</div>
<div class="table-wrap">
  <table id="backlog-table">
    <caption class="visually-hidden">Implementation backlog</caption>
    <thead><tr>${BACKLOG_COLUMNS.map((c) => `<th scope="col">${c}</th>`).join("")}<th scope="col"><span class="visually-hidden">Details</span></th></tr></thead>
    <tbody>
${rows}
    </tbody>
  </table>
</div>`;
}

// ─── Artifacts / systems appendix ───────────────────────────────────────────

function renderArtifacts(groups: ArtifactGroup[]): string {
  if (groups.length === 0) return "";
  const blocks = groups
    .map(
      (g) => `<div class="artifact-group">
        <h3>${escHtml(g.capabilityName)}</h3>
        <ul class="artifact-list">${g.paths.map((p) => `<li><code>${escHtml(p)}</code></li>`).join("")}</ul>
      </div>`
    )
    .join("");
  return `
<section class="appendix" aria-labelledby="artifacts-heading">
  <h2 id="artifacts-heading">Generated Artifacts</h2>
  <div class="artifact-groups">${blocks}</div>
</section>`;
}

function renderSystemsAppendix(projection: SolutionReportProjection): { html: string; anchorIds: string[] } {
  const entries = Object.entries(projection.entityIndex).filter(([, e]) => e.kind === "System");
  if (entries.length === 0) return { html: "", anchorIds: [] };
  const rows = entries
    .map(([id, e]) => `<tr id="${anchorId(id)}"><td><code>${escHtml(id)}</code></td><td>${escHtml(e.label)}</td></tr>`)
    .join("");
  return {
    html: `
<details class="appendix">
  <summary><h2 style="display:inline">Systems Referenced</h2></summary>
  <div class="table-wrap">
    <table>
      <thead><tr><th scope="col">ID</th><th scope="col">Name</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
</details>`,
    anchorIds: entries.map(([id]) => id),
  };
}

// ─── Client script (no innerHTML on blueprint-derived text anywhere) ───────

const CLIENT_SCRIPT = `
(function () {
  "use strict";

  // Tabs
  var tabs = document.querySelectorAll('[role="tab"]');
  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      tabs.forEach(function (t) {
        t.setAttribute("aria-selected", "false");
        document.getElementById(t.getAttribute("aria-controls")).hidden = true;
      });
      tab.setAttribute("aria-selected", "true");
      document.getElementById(tab.getAttribute("aria-controls")).hidden = false;
    });
  });

  // Expandable backlog rows
  document.querySelectorAll(".row-toggle").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var target = document.getElementById(btn.getAttribute("aria-controls"));
      if (!target) return;
      var expanded = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", String(!expanded));
      target.hidden = expanded;
    });
  });

  // Backlog filters
  var table = document.getElementById("backlog-table");
  if (table) {
    var searchInput = document.getElementById("backlog-search");
    var capabilityFilter = document.getElementById("filter-capability");
    var typeFilter = document.getElementById("filter-type");
    var statusFilter = document.getElementById("filter-status");
    var priorityFilter = document.getElementById("filter-priority");
    var resultCount = document.getElementById("result-count");
    var rows = Array.prototype.slice.call(table.querySelectorAll("tbody > tr:not(.detail-row)"));

    function applyFilters() {
      var q = (searchInput.value || "").toLowerCase().trim();
      var cap = capabilityFilter.value;
      var type = typeFilter.value;
      var status = statusFilter.value;
      var priority = priorityFilter.value;
      var visible = 0;

      rows.forEach(function (row) {
        var caps = (row.dataset.capability || "").split(" ");
        var matches =
          (!q || row.dataset.search.indexOf(q) !== -1) &&
          (!cap || caps.indexOf(cap) !== -1) &&
          (!type || row.dataset.type === type) &&
          (!status || row.dataset.status === status) &&
          (!priority || row.dataset.priority === priority);

        row.hidden = !matches;
        var detail = document.getElementById(row.id.replace(/^entity-/, "detail-entity-"));
        if (detail && !matches) detail.hidden = true;
        if (matches) visible++;
      });

      resultCount.textContent = visible + " of " + rows.length + " item" + (rows.length === 1 ? "" : "s");
    }

    [searchInput, capabilityFilter, typeFilter, statusFilter, priorityFilter].forEach(function (el) {
      el.addEventListener("input", applyFilters);
      el.addEventListener("change", applyFilters);
    });
    applyFilters();
  }
})();
`;

// ─── CSS ────────────────────────────────────────────────────────────────────

const CSS = `
:root {
  --bg: #f5f6f8;
  --surface: #ffffff;
  --surface-alt: #eef0f3;
  --border: #dde1e7;
  --text: #14181f;
  --text-muted: #5b6472;
  --header-bg: #14181f;
  --header-text: #e8eaf0;
  --accent: #2f6fed;
  --mono: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace;
  --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  --positive-bg: #e3f3e8; --positive-text: #1e7e42;
  --negative-bg: #fbe7e4; --negative-text: #a13a2d;
  --warning-bg: #fdf2d6; --warning-text: #8a5a00;
  --neutral-bg: #eceef1; --neutral-text: #4b5563;
  --info-bg: #e6edfc; --info-text: #2454b0;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #14171c; --surface: #1b1f26; --surface-alt: #222630; --border: #2c313a;
    --text: #e6e8eb; --text-muted: #98a1ad; --header-bg: #0c0e12; --header-text: #e6e8eb;
    --positive-bg: #123322; --positive-text: #6fd897;
    --negative-bg: #3a1f1c; --negative-text: #f0958a;
    --warning-bg: #3a2f10; --warning-text: #e8c163;
    --neutral-bg: #262b33; --neutral-text: #b3bac4;
    --info-bg: #1a2a4a; --info-text: #9db8f0;
  }
}
* { box-sizing: border-box; }
html { color-scheme: light dark; }
body { margin: 0; font-family: var(--sans); background: var(--bg); color: var(--text); font-size: 14px; line-height: 1.5; }
code, .chip code { font-family: var(--mono); font-size: 0.85em; }
a { color: var(--accent); }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.dash { color: var(--text-muted); }

.page-header { background: var(--header-bg); color: var(--header-text); padding: 1.5rem 2rem; }
.ph-title-row { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
.page-header h1 { margin: 0; font-size: 1.5rem; }
.meta-grid { display: flex; flex-wrap: wrap; gap: 1.5rem; margin: 0.75rem 0 0; padding: 0; }
.meta-grid div { display: flex; flex-direction: column; gap: 0.15rem; }
.meta-grid dt { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; opacity: 0.6; }
.meta-grid dd { margin: 0; font-size: 0.85rem; }
.goal-summary { margin: 1rem 0 0; opacity: 0.85; max-width: 70ch; font-size: 0.9rem; }

main { max-width: 1200px; margin: 0 auto; padding: 1.5rem 2rem 4rem; }

.summary { margin-bottom: 1.5rem; }
.summary h2 { font-size: 1rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); margin: 0 0 0.75rem; }
.stat-tiles { list-style: none; display: flex; flex-wrap: wrap; gap: 0.75rem; margin: 0; padding: 0; }
.stat-tile { background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 0.6rem 1rem; min-width: 110px; display: flex; flex-direction: column; }
.stat-value { font-size: 1.3rem; font-weight: 700; }
.stat-label { font-size: 0.75rem; color: var(--text-muted); }

.tabs { display: flex; gap: 0.25rem; border-bottom: 2px solid var(--border); margin-bottom: 1.25rem; }
.tabs button { font: inherit; background: none; border: none; padding: 0.6rem 1rem; cursor: pointer; color: var(--text-muted); border-bottom: 2px solid transparent; margin-bottom: -2px; }
.tabs button[aria-selected="true"] { color: var(--text); border-bottom-color: var(--accent); font-weight: 600; }

.pill { display: inline-block; padding: 0.1rem 0.55rem; border-radius: 999px; font-size: 0.72rem; font-weight: 600; white-space: nowrap; }
.pill-positive { background: var(--positive-bg); color: var(--positive-text); }
.pill-negative { background: var(--negative-bg); color: var(--negative-text); }
.pill-warning { background: var(--warning-bg); color: var(--warning-text); }
.pill-neutral { background: var(--neutral-bg); color: var(--neutral-text); }
.pill-info { background: var(--info-bg); color: var(--info-text); }

.capability-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 0.9rem; }
.capability-card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 0.9rem 1rem; }
.capability-card summary { cursor: pointer; list-style: none; }
.capability-card summary::-webkit-details-marker { display: none; }
.cc-summary-main { display: flex; justify-content: space-between; align-items: baseline; gap: 0.5rem; flex-wrap: wrap; }
.cc-name { font-weight: 700; font-size: 1rem; }
.cc-pills { display: flex; gap: 0.3rem; flex-wrap: wrap; }
.cc-oneliner { margin: 0.4rem 0 0; color: var(--text-muted); font-size: 0.85rem; }
.cc-metrics { margin-top: 0.5rem; display: flex; flex-wrap: wrap; gap: 0.35rem; }
.chip-metric { background: var(--surface-alt); border-radius: 4px; padding: 0.1rem 0.45rem; font-size: 0.75rem; color: var(--text-muted); }
.cc-body { margin-top: 0.85rem; padding-top: 0.75rem; border-top: 1px solid var(--border); }
.card-block { margin-bottom: 0.75rem; }
.card-block h4 { margin: 0 0 0.35rem; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); }
.reason-list { margin: 0; padding-left: 1.1rem; font-size: 0.85rem; }
.related-row { display: flex; gap: 0.5rem; align-items: baseline; flex-wrap: wrap; margin-bottom: 0.3rem; font-size: 0.82rem; }
.related-label { color: var(--text-muted); min-width: 90px; }
.implemented-note, .architecture-status, .error-note { font-size: 0.8rem; color: var(--text-muted); }
.error-note { color: var(--negative-text); }

.chip-list { display: inline-flex; flex-wrap: wrap; gap: 0.3rem; }
.chip { display: inline-flex; align-items: center; background: var(--surface-alt); border-radius: 4px; padding: 0.05rem 0.4rem; font-size: 0.78rem; text-decoration: none; color: var(--text); }
.chip:hover { background: var(--info-bg); }
.chip-static { color: var(--text-muted); }

.evidence-list { margin: 0.3rem 0 0; padding-left: 1.1rem; font-size: 0.78rem; color: var(--text-muted); }
.evidence-kind { text-transform: uppercase; font-size: 0.65rem; letter-spacing: 0.03em; }
.evidence-type { opacity: 0.8; }

.artifact-list { margin: 0; padding-left: 1.1rem; font-size: 0.82rem; }

.backlog-toolbar { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.75rem; align-items: center; }
.backlog-toolbar input, .backlog-toolbar select { font: inherit; padding: 0.4rem 0.6rem; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text); }
.backlog-toolbar input { flex: 1 1 220px; }
#result-count { font-size: 0.8rem; color: var(--text-muted); margin-left: auto; }

.table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: 8px; }
table { width: 100%; border-collapse: collapse; font-size: 0.85rem; background: var(--surface); }
th { text-align: left; background: var(--surface-alt); padding: 0.55rem 0.7rem; font-weight: 600; white-space: nowrap; position: sticky; top: 0; }
td { padding: 0.5rem 0.7rem; border-top: 1px solid var(--border); vertical-align: top; }
.row-toggle { font: inherit; background: none; border: none; padding: 0; color: var(--accent); cursor: pointer; text-align: left; }
.row-toggle:hover { text-decoration: underline; }
.detail-row td { background: var(--surface-alt); }
.detail-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 0.6rem 1.5rem; margin: 0; }
.detail-field dt { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); margin-bottom: 0.15rem; }
.detail-field dd { margin: 0; font-size: 0.85rem; }

.appendix { margin-top: 2rem; }
.appendix summary { cursor: pointer; }
.artifact-groups { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1rem; }
.artifact-group { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 0.75rem 0.9rem; }
.artifact-group h3 { margin: 0 0 0.4rem; font-size: 0.9rem; }

.empty-note { color: var(--text-muted); font-style: italic; }

.report-footer { text-align: center; padding: 2rem; font-size: 0.78rem; color: var(--text-muted); border-top: 1px solid var(--border); margin-top: 2rem; }

@media print {
  .backlog-toolbar, .tabs { display: none; }
  #panel-capabilities[hidden], #panel-backlog[hidden] { display: block !important; }
  .capability-card, details { break-inside: avoid; }
  a { color: inherit; text-decoration: none; }
  body { background: #fff; color: #000; }
}
@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; transition: none !important; }
}
`;

// ─── Entry point ────────────────────────────────────────────────────────────

export function renderSolutionReportHtml(projection: SolutionReportProjection): string {
  const anchorable = new Set<string>(projection.backlog.map((i) => i.id));
  const systemsAppendix = renderSystemsAppendix(projection);
  for (const id of systemsAppendix.anchorIds) anchorable.add(id);

  const title = `Solution Report — ${projection.project.businessName}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(title)}</title>
<style>${CSS}</style>
</head>
<body>
${renderHeader(projection)}
<main>
${renderSummary(projection)}

<div class="tabs" role="tablist" aria-label="Solution report views">
  <button type="button" role="tab" id="tab-capabilities" aria-selected="true" aria-controls="panel-capabilities">Capabilities</button>
  <button type="button" role="tab" id="tab-backlog" aria-selected="false" aria-controls="panel-backlog">Implementation Backlog (${projection.backlog.length})</button>
</div>

<section id="panel-capabilities" role="tabpanel" aria-labelledby="tab-capabilities">
${renderCapabilitiesPanel(projection, anchorable)}
</section>

<section id="panel-backlog" role="tabpanel" aria-labelledby="tab-backlog" hidden>
${renderBacklogPanel(projection, anchorable)}
</section>

${renderArtifacts(projection.artifactGroups)}
${systemsAppendix.html}
</main>
<footer class="report-footer">
  <p>Generated by Stitchfy v${escHtml(STITCHFY_VERSION)} — this report is a presentation of <code>blueprints/solution-blueprint.v1.json</code>, not a separate source of truth.</p>
</footer>
<script>${CLIENT_SCRIPT}</script>
</body>
</html>`;
}
