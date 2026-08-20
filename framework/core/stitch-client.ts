/**
 * stitch-client — Thin JSON-RPC 2.0 client for the Google Stitch MCP server.
 *
 * Protocol: HTTP POST to https://stitch.googleapis.com/mcp
 * Auth:     X-Goog-Api-Key header
 * Spec:     JSON-RPC 2.0 — method "tools/call", tool name in params.name
 *
 * Every tool response wraps its payload in:
 *   result.content[0].text  (string — may be JSON or raw HTML)
 *
 * Available tools (verified via tools/list on the official endpoint):
 *   create_project, get_project, list_projects, list_screens,
 *   get_screen, generate_screen_from_text, edit_screens,
 *   generate_variants, upload_design_md, create_design_system,
 *   create_design_system_from_design_md, update_design_system,
 *   list_design_systems, apply_design_system
 *
 * NOTE: build_site, get_screen_code are NOT available on the official endpoint —
 * those exist only in third-party community MCP wrappers.
 */

const DEFAULT_ENDPOINT = "https://stitch.googleapis.com/mcp";

// ─── Wire types ───────────────────────────────────────────────────────────────

interface RpcRequest {
  jsonrpc: "2.0";
  method: "tools/call";
  params: { name: string; arguments: Record<string, unknown> };
  id: number;
}

interface RpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: { content: Array<{ type: string; text: string }> };
  error?: { code: number; message: string; data?: unknown };
}

// ─── Public result types ──────────────────────────────────────────────────────

export type StitchModelId = "GEMINI_3_1_PRO" | "GEMINI_3_FLASH";

export interface StitchPage {
  route: string;
  html: string;
}

// ─── Client ──────────────────────────────────────────────────────────────────

export class StitchClient {
  private apiKey: string;
  private endpoint: string;
  private nextId = 0;

  constructor(apiKey: string, endpoint = DEFAULT_ENDPOINT) {
    if (!apiKey) throw new Error("StitchClient: apiKey must not be empty");
    this.apiKey = apiKey;
    this.endpoint = endpoint;
  }

  // ── Low-level call ────────────────────────────────────────────────────────

