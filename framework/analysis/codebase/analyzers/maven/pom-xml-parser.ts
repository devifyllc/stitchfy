/**
 * A minimal, dependency-free, deterministic XML parser scoped to Maven POM
 * structure — not a general-purpose XML engine. `<!DOCTYPE ...>`,
 * `<!ENTITY ...>`, and processing instructions (`<?...?>`) are skipped
 * outright during tokenization and never interpreted — there is no code
 * path anywhere in this parser (or anywhere in this repository) capable of
 * resolving an external entity, a remote schema, a parent POM, or a BOM
 * (task item 19/75). Attributes are discarded — Maven POMs don't carry
 * meaningful ones for the facts this phase extracts.
 */

import { buildLineIndex, lineForOffset } from "../text-position.js";

export interface XmlNode {
  tag: string;
  children: XmlNode[];
  text: string;
  /** 1-indexed line the opening tag starts on. */
  line: number;
}

export function parsePomXml(content: string): XmlNode | undefined {
  const n = content.length;
  const lineIndex = buildLineIndex(content);
  let i = 0;

  function skipWhitespace(): void {
    while (i < n && /\s/.test(content[i])) i++;
  }

  function parseElement(): XmlNode | undefined {
    // Skip comments, DOCTYPE, ENTITY, and processing instructions until a real element or closing tag is found.
    for (;;) {
      skipWhitespace();
      if (i >= n || content[i] !== "<") return undefined;

      if (content.startsWith("<!--", i)) {
        const end = content.indexOf("-->", i + 4);
        if (end === -1) return undefined;
        i = end + 3;
        continue;
      }
      if (content.startsWith("<!DOCTYPE", i) || content.startsWith("<!ENTITY", i)) {
        const end = content.indexOf(">", i);
        if (end === -1) return undefined;
        i = end + 1;
        continue;
      }
      if (content.startsWith("<?", i)) {
        const end = content.indexOf("?>", i);
        if (end === -1) return undefined;
        i = end + 2;
        continue;
      }
      break;
    }

    if (i >= n || content[i] !== "<" || content[i + 1] === "/") return undefined;

    const startLine = lineForOffset(lineIndex, i);
    i++; // consume '<'
    const tagStart = i;
    while (i < n && /[^\s/>]/.test(content[i])) i++;
    const tag = content.slice(tagStart, i);

    // Skip attributes until '>' or self-closing '/>'.
    while (i < n && content[i] !== ">" && !(content[i] === "/" && content[i + 1] === ">")) i++;

    if (content[i] === "/" && content[i + 1] === ">") {
      i += 2;
      return { tag, children: [], text: "", line: startLine };
    }
    i++; // consume '>'

    const children: XmlNode[] = [];
    let text = "";

    for (;;) {
      if (i >= n) break;

      if (content.startsWith("</", i)) {
        const end = content.indexOf(">", i);
        if (end === -1) break;
        i = end + 1;
        break;
      }

      if (content[i] === "<") {
        const child = parseElement();
        if (child) children.push(child);
        else break;
        continue;
      }

      const textStart = i;
      const nextTag = content.indexOf("<", i);
      i = nextTag === -1 ? n : nextTag;
      text += content.slice(textStart, i);
    }

    return { tag, children, text: text.trim(), line: startLine };
  }

  return parseElement();
}

export function findChild(node: XmlNode | undefined, tag: string): XmlNode | undefined {
  return node?.children.find((c) => c.tag === tag);
}

export function findChildren(node: XmlNode | undefined, tag: string): XmlNode[] {
  return node?.children.filter((c) => c.tag === tag) ?? [];
}

export function childText(node: XmlNode | undefined, tag: string): string | undefined {
  const child = findChild(node, tag);
  return child && child.text.length > 0 ? child.text : undefined;
}
