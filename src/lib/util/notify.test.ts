import { beforeEach, describe, expect, it, vi } from 'vitest';

const toastMock = vi.hoisted(() => vi.fn());

vi.mock('svelte-sonner', () => ({ toast: toastMock }));

import { enableNotifications, notify } from './notify';

describe('notify', () => {
  beforeEach(() => {
    toastMock.mockClear();
  });

  it('queues startup messages until the toaster is mounted, then delivers new messages immediately', () => {
    notify('startup message');
    notify('startup message');
    notify('second message');
    expect(toastMock).not.toHaveBeenCalled();

    enableNotifications();
    expect(toastMock.mock.calls).toEqual([['startup message'], ['second message']]);

    notify('runtime message');
    enableNotifications();
    expect(toastMock.mock.calls).toEqual([
      ['startup message'],
      ['second message'],
      ['runtime message']
    ]);
  });
});
