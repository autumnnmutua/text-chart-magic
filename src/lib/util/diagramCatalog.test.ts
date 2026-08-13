import { describe, expect, it } from 'vitest';
import {
  diagramCatalogGroups,
  diagramCatalogItems,
  diagramOrder,
  filterDiagramCatalog
} from './diagramCatalog';

describe('diagram catalog', () => {
  it('places every available diagram in exactly one product category', () => {
    const groupedTypes = diagramCatalogGroups.flatMap(({ items }) => items.map(({ type }) => type));

    expect(new Set(groupedTypes).size).toBe(groupedTypes.length);
    expect(new Set(groupedTypes)).toEqual(new Set(diagramOrder));
    expect(diagramCatalogItems).toHaveLength(diagramOrder.length);
  });

  it('searches labels, examples and capability profiles', () => {
    expect(
      filterDiagramCatalog('类图').flatMap(({ items }) => items.map(({ type }) => type))
    ).toEqual(['Class']);
    expect(
      filterDiagramCatalog('自由布局').flatMap(({ items }) => items.map(({ type }) => type))
    ).toEqual(expect.arrayContaining(['Architecture', 'Block', 'C4']));
    expect(filterDiagramCatalog('不存在的图表')).toEqual([]);
  });
});
