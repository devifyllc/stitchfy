/**
 * report-generator — Generates HTML audit reports from blueprint data
 * and optional static HTML analysis results.
 *
 * Outputs: output/reports/accessibility-report.html, seo-report.html, final-report.html
 *
 * Reports never fabricate Lighthouse scores.
 * The accessibility report includes the required disclaimer.
 */

import * as fs from "fs";
import * as path from "path";
import type { WebsiteBlueprint } from "../schemas/blueprint.types.js";

export interface HtmlCheck {
  rule: string;
  description: string;
  status: "pass" | "warn" | "fail" | "skip";
  detail?: string;
}

export interface PageAnalysis {
  pageId: string;
  title: string;
  path: string;
  file: string;
  checks: HtmlCheck[];
}

export interface ReportData {
  blueprint: WebsiteBlueprint;
  blueprintPath: string;
  generatedAt: string;
  pageAnalyses: PageAnalysis[];
  staticSiteExists: boolean;
}

// ─── Entry points ─────────────────────────────────────────────────────────────

export function generateReports(data: ReportData, outputDir: string): void {
  const reportsDir = path.join(outputDir, "reports");
  fs.mkdirSync(reportsDir, { recursive: true });

  fs.writeFileSync(path.join(reportsDir, "accessibility-report.html"), generateAccessibilityReport(data));
  fs.writeFileSync(path.join(reportsDir, "seo-report.html"), generateSEOReport(data));
  fs.writeFileSync(path.join(reportsDir, "final-report.html"), generateFinalReport(data));
}

// ─── Static HTML analysis ──────────────────────────────────────────────────────