  private async call(toolName: string, args: Record<string, unknown>): Promise<string> {
    const id = ++this.nextId;
    const body: RpcRequest = {
      jsonrpc: "2.0",
      method: "tools/call",
      params: { name: toolName, arguments: args },
      id,
    };

    let res: Response;
    try {
      res = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": this.apiKey,
        },
        body: JSON.stringify(body),
      });
    } catch (e) {
      throw new Error(`Stitch MCP network error (${toolName}): ${(e as Error).message}`);
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Stitch MCP HTTP ${res.status} on tool "${toolName}": ${detail.slice(0, 300)}`);
    }

    const json = (await res.json()) as RpcResponse;

    if (json.error) {
      throw new Error(`Stitch MCP tool error (${toolName}): [${json.error.code}] ${json.error.message}`);
    }

    const text = json.result?.content?.[0]?.text;
    if (typeof text !== "string" || text.length === 0) {
      throw new Error(`Stitch MCP returned empty content for tool "${toolName}"`);
    }

    return text;
  }

  // ── High-level tool wrappers ──────────────────────────────────────────────

  /**
   * Creates a new Stitch project.
   * Returns the bare numeric project ID (e.g. "4044680601076201931").
   */
  async createProject(title: string): Promise<string> {
    const text = await this.call("create_project", { title });
    return extractProjectId(text);
  }

  /**
   * Generates a screen from a text prompt inside an existing project.
   * Returns the bare screen ID (e.g. "98b50e2ddc9943efb387052637738f61").
   *
   * Schema-verified params (camelCase — confirmed via tools/list):
   *   projectId, prompt, modelId, deviceType, designSystem
   */
  async generateScreen(
    projectId: string,
    prompt: string,
    modelId: StitchModelId = "GEMINI_3_1_PRO"
  ): Promise<string> {
    const text = await this.call("generate_screen_from_text", {
      projectId,
      prompt,
      modelId,
      deviceType: "DESKTOP",
    });
    return extractScreenId(text);
  }

  /**
   * Retrieves a screen and returns its HTML content.
   *
   * get_screen returns: { htmlCode: { downloadUrl: "https://..." }, ... }
   * The HTML is not inline — must be fetched from downloadUrl.
   *
   * Stitch's HTML export can lag behind screen creation by several seconds.
   * We poll until htmlCode is populated (up to MAX_RETRIES attempts).
   */
  async getScreen(projectId: string, screenId: string): Promise<string> {
    const name = `projects/${projectId}/screens/${screenId}`;
    const MAX_RETRIES = 8;
    const RETRY_DELAY_MS = 5000;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const text = await this.call("get_screen", { name, projectId, screenId });

      let screenObj: Record<string, unknown>;
      try {
        screenObj = JSON.parse(text) as Record<string, unknown>;
      } catch {
        const t = text.trim();
        if (t.startsWith("<!DOCTYPE") || t.startsWith("<html")) return text;
        throw new Error(`get_screen returned non-JSON for ${name}: ${text.slice(0, 200)}`);
      }

      const htmlCode = screenObj["htmlCode"] as
        | string
        | { downloadUrl?: string }
        | Record<string, never>
        | undefined;

      // Inline HTML string
      if (typeof htmlCode === "string" && htmlCode.trim().length > 0) {
        return htmlCode;
      }

      // File reference with download URL
      if (
        htmlCode &&
        typeof htmlCode === "object" &&
        "downloadUrl" in htmlCode &&
        typeof (htmlCode as { downloadUrl: string }).downloadUrl === "string"
      ) {
        return this.fetchDownloadUrl((htmlCode as { downloadUrl: string }).downloadUrl, name);
      }

      // Empty object {} — HTML export not ready yet; wait and retry
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS);
      }
    }

    throw new Error(
      `get_screen htmlCode never populated for ${name} after ${MAX_RETRIES} attempts (${(MAX_RETRIES * RETRY_DELAY_MS) / 1000}s). ` +
      "Stitch may still be processing — try again in a few seconds."
    );
  }

  /** Fetches a Stitch-signed download URL and returns the text content. */
  private async fetchDownloadUrl(url: string, context: string): Promise<string> {
    let res: Response;
    try {
      res = await fetch(url);
    } catch (e) {
      throw new Error(`Failed to download HTML from Stitch for ${context}: ${(e as Error).message}`);
    }
    if (!res.ok) {
      throw new Error(`Stitch download URL returned HTTP ${res.status} for ${context}`);
    }
    return res.text();
  }
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// ─── Response parsers ─────────────────────────────────────────────────────────

/**
 * Extracts the bare numeric project ID from a create_project response.
 *
 * Google returns: { "name": "projects/12345", "title": "...", ... }
 * We strip the "projects/" prefix — subsequent tools use the bare ID.
 */
function extractProjectId(text: string): string {
  try {
    const obj = JSON.parse(text) as Record<string, unknown>;
    if (typeof obj["name"] === "string" && obj["name"].startsWith("projects/")) {
      return (obj["name"] as string).slice("projects/".length);
    }
    for (const key of ["projectId", "project_id", "id"]) {
      const val = obj[key];
      if (typeof val === "string" && val.length > 0) return val as string;
    }
  } catch {}

  const m = text.match(/projects\/([0-9]+)/);
  if (m?.[1]) return m[1];

  throw new Error(`Could not extract project ID from create_project response. Raw: ${text.slice(0, 300)}`);
}

/**
 * Extracts the bare screen ID from a generate_screen_from_text response.
 *
 * Response may look like:
 *   { "name": "projects/123/screens/abc123", ... }  → "abc123"
 *   "screens/abc123"                                 → "abc123"
 */
function extractScreenId(text: string): string {
  try {
    const obj = JSON.parse(text) as Record<string, unknown>;
    // Full resource name: "projects/123/screens/abc123"
    if (typeof obj["name"] === "string") {
      const m = (obj["name"] as string).match(/screens\/([0-9a-f]+)/i);
      if (m?.[1]) return m[1];
    }
    for (const key of ["screenId", "screen_id", "id"]) {
      const val = obj[key];
      if (typeof val === "string" && val.length > 0) return val as string;
    }
  } catch {}

  // Plain text: "screens/abc123" or just "abc123"
  const m = text.match(/screens\/([0-9a-f]+)/i);
  if (m?.[1]) return m[1];

  // Bare hex string (32 chars)
  const hex = text.trim();
  if (/^[0-9a-f]{24,}$/i.test(hex)) return hex;

  throw new Error(`Could not extract screen ID from generate_screen_from_text response. Raw: ${text.slice(0, 300)}`);
}

