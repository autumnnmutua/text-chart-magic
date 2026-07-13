import { describe, expect, it } from 'vitest';
import { buildVisualDocument } from './visualElementModel';

describe('visual document model', () => {
  it('includes fixed-layout text and merges duplicate rendered labels into one logical item', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.innerHTML = `
      <text data-style-id="actor-bottom">张三</text>
      <text data-style-id="actor-top">张三</text>
      <text data-style-id="message">提交申请</text>
      <line data-style-id="message-line"></line>
    `;
    const code = `sequenceDiagram
  participant A as 张三
  A->>B: 提交申请`;

    const items = buildVisualDocument(svg, code);

    expect(items.map(({ label }) => label)).toEqual(['张三', '提交申请', '连线']);
    expect(svg.querySelectorAll('[data-visual-id]').length).toBe(4);
    expect(svg.querySelectorAll('text')[0].getAttribute('data-visual-id')).toBe(
      svg.querySelectorAll('text')[1].getAttribute('data-visual-id')
    );
    expect(items.find(({ label }) => label === '连线')?.canDelete).toBe(false);
  });

  it('derives flowchart subgraph hierarchy from source semantics', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.innerHTML = `
      <g class="cluster" data-style-id="G"><text>Group</text></g>
      <g class="node" id="flowchart-A-0" data-style-id="A"><text>Child</text></g>
    `;
    const items = buildVisualDocument(
      svg,
      'flowchart TB\n  subgraph G["Group"]\n    A["Child"]\n  end'
    );

    expect(items.find(({ sourceId }) => sourceId === 'A')?.parentId).toBe(
      items.find(({ sourceId }) => sourceId === 'G')?.id
    );
  });

  it('maps C4 boundary titles to their source alias and nests contained elements', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.innerHTML = `
      <text data-style-id="text-1">Order system</text>
      <g data-c4-id="api"><text>&lt;&lt;container&gt;&gt;</text><text>API</text></g>
    `;
    const items = buildVisualDocument(
      svg,
      `C4Container
  System_Boundary(order, "Order system") {
    Container(api, "API", "Node", "Service")
  }`
    );
    const boundary = items.find(({ sourceId }) => sourceId === 'order');
    const child = items.find(({ sourceId }) => sourceId === 'api');

    expect(boundary?.kind).toBe('container');
    expect(child?.label).toBe('API');
    expect(child?.parentId).toBe(boundary?.id);
  });
});
