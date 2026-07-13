import type { VisualConnection } from '$lib/types';
import { describe, expect, it } from 'vitest';
import {
  anchorPointsForRect,
  connectionLaneOffsets,
  createVisualConnection,
  findConnectionSnapCandidate,
  normalizeVisualConnections,
  reverseVisualConnection
} from './visualConnections';

describe('visualConnections', () => {
  it('creates all eight rectangular anchors in stable order', () => {
    expect(anchorPointsForRect('node-a', { bottom: 80, left: 10, right: 110, top: 20 })).toEqual([
      { anchor: 'top-left', elementId: 'node-a', x: 10, y: 20 },
      { anchor: 'top', elementId: 'node-a', x: 60, y: 20 },
      { anchor: 'top-right', elementId: 'node-a', x: 110, y: 20 },
      { anchor: 'right', elementId: 'node-a', x: 110, y: 50 },
      { anchor: 'bottom-right', elementId: 'node-a', x: 110, y: 80 },
      { anchor: 'bottom', elementId: 'node-a', x: 60, y: 80 },
      { anchor: 'bottom-left', elementId: 'node-a', x: 10, y: 80 },
      { anchor: 'left', elementId: 'node-a', x: 10, y: 50 }
    ]);
  });

  it('chooses the nearest anchor and retains the current anchor inside hysteresis', () => {
    const anchors = anchorPointsForRect('node-a', { bottom: 100, left: 0, right: 100, top: 0 });
    expect(findConnectionSnapCandidate({ x: 98, y: 48 }, anchors, 14)?.anchor).toBe('right');
    expect(
      findConnectionSnapCandidate({ x: 92, y: 42 }, anchors, 14, {
        anchor: 'right',
        elementId: 'node-a'
      })?.anchor
    ).toBe('right');
    expect(findConnectionSnapCandidate({ x: 70, y: 50 }, anchors, 14)).toBeUndefined();
    expect(
      findConnectionSnapCandidate({ x: 82, y: 50 }, anchors, 14, {
        anchor: 'right',
        elementId: 'node-a'
      })?.anchor
    ).toBe('right');
  });

  it('switches away from a retained anchor when another point is clearly closer', () => {
    const anchors = [
      ...anchorPointsForRect('node-a', { bottom: 100, left: 0, right: 100, top: 0 }),
      ...anchorPointsForRect('node-b', { bottom: 100, left: 108, right: 208, top: 0 })
    ];
    expect(
      findConnectionSnapCandidate({ x: 108, y: 50 }, anchors, 14, {
        anchor: 'right',
        elementId: 'node-a'
      })
    ).toMatchObject({ anchor: 'left', elementId: 'node-b' });
  });

  it('normalizes old and malformed connection data without rejecting the diagram', () => {
    const normalized = normalizeVisualConnections({
      'connection-valid': {
        direction: 'unexpected',
        id: 'connection-valid',
        label: 42,
        lineStyle: 'dashed',
        source: { anchor: 'right', elementId: 'a', x: 10, y: 20 },
        strokeWidth: 99,
        target: { x: 80, y: 90 }
      },
      broken: { source: { x: 'bad', y: 0 }, target: { x: 1, y: 2 } }
    });
    expect(normalized).toEqual({
      'connection-valid': {
        direction: 'forward',
        id: 'connection-valid',
        label: '关系',
        lineStyle: 'dashed',
        source: { anchor: 'right', elementId: 'a', x: 10, y: 20 },
        strokeWidth: 8,
        target: { x: 80, y: 90 }
      }
    });
  });

  it('reverses a connection without mutating its endpoints', () => {
    const connection = createVisualConnection(
      { anchor: 'right', elementId: 'a', x: 10, y: 20 },
      { anchor: 'left', elementId: 'b', x: 80, y: 20 },
      'connection-test'
    );
    const reversed = reverseVisualConnection(connection);
    expect(reversed.source.elementId).toBe('b');
    expect(reversed.target.elementId).toBe('a');
    expect(connection.source.elementId).toBe('a');
  });

  it('uses editable defaults for a new connection', () => {
    const connection: VisualConnection = createVisualConnection(
      { x: 0, y: 0 },
      { x: 100, y: 50 },
      'connection-default'
    );
    expect(connection).toMatchObject({
      direction: 'forward',
      id: 'connection-default',
      label: '关系',
      lineStyle: 'solid',
      strokeWidth: 2
    });
  });

  it('assigns stable centered lanes to parallel and reversed connections', () => {
    const source = { anchor: 'right' as const, elementId: 'a', x: 10, y: 20 };
    const target = { anchor: 'left' as const, elementId: 'b', x: 80, y: 20 };
    const connections = [
      createVisualConnection(source, target, 'connection-b'),
      createVisualConnection(target, source, 'connection-a'),
      createVisualConnection(source, target, 'connection-c')
    ];

    expect(connectionLaneOffsets(connections)).toEqual({
      'connection-a': -12,
      'connection-b': 0,
      'connection-c': 12
    });
  });
});
