/**
 * One shared keyword table mapping Java import prefixes / Maven
 * groupId:artifactId coordinates to a framework name — used by both
 * java-source.analyzer.ts (detectionMethod: "import") and
 * maven.analyzer.ts (detectionMethod: "dependency"), so there is exactly
 * one place that decides what a given coordinate/import means (task item
 * 28). Namespace (javax/jakarta) is folded directly into the returned name
 * so a mixed-namespace repository naturally produces two distinct
 * FrameworkFacts rather than a separate stored "finding" entity (task item
 * 49 — computed in the artifact renderer instead).
 */

export interface FrameworkMatch {
  name: string;
}

const IMPORT_PREFIX_TABLE: Array<{ prefix: string; name: string }> = [
  { prefix: "org.springframework.boot", name: "Spring Boot" },
  { prefix: "org.springframework", name: "Spring Framework" },
  { prefix: "org.hibernate", name: "Hibernate" },
  { prefix: "javax.persistence", name: "JPA (javax)" },
  { prefix: "jakarta.persistence", name: "JPA (jakarta)" },
  { prefix: "javax.servlet", name: "Servlet API (javax)" },
  { prefix: "jakarta.servlet", name: "Servlet API (jakarta)" },
  { prefix: "org.apache.struts2", name: "Struts" },
  { prefix: "com.opensymphony.xwork2", name: "Struts" },
  { prefix: "javax.ejb", name: "EJB (javax)" },
  { prefix: "jakarta.ejb", name: "EJB (jakarta)" },
  { prefix: "javax.faces", name: "JSF (javax)" },
  { prefix: "jakarta.faces", name: "JSF (jakarta)" },
];

export function detectFrameworkFromImport(importPath: string): FrameworkMatch | undefined {
  const match = IMPORT_PREFIX_TABLE.find((entry) => importPath === entry.prefix || importPath.startsWith(`${entry.prefix}.`));
  return match ? { name: match.name } : undefined;
}

const MAVEN_COORDINATE_TABLE: Array<{ group: string; artifactPrefix?: string; name: string }> = [
  { group: "org.springframework.boot", name: "Spring Boot" },
  { group: "org.springframework", name: "Spring Framework" },
  { group: "org.hibernate", name: "Hibernate" },
  { group: "javax.persistence", name: "JPA (javax)" },
  { group: "jakarta.persistence", name: "JPA (jakarta)" },
  { group: "javax.servlet", name: "Servlet API (javax)" },
  { group: "jakarta.servlet", name: "Servlet API (jakarta)" },
  { group: "org.apache.struts", name: "Struts" },
  { group: "javax.ejb", name: "EJB (javax)" },
  { group: "jakarta.ejb", name: "EJB (jakarta)" },
];

export function detectFrameworkFromMavenCoordinate(group: string | undefined, artifactId: string): FrameworkMatch | undefined {
  if (!group) return undefined;
  const match = MAVEN_COORDINATE_TABLE.find((entry) => group === entry.group || group.startsWith(`${entry.group}.`));
  if (!match) return undefined;
  if (match.artifactPrefix && !artifactId.startsWith(match.artifactPrefix)) return undefined;
  return { name: match.name };
}
