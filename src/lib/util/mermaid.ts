import { diagramData } from '@mermaid-js/examples';
import elkLayouts from '@mermaid-js/layout-elk';
import tidyTreeLayouts from '@mermaid-js/layout-tidy-tree';
import zenuml from '@mermaid-js/mermaid-zenuml';
import type { MermaidConfig, RenderResult } from 'mermaid';
import mermaid from 'mermaid';

mermaid.registerLayoutLoaders([...elkLayouts, ...tidyTreeLayouts]);
const init = mermaid.registerExternalDiagrams([zenuml]);

const shortLabelToken = (namespace: 'A' | 'S' | 'W', index: number): string =>
  `${namespace}${index.toString(36).padStart(3, '0')}${namespace}`;

const prepareArchitectureCode = (source: string) => {
  const labels = new Map<string, string>();
  if (!/^\s*architecture-beta\b/im.test(source)) return { code: source, labels };
  let index = 0;
  const code = source.replace(
    /^(\s*(?:group|service)\s+[^\n]+?\[)([^\]\n]+)(\])/gim,
    (_line, prefix: string, label: string, suffix: string) => {
      if (/^[\x20-\x7E]+$/.test(label)) return `${prefix}${label}${suffix}`;
      const token = shortLabelToken('A', index++);
      labels.set(token, label.replace(/^"|"$/g, ''));
      return `${prefix}${token}${suffix}`;
    }
  );
  return { code, labels };
};

const prepareWardleyCode = (source: string) => {
  const labels = new Map<string, string>();
  if (!/^\s*wardley-beta\b/im.test(source)) return { code: source, labels };
  const componentLabels = [
    ...new Set(
      [...source.matchAll(/^\s*(?:anchor|component)\s+(.+?)\s+\[/gim)]
        .map((match) => match[1].trim())
        .filter((label) => !/^[\x20-\x7E]+$/.test(label))
    )
  ].sort((left, right) => right.length - left.length);
  let code = source;
  for (const [index, label] of componentLabels.entries()) {
    const token = shortLabelToken('W', index);
    labels.set(token, label);
    code = code.replaceAll(label, token);
  }
  return { code, labels };
};

const prepareSankeyCode = (source: string) => {
  const labels = new Map<string, string>();
  if (!/^\s*sankey-beta\b/im.test(source)) return { code: source, labels };
  const tokens = new Map<string, string>();
  const decodeField = (field: string) => {
    const value = field.trim();
    return value.startsWith('"') && value.endsWith('"')
      ? value.slice(1, -1).replaceAll('""', '"')
      : value;
  };
  const safeField = (field: string) => {
    const label = decodeField(field);
    if (/^[\x20-\x7E]+$/.test(label)) return field;
    let token = tokens.get(label);
    if (!token) {
      token = shortLabelToken('S', tokens.size);
      tokens.set(label, token);
      labels.set(token, label);
    }
    return token;
  };
  const rowPattern =
    /^(\s*)("(?:[^"]|"")*"|[^,]*),("(?:[^"]|"")*"|[^,]*),(\s*-?(?:\d+(?:\.\d*)?|\.\d+)\s*)$/;
  const code = source
    .split('\n')
    .map((line) => {
      const match = line.match(rowPattern);
      return match ? `${match[1]}${safeField(match[2])},${safeField(match[3])},${match[4]}` : line;
    })
    .join('\n');
  return { code, labels };
};

const prepareDiagramCode = (source: string) => {
  const architecture = prepareArchitectureCode(source);
  const wardley = prepareWardleyCode(architecture.code);
  const sankey = prepareSankeyCode(wardley.code);
  return {
    code: sankey.code,
    labels: new Map([...architecture.labels, ...wardley.labels, ...sankey.labels])
  };
};

export const restorePreparedLabels = (svg: string, labels: Map<string, string>): string => {
  const escapeMarkup = (value: string) =>
    value.replace(/[&<>"']/g, (character) => {
      switch (character) {
        case '&':
          return '&amp;';
        case '"':
          return '&quot;';
        case "'":
          return '&#39;';
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        default:
          return character;
      }
    });
  let restored = svg;
  for (const [token, label] of [...labels].sort(([left], [right]) => right.length - left.length)) {
    restored = restored.replaceAll(token, escapeMarkup(label));
  }
  return restored;
};

export const render = async (
  config: MermaidConfig,
  code: string,
  id: string
): Promise<RenderResult> => {
  await init;

  // Should be able to call this multiple times without any issues.
  mermaid.initialize(config);
  const prepared = prepareDiagramCode(code);
  const result = await mermaid.render(id, prepared.code);
  return {
    ...result,
    svg: restorePreparedLabels(result.svg, prepared.labels)
  };
};

export const parse = async (code: string) => {
  await init;
  return await mermaid.parse(prepareDiagramCode(code).code);
};

/**
 * @see https://mermaid.js.org/config/schema-docs/config.html
 */
export const defaultMermaidConfig = mermaid.mermaidAPI.defaultConfig ?? {};

export const standardizeDiagramType = (diagramType: string) => {
  switch (diagramType) {
    case 'class':
    case 'classDiagram': {
      return 'classDiagram';
    }
    case 'graph':
    case 'flowchart':
    case 'flowchart-elk':
    case 'flowchart-v2': {
      return 'flowchart';
    }
    default: {
      return diagramType;
    }
  }
};

type DiagramDefinition = (typeof diagramData)[number];

export type SampleExample = DiagramDefinition['examples'][number];

const isValidDiagram = (diagram: DiagramDefinition): diagram is Required<DiagramDefinition> => {
  return Boolean(diagram.name && diagram.examples && diagram.examples.length > 0);
};

export const getSampleDiagrams = (): Record<string, SampleExample[]> => {
  const samples: Record<string, SampleExample[]> = {};
  for (const diagram of diagramData.filter((d) => isValidDiagram(d))) {
    // The default example comes first, so it is loaded when clicking the
    // diagram name and shown at the top of the example dropdown.
    samples[diagram.name.replace(/ (Diagram|Chart|Graph)/, '')] = [...diagram.examples].sort(
      (a, b) => Number(b.isDefault ?? false) - Number(a.isDefault ?? false)
    );
  }
  return samples;
};
