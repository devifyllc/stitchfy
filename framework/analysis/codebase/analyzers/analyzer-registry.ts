/**
 * CodebaseAnalyzerRegistry — analyzer detection lives entirely in each
 * analyzer's own supports(); orchestration never branches on
 * `if (repositoryHasPom) ...` (task item 8). Multiple analyzers may support
 * the same repository (task item 64) — no "pick exactly one ecosystem"
 * logic exists anywhere.
 */

import type { CodebaseAnalyzer, CodebaseAnalyzerContext } from "../contracts/codebase-analyzer.types.js";

export class CodebaseAnalyzerRegistry {
  private analyzers = new Map<string, CodebaseAnalyzer>();

  register(analyzer: CodebaseAnalyzer): void {
    this.analyzers.set(analyzer.id, analyzer);
  }

  get(id: string): CodebaseAnalyzer | undefined {
    return this.analyzers.get(id);
  }

  getAll(): CodebaseAnalyzer[] {
    return [...this.analyzers.values()];
  }

  findSupported(context: CodebaseAnalyzerContext): CodebaseAnalyzer[] {
    return this.getAll().filter((a) => a.supports(context));
  }
}
