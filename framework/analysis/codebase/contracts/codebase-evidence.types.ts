/**
 * A second, independent evidence/provenance domain, deliberately separate
 * from framework/core/contracts/evidence.ts (EvidenceReference). Business
 * discovery evidence points at DiscoveryResult entities; codebase evidence
 * points at a real, scanned repository file. Never merged — DiscoveryResult
 * stays business/problem discovery only (see docs/architecture/CODEBASE_ANALYSIS.md
 * "Trust boundary").
 */

export type CodebaseEvidenceType = "manifest" | "build-file" | "source" | "configuration" | "filesystem";

/** `filePath` is always repository-relative, POSIX-style — never the user's absolute local path. */
export interface CodebaseEvidenceReference {
  analyzerId: string;
  filePath: string;
  line?: number;
  symbol?: string;
  factId?: string;
  evidenceType: CodebaseEvidenceType;
}

export type CodebaseFactProvenance = "observed" | "derived";

/**
 * "observed" — a literal fact read from a manifest/source file (e.g. "pom.xml
 * declares org.springframework:spring-context:4.3.30.RELEASE").
 * "derived" — a conclusion computed from one or more observed facts (e.g.
 * "Spring Framework is present"); `evidenceRefs` must point back at the
 * observed fact(s) that support it — never presented as a literal
 * source-file statement.
 */
export interface CodebaseFactMetadata {
  provenance: CodebaseFactProvenance;
  evidenceRefs: CodebaseEvidenceReference[];
}
