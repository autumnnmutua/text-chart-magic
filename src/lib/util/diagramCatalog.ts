import { localizedDiagramSamples } from './diagramSamples';
import { investorSamples, type InvestorSample } from './investorSamples';
import { getSampleDiagrams, type SampleExample } from './mermaid';

export const diagramLabels: Record<string, string> = {
  Architecture: '架构图',
  Block: '块图',
  C4: 'C4',
  Class: '类图',
  'Entity Relationship': '实体关系',
  Flowchart: '流程图',
  Gantt: '甘特图',
  Git: 'Git 图',
  Ishikawa: '鱼骨图',
  Kanban: '看板',
  Mindmap: '思维导图',
  Packet: '数据包',
  Pie: '饼图',
  Quadrant: '象限图',
  Radar: '雷达图',
  Requirement: '需求图',
  Sankey: '桑基图',
  Sequence: '时序图',
  State: '状态图',
  Timeline: '时间线',
  TreeView: '树图',
  Treemap: '矩形树图',
  'User Journey': '用户旅程',
  Venn: '维恩图',
  'Wardley Maps': '沃德利地图',
  XY: 'XY 图',
  ZenUML: 'ZenUML'
};

export const diagramSamples: Record<string, SampleExample[]> = {
  ...getSampleDiagrams(),
  ...localizedDiagramSamples
};

const mainDiagrams = ['Flowchart', 'Class', 'Sequence', 'Entity Relationship', 'State', 'Mindmap'];

export const diagramOrder = [
  ...mainDiagrams,
  ...Object.keys(diagramSamples)
    .filter((key) => !mainDiagrams.includes(key))
    .sort()
];

export type DiagramCategoryId = 'advanced' | 'data' | 'flow' | 'knowledge' | 'software' | 'time';

export interface DiagramCatalogItem {
  capabilities: string[];
  category: DiagramCategoryId;
  examples: SampleExample[];
  label: string;
  profile: string;
  type: string;
}

export interface DiagramCatalogGroup {
  id: DiagramCategoryId;
  items: DiagramCatalogItem[];
  label: string;
}

const categoryDefinitions: {
  id: DiagramCategoryId;
  label: string;
  types: string[];
}[] = [
  {
    id: 'flow',
    label: '流程与决策',
    types: ['Flowchart', 'State', 'Kanban', 'User Journey', 'Ishikawa']
  },
  {
    id: 'knowledge',
    label: '结构与知识',
    types: ['Mindmap', 'TreeView', 'Treemap', 'Venn', 'Requirement']
  },
  {
    id: 'software',
    label: '软件与系统',
    types: ['Architecture', 'C4', 'Class', 'Entity Relationship', 'Sequence', 'ZenUML', 'Git']
  },
  {
    id: 'time',
    label: '计划与时间',
    types: ['Gantt', 'Timeline']
  },
  {
    id: 'data',
    label: '数据与比较',
    types: ['Pie', 'Radar', 'Quadrant', 'XY', 'Sankey']
  },
  {
    id: 'advanced',
    label: '专业图表',
    types: ['Block', 'Packet', 'Wardley Maps']
  }
];

const categoryByType = new Map(
  categoryDefinitions.flatMap(({ id, types }) => types.map((type) => [type, id] as const))
);
const freeLayoutTypes = new Set(['Architecture', 'Block', 'C4']);
const coordinateTypes = new Set(['Quadrant', 'User Journey', 'Wardley Maps']);
const structuredTypes = new Set([
  'Gantt',
  'Git',
  'Kanban',
  'Packet',
  'Sankey',
  'Sequence',
  'Timeline',
  'ZenUML'
]);

const profileFor = (type: string): string => {
  if (freeLayoutTypes.has(type)) return '自由布局';
  if (coordinateTypes.has(type)) return '坐标交互';
  if (structuredTypes.has(type)) return '专业结构';
  return '代码与分支';
};

const capabilitiesFor = (type: string): string[] => {
  const capabilities = ['文字编辑', '分支扩展'];
  if (freeLayoutTypes.has(type)) capabilities.push('自由移动');
  if (coordinateTypes.has(type)) capabilities.push('位置拖动');
  if (structuredTypes.has(type)) capabilities.push('专用操作');
  return capabilities;
};

export const diagramCatalogItems: DiagramCatalogItem[] = diagramOrder.map((type) => ({
  capabilities: capabilitiesFor(type),
  category: categoryByType.get(type) ?? 'advanced',
  examples: diagramSamples[type],
  label: diagramLabels[type] ?? type,
  profile: profileFor(type),
  type
}));

export const diagramCatalogGroups: DiagramCatalogGroup[] = categoryDefinitions
  .map(({ id, label }) => ({
    id,
    items: diagramCatalogItems.filter((item) => item.category === id),
    label
  }))
  .filter(({ items }) => items.length > 0);

export const filterDiagramCatalog = (query: string): DiagramCatalogGroup[] => {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return diagramCatalogGroups;
  return diagramCatalogGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        [
          item.label,
          item.type,
          item.profile,
          ...item.capabilities,
          ...item.examples.map(({ title }) => title)
        ]
          .join(' ')
          .toLocaleLowerCase()
          .includes(needle)
      )
    }))
    .filter(({ items }) => items.length > 0);
};

export { investorSamples };
export type { InvestorSample, SampleExample };
