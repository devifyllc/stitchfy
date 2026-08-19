/**
 * The analyzer abstraction every ecosystem-specific analyzer implements.
 * Detection belongs to the analyzer (`supports()`), never to orchestration
 * `if (repositoryHasPom) ...` branching. An analyzer must be deterministic,
 * perform no network calls, execute no repository commands, and modify no
 * repository files — see docs/architecture/CODEBASE_ANALYSIS.md "Read-only
 * policy".
 */

export interface ScannedFile {
  /** Repository-relative, POSIX-style. */
  relativePath: string;
  size: number;
  ext: string;
}

export interface CodebaseAnalyzerContext {
  repositoryName: string;
  /** Every file that survived scanning (not excluded/sensitive/binary/oversized) — safe to read. */
  files: ScannedFile[];
  /** Returns file text, or undefined if missing/unreadable/outside the repository root — never throws on a bad path. */
  readFile(relativePath: string): string | undefined;
}

export interface CodebaseAnalyzer<TOutput = unknown> {
  id: string;
  name: string;
  version: string;
  supports(context: CodebaseAnalyzerContext): boolean;
  analyze(context: CodebaseAnalyzerContext): Promise<TOutput>;
}

export type AnalyzerDiagnosticSeverity = "info" | "warning" | "error";

export interface AnalyzerDiagnostic {
  analyzerId: string;
  severity: AnalyzerDiagnosticSeverity;
  message: string;
  filePath?: string;
}
