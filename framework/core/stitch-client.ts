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

interface RpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: { content: Array<{ type: string; text: string }>; isError?: boolean };
  error?: { code: number; message: string; data?: unknown };
}

// ─── Public result types ──────────────────────────────────────────────────────

/**
 * Known-good model ids as of the last time this file was verified against the
 * live tools/list schema. Google has changed this enum before without notice
 * (GEMINI_3_1_PRO / GEMINI_3_FLASH → GEMINI_3_8_FLASH / GEMINI_3_5_FLASH_LITE),
 * so this is a *preference order*, not a hard contract — resolveModelId()
 * validates against the live schema at runtime and falls back through this
 * list if the caller's preferred model is no longer valid.
 */
export type StitchModelId = "GEMINI_3_8_FLASH" | "GEMINI_3_5_FLASH_LITE";
const MODEL_FALLBACK_ORDER: string[] = ["GEMINI_3_8_FLASH", "GEMINI_3_5_FLASH_LITE"];

export interface StitchPage {
  route: string;
  html: string;
}

// ─── Client ──────────────────────────────────────────────────────────────────

export class StitchClient {
  private apiKey: string;
  private endpoint: string;
  private nextId = 0;

  private toolsListCache: Array<Record<string, unknown>> | null = null;

  constructor(apiKey: string, endpoint = DEFAULT_ENDPOINT) {
    if (!apiKey) throw new Error("StitchClient: apiKey must not be empty");
    this.apiKey = apiKey;
    this.endpoint = endpoint;
  }

  // ── Low-level RPC ─────────────────────────────────────────────────────────

