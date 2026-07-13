import { describe, expect, it } from 'vitest';
import { findArchitectureEdgePath } from './architectureFreeLayout';

describe('architectureFreeLayout', () => {
  it('prefers the exact directed edge when both directions exist', () => {
    const paths = [{ id: 'L_api_web_0' }, { id: 'L_web_api_0' }];

    expect(findArchitectureEdgePath(paths, 'api', 'web')?.id).toBe('L_api_web_0');
    expect(findArchitectureEdgePath(paths, 'web', 'api')?.id).toBe('L_web_api_0');
  });

  it('keeps the reverse-id fallback for renderer variants', () => {
    const paths = [{ id: 'prefix-L_database_api_2-suffix' }];

    expect(findArchitectureEdgePath(paths, 'api', 'database')?.id).toBe(
      'prefix-L_database_api_2-suffix'
    );
  });
});