export function analyzeHtmlFile(html: string): HtmlCheck[] {
  const checks: HtmlCheck[] = [];

  const check = (rule: string, description: string, status: "pass" | "warn" | "fail" | "skip", detail?: string) =>
    checks.push({ rule, description, status, detail });

  // Language attribute
  check("lang-attribute", "HTML lang attribute present",
    /<html[^>]+lang=/.test(html) ? "pass" : "fail");

  // Page title
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  check("page-title", "Page has a descriptive title",
    titleMatch && titleMatch[1].trim().length > 5 ? "pass" : "fail",
    titleMatch ? `"${titleMatch[1].trim()}"` : "No <title> found");

  // Meta description
  check("meta-description", "Meta description present",
    /<meta[^>]+name=["']description["'][^>]+content=/i.test(html) ||
    /<meta[^>]+content=[^>]+name=["']description["']/i.test(html) ? "pass" : "warn",
    "Check that content is non-empty and ≤ 160 characters");

  // H1 count
  const h1Count = (html.match(/<h1[\s>]/gi) ?? []).length;
  check("one-h1", "Page has exactly one H1",
    h1Count === 1 ? "pass" : h1Count === 0 ? "fail" : "warn",
    `Found ${h1Count} H1 element${h1Count !== 1 ? "s" : ""}`);

  // Skip link
  check("skip-link", "Skip-to-content link targets #main-content",
    html.includes('href="#main-content"') ? "pass" : "fail");

  // main landmark
  check("landmark-main", "<main id='main-content'> landmark present",
    /id=["']main-content["']/.test(html) ? "pass" : "fail");

  // header banner
  check("landmark-banner", "<header role='banner'> present",
    /role=["']banner["']/.test(html) ? "pass" : "fail");

  // footer contentinfo
  check("landmark-contentinfo", "<footer role='contentinfo'> present",
    /role=["']contentinfo["']/.test(html) ? "pass" : "fail");

  // nav aria-label
  check("landmark-navigation", "<nav> has aria-label",
    /aria-label=["']Main navigation["']/.test(html) ? "pass" : "warn");

  // Images without alt
  const imgTags = html.match(/<img[^>]*>/gi) ?? [];
  const missingAlt = imgTags.filter((t) => !/alt=/.test(t)).length;
  check("image-alt-text", "All <img> elements have alt attributes",
    missingAlt === 0 ? "pass" : "fail",
    missingAlt > 0 ? `${missingAlt} image${missingAlt !== 1 ? "s" : ""} missing alt attribute` : undefined);

  // Phone tel links
  const phoneNumbers = html.match(/\(\d{3}\)\s*\d{3}[\s.-]\d{4}|\d{3}[\s.-]\d{3}[\s.-]\d{4}/g) ?? [];
  const telLinks = (html.match(/href=["']tel:/g) ?? []).length;
  check("phone-tel-link", "Phone numbers wrapped in tel: links",
    phoneNumbers.length === 0 || telLinks >= phoneNumbers.length ? "pass" : "warn",
    phoneNumbers.length > 0 ? `${phoneNumbers.length} phone number(s), ${telLinks} tel: link(s)` : undefined);

  // Address element
  check("address-element", "<address> element used for physical address",
    /<address[\s>]/.test(html) ? "pass" : "warn",
    /<address[\s>]/.test(html) ? undefined : "Use <address> for physical location blocks");

  // Focus outline not removed
  const outlineNone = (html.match(/outline\s*:\s*none/g) ?? []).length;
  const outlineZero = (html.match(/outline\s*:\s*0/g) ?? []).length;
  check("focus-visible", "Focus outline not suppressed without replacement",
    outlineNone + outlineZero === 0 ? "pass" : "warn",
    outlineNone + outlineZero > 0 ? "outline:none found — verify a visible replacement focus indicator is present" : undefined);

  // Canonical link
  check("canonical", "Canonical link tag present",
    /rel=["']canonical["']/.test(html) ? "pass" : "warn",
    /rel=["']canonical["']/.test(html) ? undefined : "Add <link rel='canonical'> to prevent duplicate content");

  return checks;
}

// ─── Accessibility report ─────────────────────────────────────────────────────

function generateAccessibilityReport(data: ReportData): string {
  const { blueprint, blueprintPath, generatedAt, pageAnalyses, staticSiteExists } = data;
  const checklist = blueprint.accessibility.qaChecklist;

  const allPageChecks = pageAnalyses.flatMap((p) => p.checks);
  const passCount = allPageChecks.filter((c) => c.status === "pass").length;
  const warnCount = allPageChecks.filter((c) => c.status === "warn").length;
  const failCount = allPageChecks.filter((c) => c.status === "fail").length;
  const hasBlockers = failCount > 0;

  const checklistRows = checklist
    .map((item) => {
      const badge = item.priority === "must" ? badgeHtml("must", "#c0392b")
        : item.priority === "should" ? badgeHtml("should", "#e67e22")
        : badgeHtml("nice-to-have", "#27ae60");
      return `<tr>
        <td><code>${item.rule}</code></td>
        <td>${escHtml(item.description)}</td>
        <td>${badge}</td>
        <td>${statusBadge("skip")}</td>
      </tr>`;
    })
    .join("\n");

  const pageRows = pageAnalyses.length > 0
    ? pageAnalyses.map((p) => {
        const pass = p.checks.filter((c) => c.status === "pass").length;
        const fail = p.checks.filter((c) => c.status === "fail").length;
        const warn = p.checks.filter((c) => c.status === "warn").length;
        return `<tr>
          <td><a href="${p.path}">${escHtml(p.title)}</a></td>
          <td><code>${p.path}</code></td>
          <td>${statusBadge("pass")} ${pass} &nbsp; ${statusBadge("warn")} ${warn} &nbsp; ${fail > 0 ? statusBadge("fail") : ""} ${fail}</td>
        </tr>`;
      }).join("\n")
    : `<tr><td colspan="3" style="opacity:0.6; font-style:italic">
        No static HTML files analyzed — run npm run build:site first
      </td></tr>`;

  const htmlCheckRows = allPageChecks.length > 0
    ? pageAnalyses.flatMap((p) =>
        p.checks.map((c) => `<tr>
          <td>${escHtml(p.title)}</td>
          <td><code>${c.rule}</code></td>
          <td>${escHtml(c.description)}</td>
          <td>${statusBadge(c.status)}</td>
          <td style="opacity:0.7; font-size:0.85rem">${c.detail ? escHtml(c.detail) : ""}</td>
        </tr>`)
      ).join("\n")
    : `<tr><td colspan="5" style="opacity:0.6; font-style:italic">
        Static HTML analysis not available — build the site first
      </td></tr>`;

  return html(`Accessibility Report — ${blueprint.business.name}`, `
    ${reportHeader("Accessibility Report", blueprint.business.name, generatedAt, blueprintPath)}

    <div class="disclaimer">
      <strong>Disclaimer:</strong> Stitchfy completed an automated and structured
      accessibility-oriented review against the framework checklist. This does not
      constitute legal certification. ADA compliance for any specific deployment
      requires independent legal counsel.
    </div>

    <div class="cards">
      ${card("Target Standard", "WCAG 2.1 Level AA")}
      ${card("Pages Reviewed", String(blueprint.pages.length))}
      ${card("Checklist Items", String(checklist.length))}
      ${card("HTML Checks Passed", staticSiteExists ? String(passCount) : "—")}
      ${card("Warnings", staticSiteExists ? String(warnCount) : "—")}
      ${card("Status", hasBlockers ? "⚠ Review needed" : "✓ Ready", hasBlockers ? "#c0392b" : "#27ae60")}
    </div>

    <h2>Framework Checklist (from blueprint)</h2>
    <p class="note">These checks are derived from the accessibility blueprint. Static HTML checks below verify implementation.</p>
    <table>
      <thead><tr><th>Rule</th><th>Description</th><th>Priority</th><th>Status</th></tr></thead>
      <tbody>${checklistRows}</tbody>
    </table>

    <h2>Static HTML Analysis ${staticSiteExists ? "" : '<span class="note">(not available — build site first)</span>'}</h2>
    <table>
      <thead><tr><th>Page</th><th>Rule</th><th>Description</th><th>Status</th><th>Detail</th></tr></thead>
      <tbody>${htmlCheckRows}</tbody>
    </table>

    <h2>Pages Reviewed</h2>
    <table>
      <thead><tr><th>Page</th><th>Path</th><th>Results</th></tr></thead>
      <tbody>${pageRows}</tbody>
    </table>

    <h2>Lighthouse</h2>
    <p class="note">Lighthouse scores were not generated in this run. To run Lighthouse: install <code>lighthouse</code> globally, serve <code>output/static-site/</code> locally, and run <code>lighthouse http://localhost:PORT --output html</code>.</p>
    <p>Blueprint targets: Accessibility ≥ ${blueprint.qa.lighthouseTargets["accessibility"] ?? 95}, Performance ≥ ${blueprint.qa.lighthouseTargets["performance"] ?? 90}</p>
  `);
}

// ─── SEO report ───────────────────────────────────────────────────────────────

function generateSEOReport(data: ReportData): string {
  const { blueprint, blueprintPath, generatedAt, pageAnalyses, staticSiteExists } = data;
  const { seo, business, pages } = blueprint;

  const pageMetaRows = seo.pageMeta.map((meta) => {
    const titleLen = meta.title.length;
    const descLen = meta.description.length;
    const titleStatus = titleLen >= 30 && titleLen <= 70 ? "pass" : "warn";
    const descStatus = descLen >= 70 && descLen <= 160 ? "pass" : "warn";
    return `<tr>
      <td>${escHtml(meta.pageId)}</td>
      <td>${escHtml(meta.title)} ${statusBadge(titleStatus)}<br><small>${titleLen} chars</small></td>
      <td>${escHtml(meta.description)} ${statusBadge(descStatus)}<br><small>${descLen} chars</small></td>
    </tr>`;
  }).join("\n");

  const seoCheckRows = pageAnalyses.flatMap((p) =>
    p.checks
      .filter((c) => ["meta-description", "page-title", "canonical", "one-h1", "image-alt-text"].includes(c.rule))
      .map((c) => `<tr>
        <td>${escHtml(p.title)}</td>
        <td><code>${c.rule}</code></td>
        <td>${escHtml(c.description)}</td>
        <td>${statusBadge(c.status)}</td>
        <td style="opacity:0.7; font-size:0.85rem">${c.detail ? escHtml(c.detail) : ""}</td>
      </tr>`)
  ).join("\n");

  const structuredDataRows = seo.structuredDataRecommendations
    .map((rec) => `<li>${escHtml(rec)}</li>`)
    .join("\n");

  const localSeoRows = seo.localSeo
    .map((item) => `<li>${escHtml(item)}</li>`)
    .join("\n");

  const indexRows = seo.indexabilityRules
    .map((rule) => `<tr><td>${escHtml(rule)}</td><td>${statusBadge("skip")}</td></tr>`)
    .join("\n");

  return html(`SEO Report — ${business.name}`, `
    ${reportHeader("SEO Report", business.name, generatedAt, blueprintPath)}

    <div class="cards">
      ${card("Pages", String(pages.length))}
      ${card("Site Title", seo.siteTitle.length <= 70 ? "✓ Good length" : "⚠ Too long")}
      ${card("JSON-LD Type", "BeautySalon")}
      ${card("Sitemap", staticSiteExists ? "✓ Generated" : "⚠ Build site first")}
      ${card("Robots.txt", staticSiteExists ? "✓ Generated" : "⚠ Build site first")}
    </div>

    <h2>Page Metadata</h2>
    <table>
      <thead><tr><th>Page</th><th>Title (30–70 chars)</th><th>Description (70–160 chars)</th></tr></thead>
      <tbody>${pageMetaRows}</tbody>
    </table>

    <h2>SEO Checks (from HTML analysis)</h2>
    ${staticSiteExists
      ? `<table><thead><tr><th>Page</th><th>Rule</th><th>Description</th><th>Status</th><th>Detail</th></tr></thead><tbody>${seoCheckRows}</tbody></table>`
      : '<p class="note">Build the site first (<code>npm run build:site</code>) to enable HTML-based SEO checks.</p>'}

    <h2>Structured Data Recommendations</h2>
    <ul>${structuredDataRows}</ul>

    <h2>Local SEO Checklist</h2>
    <ul>${localSeoRows}</ul>

    <h2>Indexability Rules</h2>
    <table>
      <thead><tr><th>Rule</th><th>Status</th></tr></thead>
      <tbody>${indexRows}</tbody>
    </table>

    <h2>Open Graph Tags</h2>
    <table>
      <thead><tr><th>Property</th><th>Value</th></tr></thead>
      <tbody>
        ${Object.entries(seo.openGraph).map(([k, v]) => `<tr><td><code>${escHtml(k)}</code></td><td>${escHtml(v)}</td></tr>`).join("\n")}
      </tbody>
    </table>

    <h2>Lighthouse</h2>
    <p class="note">Lighthouse scores were not generated in this run.</p>
    <p>Blueprint target: SEO score ≥ ${blueprint.qa.lighthouseTargets["seo"] ?? 95}</p>
  `);
}

// ─── Final report ─────────────────────────────────────────────────────────────

function generateFinalReport(data: ReportData): string {
  const { blueprint, blueprintPath, generatedAt, pageAnalyses, staticSiteExists } = data;
  const { business, frontend, qa } = blueprint;

  const allChecks = pageAnalyses.flatMap((p) => p.checks);
  const passCount = allChecks.filter((c) => c.status === "pass").length;
  const warnCount = allChecks.filter((c) => c.status === "warn").length;
  const failCount = allChecks.filter((c) => c.status === "fail").length;
  const totalChecks = allChecks.length;
  const overallOk = failCount === 0;

  const unsupportedRows = frontend.unsupportedFeatures
    .map((f) => `<tr><td>${escHtml(f)}</td><td>${statusBadge("skip")} Not implemented</td><td>See booking platform or future phases</td></tr>`)
    .join("\n");

  const limitationRows = qa.knownLimitations
    .map((l) => `<li>${escHtml(l)}</li>`)
    .join("\n");

  const routeRows = frontend.routes
    .map((r) => `<tr>
      <td>${escHtml(r.pageId)}</td>
      <td><code>${r.path}</code></td>
      <td><code>${r.file}</code></td>
      <td>${staticSiteExists ? statusBadge("pass") : statusBadge("skip")}</td>
    </tr>`)
    .join("\n");

  return html(`Final Report — ${business.name}`, `
    ${reportHeader("Final Report", business.name, generatedAt, blueprintPath)}

    <div class="cards">
      ${card("Business", business.name)}
      ${card("Industry", business.industry)}
      ${card("Location", business.location)}
      ${card("Pages Generated", String(frontend.routes.length))}
      ${card("Static Site", staticSiteExists ? "✓ Built" : "⚠ Run build:site", staticSiteExists ? "#27ae60" : "#e67e22")}
      ${card("Overall Status", overallOk ? "✓ Ready" : "⚠ Review needed", overallOk ? "#27ae60" : "#c0392b")}
    </div>

    <h2>Pipeline Summary</h2>
    <table>
      <thead><tr><th>Step</th><th>Artifact</th><th>Status</th></tr></thead>
      <tbody>
        <tr><td>1. Blueprint</td><td><code>${blueprintPath.replace(process.cwd() + "/", "")}</code></td><td>${statusBadge("pass")} Generated</td></tr>
        <tr><td>2. Site source</td><td><code>output/generated-site/</code></td><td>${staticSiteExists ? `${statusBadge("pass")} Generated` : `${statusBadge("warn")} Run npm run build:site`}</td></tr>
        <tr><td>3. Static output</td><td><code>output/static-site/</code></td><td>${staticSiteExists ? `${statusBadge("pass")} Built` : `${statusBadge("warn")} Run npm run build:site`}</td></tr>
        <tr><td>4. Accessibility report</td><td><code>output/reports/accessibility-report.html</code></td><td>${statusBadge("pass")} Generated</td></tr>
        <tr><td>5. SEO report</td><td><code>output/reports/seo-report.html</code></td><td>${statusBadge("pass")} Generated</td></tr>
      </tbody>
    </table>

    <h2>HTML Checks Summary ${!staticSiteExists ? '<span class="note">(build site first)</span>' : ""}</h2>
    <div class="cards">
      ${card("Total checks", String(totalChecks))}
      ${card("Passed", String(passCount), "#27ae60")}
      ${card("Warnings", String(warnCount), "#e67e22")}
      ${card("Failures", String(failCount), failCount > 0 ? "#c0392b" : "#27ae60")}
    </div>

    <h2>Generated Routes</h2>
    <table>
      <thead><tr><th>Page</th><th>Path</th><th>File</th><th>Status</th></tr></thead>
      <tbody>${routeRows}</tbody>
    </table>

    <h2>Unsupported Features</h2>
    <p class="note">These features were requested or referenced but are not implemented in the static MVP.</p>
    <table>
      <thead><tr><th>Feature</th><th>Status</th><th>Recommendation</th></tr></thead>
      <tbody>${unsupportedRows}</tbody>
    </table>

    <h2>Known Limitations</h2>
    <ul>${limitationRows}</ul>

    <h2>Lighthouse Targets</h2>
    <p class="note">Lighthouse scores were not generated in this run. Scores must be collected manually after deploying the site.</p>
    <table>
      <thead><tr><th>Category</th><th>Target</th><th>Actual</th></tr></thead>
      <tbody>
        ${Object.entries(qa.lighthouseTargets).map(([k, v]) => `<tr><td>${k}</td><td>≥ ${v}</td><td style="opacity:0.5">Not run</td></tr>`).join("\n")}
      </tbody>
    </table>

    <h2>Next Steps</h2>
    <ol>
      <li>Replace placeholder gallery images in <code>output/generated-site/public/images/</code> with real photos.</li>
      <li>Update placeholder testimonials in <code>output/generated-site/site.config.ts</code> with real client reviews.</li>
      <li>Set the real domain name in <code>output/generated-site/app/layout.tsx</code> (<code>metadataBase</code>).</li>
      <li>Add <code>public/og-image.jpg</code> (1200×630px) for social media sharing.</li>
      <li>Deploy <code>output/static-site/</code> to AWS S3, Netlify, Vercel, or any static host.</li>
      <li>Run Lighthouse after deployment to verify performance and accessibility scores.</li>
      <li>Verify all <code>tel:</code> links work on mobile devices.</li>
    </ol>
  `);
}

// ─── HTML templating helpers ──────────────────────────────────────────────────

function html(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escHtml(title)}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; margin: 0; color: #1a1a1a; background: #f8f8f6; line-height: 1.55; font-size: 15px; }
    .report-header { background: #2c2c2c; color: #fff; padding: 2rem 2.5rem; }
    .report-header h1 { font-size: 1.75rem; margin-bottom: 0.25rem; }
    .report-header .business { font-size: 1.1rem; opacity: 0.75; margin-bottom: 1rem; }
    .report-header .meta { font-size: 0.8rem; opacity: 0.5; display: flex; gap: 2rem; flex-wrap: wrap; }
    main { max-width: 1100px; margin: 0 auto; padding: 2rem 2.5rem; }
    h2 { font-size: 1.2rem; margin: 2.5rem 0 0.75rem; border-bottom: 2px solid #eee; padding-bottom: 0.4rem; color: #2c2c2c; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; font-size: 0.875rem; }
    th { background: #2c2c2c; color: #fff; padding: 0.6rem 0.75rem; text-align: left; font-weight: 600; }
    td { padding: 0.5rem 0.75rem; border-bottom: 1px solid #eee; vertical-align: top; }
    tr:nth-child(even) td { background: #fafafa; }
    code { font-family: monospace; background: #f0f0f0; padding: 0.1em 0.3em; border-radius: 3px; font-size: 0.85em; }
    ul, ol { padding-left: 1.5rem; margin-bottom: 1rem; }
    li { margin-bottom: 0.4rem; line-height: 1.5; }
    .cards { display: flex; flex-wrap: wrap; gap: 1rem; margin: 1rem 0 2rem; }
    .card { background: #fff; border: 1px solid #e5e5e5; border-radius: 8px; padding: 1rem 1.5rem; min-width: 160px; flex: 1; }
    .card-label { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.5; margin-bottom: 0.25rem; }
    .card-value { font-size: 1.05rem; font-weight: 700; }
    .disclaimer { background: #fff9e6; border-left: 4px solid #f0c040; padding: 1rem 1.25rem; margin: 1.5rem 0; border-radius: 0 6px 6px 0; font-size: 0.9rem; }
    .note { font-size: 0.85rem; opacity: 0.6; font-style: italic; margin-bottom: 0.5rem; }
    .badge { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 20px; font-size: 0.75rem; font-weight: 700; color: #fff; }
    footer { text-align: center; padding: 2rem; font-size: 0.8rem; opacity: 0.5; border-top: 1px solid #eee; margin-top: 3rem; }
    a { color: #C4847A; }
  </style>
</head>
<body>
${body}
<footer>
  <p>Generated by Stitchfy v2 · Apache-2.0 · Devify LLC</p>
  <p>Lighthouse scores were not generated in this run.</p>
</footer>
</body>
</html>`;
}

function reportHeader(reportType: string, businessName: string, generatedAt: string, blueprintPath: string): string {
  const date = new Date(generatedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  return `<div class="report-header">
  <h1>${escHtml(reportType)}</h1>
  <p class="business">${escHtml(businessName)}</p>
  <div class="meta">
    <span>Generated: ${date}</span>
    <span>Framework: Stitchfy v2</span>
    <span>Blueprint: ${escHtml(blueprintPath.replace(process.cwd() + "/", ""))}</span>
  </div>
</div>
<main>`;
}

function card(label: string, value: string, color?: string): string {
  const colorStyle = color ? `color: ${color};` : "";
  return `<div class="card">
    <div class="card-label">${escHtml(label)}</div>
    <div class="card-value" style="${colorStyle}">${escHtml(value)}</div>
  </div>`;
}

function statusBadge(status: "pass" | "warn" | "fail" | "skip"): string {
  const colors = { pass: "#27ae60", warn: "#e67e22", fail: "#c0392b", skip: "#7f8c8d" };
  const labels = { pass: "✓ PASS", warn: "⚠ WARN", fail: "✗ FAIL", skip: "— SKIP" };
  return `<span class="badge" style="background:${colors[status]}">${labels[status]}</span>`;
}

function badgeHtml(label: string, color: string): string {
  return `<span class="badge" style="background:${color}">${escHtml(label)}</span>`;
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