  private async rpc(method: string, params: Record<string, unknown>): Promise<RpcResponse> {
    const id = ++this.nextId;
    const body = { jsonrpc: "2.0" as const, method, params, id };

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
      throw new Error(`Stitch MCP network error (${method}): ${(e as Error).message}`);
    }

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Stitch MCP HTTP ${res.status} on "${method}": ${detail.slice(0, 300)}`);
    }

    return (await res.json()) as RpcResponse;
  }

  private async call(toolName: string, args: Record<string, unknown>): Promise<string> {
    const json = await this.rpc("tools/call", { name: toolName, arguments: args });

    if (json.error) {
      throw new Error(`Stitch MCP tool error (${toolName}): [${json.error.code}] ${json.error.message}`);
    }

    const text = json.result?.content?.[0]?.text;

    if (json.result?.isError) {
      throw new Error(`Stitch MCP tool error (${toolName}): ${text ?? "(no error detail returned)"}`);
    }

    if (typeof text !== "string" || text.length === 0) {
      throw new Error(`Stitch MCP returned empty content for tool "${toolName}"`);
    }

    return text;
  }

  /** Fetches and caches the server's tool schemas (fetched once per client instance). */
  private async listTools(): Promise<Array<Record<string, unknown>>> {
    if (this.toolsListCache) return this.toolsListCache;
    const json = await this.rpc("tools/list", {});
    if (json.error) {
      throw new Error(`Stitch MCP tools/list error: [${json.error.code}] ${json.error.message}`);
    }
    const tools = (json as unknown as { result?: { tools?: Array<Record<string, unknown>> } }).result?.tools;
    this.toolsListCache = Array.isArray(tools) ? tools : [];
    return this.toolsListCache;
  }

  /**
   * Resolves a model id against the live generate_screen_from_text schema, so a
   * model id that Google has deprecated/renamed doesn't silently fail every page.
   * Falls back through MODEL_FALLBACK_ORDER (then any other live enum value) if
   * `preferred` isn't currently valid. If the live schema can't be fetched at
   * all, proceeds with `preferred` unchanged (best-effort — a real API call will
   * still surface a clear error via the isError check in `call()` if it's bad).
   */
  async resolveModelId(preferred: string, onFallback?: (msg: string) => void): Promise<string> {
    let validModels: string[];
    try {
      const tools = await this.listTools();
      const tool = tools.find((t) => t["name"] === "generate_screen_from_text");
      const schema = tool?.["inputSchema"] as { properties?: Record<string, unknown> } | undefined;
      const modelIdSchema = schema?.properties?.["modelId"] as { enum?: string[] } | undefined;
      validModels = (modelIdSchema?.enum ?? []).filter((v) => !v.endsWith("_UNSPECIFIED"));
    } catch (e) {
      onFallback?.(
        `Could not verify live Stitch model schema (${(e as Error).message}) — proceeding with "${preferred}" unvalidated.`
      );
      return preferred;
    }

    if (validModels.length === 0 || validModels.includes(preferred)) {
      return preferred;
    }

    const fallback = MODEL_FALLBACK_ORDER.find((m) => validModels.includes(m)) ?? validModels[0];
    onFallback?.(
      `Model "${preferred}" is not valid on the live Stitch API (current options: ${validModels.join(", ")}). Falling back to "${fallback}".`
    );
    return fallback;
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
   *
   * The response shape varies: sometimes a flat `{ name: "projects/x/screens/y" }`,
   * sometimes a richer conversational envelope
   * (`{ outputComponents: [{ design: { screens: [{ id, htmlCode, ... }] } }, ...] }`)
   * that — when the generation completed synchronously — already carries the
   * exported HTML inline. When that's present we fetch and return it directly;
   * the caller only needs to fall back to getScreen() when `html` is undefined,
   * i.e. the export genuinely hadn't finished yet at generation time.
   *
   * Schema-verified params (camelCase — confirmed via tools/list):
   *   projectId, prompt, modelId, deviceType, designSystem
   */
  async generateScreen(
    projectId: string,
    prompt: string,
    modelId: string = "GEMINI_3_8_FLASH"
  ): Promise<{ screenId: string; html?: string }> {
    const text = await this.call("generate_screen_from_text", {
      projectId,
      prompt,
      modelId,
      deviceType: "DESKTOP",
    });
    const { screenId, htmlCode } = extractScreenPayload(text);

    if (typeof htmlCode === "string" && htmlCode.trim().length > 0) {
      return { screenId, html: htmlCode };
    }
    if (htmlCode && typeof htmlCode === "object" && typeof htmlCode.downloadUrl === "string") {
      const html = await this.fetchDownloadUrl(htmlCode.downloadUrl, `projects/${projectId}/screens/${screenId}`);
      return { screenId, html };
    }
    return { screenId };
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
    const MAX_RETRIES = 16;
    const RETRY_DELAY_MS = 5000;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const text = await this.call("get_screen", { name });

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

type HtmlCode = string | { downloadUrl?: string } | undefined;

/**
 * Extracts the bare screen ID (and inline HTML, if the export already
 * finished synchronously) from a generate_screen_from_text response.
 *
 * Response may look like:
 *   { "name": "projects/123/screens/abc123", ... }              → screenId only
 *   { "outputComponents": [{ "design": { "screens": [          → screenId + htmlCode
 *     { "id": "abc123", "htmlCode": { "downloadUrl": "..." } }
 *   ] } }, ...] }
 *   "screens/abc123"                                             → screenId only
 */
function extractScreenPayload(text: string): { screenId: string; htmlCode?: HtmlCode } {
  let screenId: string | undefined;
  let htmlCode: HtmlCode;

  try {
    const obj = JSON.parse(text) as Record<string, unknown>;

    // Flat shape: "name": "projects/123/screens/abc123"
    if (typeof obj["name"] === "string") {
      const m = (obj["name"] as string).match(/screens\/([0-9a-f]+)/i);
      if (m?.[1]) screenId = m[1];
    }
    for (const key of ["screenId", "screen_id", "id"]) {
      const val = obj[key];
      if (!screenId && typeof val === "string" && val.length > 0) screenId = val;
    }

    // Conversational envelope: outputComponents[].design.screens[0]
    const outputComponents = obj["outputComponents"];
    if (Array.isArray(outputComponents)) {
      for (const oc of outputComponents) {
        const screens = (oc as Record<string, unknown>)?.["design"] as Record<string, unknown> | undefined;
        const screenList = screens?.["screens"];
        if (Array.isArray(screenList) && screenList.length > 0) {
          const screen = screenList[0] as Record<string, unknown>;
          if (!screenId) {
            if (typeof screen["id"] === "string") {
              screenId = screen["id"] as string;
            } else if (typeof screen["name"] === "string") {
              const m = (screen["name"] as string).match(/screens\/([0-9a-f]+)/i);
              if (m?.[1]) screenId = m[1];
            }
          }
          htmlCode = screen["htmlCode"] as HtmlCode;
          break;
        }
      }
    }
  } catch {}

  // Plain text fallback: "screens/abc123" or a bare hex string
  if (!screenId) {
    const m = text.match(/screens\/([0-9a-f]+)/i);
    if (m?.[1]) screenId = m[1];
  }
  if (!screenId) {
    const hex = text.trim();
    if (/^[0-9a-f]{24,}$/i.test(hex)) screenId = hex;
  }

  if (!screenId) {
    throw new Error(`Could not extract screen ID from generate_screen_from_text response. Raw: ${text.slice(0, 300)}`);
  }

  return { screenId, htmlCode };
}

