import {
  historyState,
  saveManualEntry,
  stateKey,
  type ManualSaveResult
} from '$lib/components/History/historyState.svelte';
import { notify } from '$lib/util/notify';
import { inputState } from '$lib/util/state.svelte';

export type WorkspaceSaveResult = ManualSaveResult | 'busy';
export type WorkspaceSaveStatus = 'error' | 'idle' | 'saved' | 'saving';

let status = $state<WorkspaceSaveStatus>('idle');
let lastSavedAt = $state<number>();
let inFlight: Promise<WorkspaceSaveResult> | undefined;

export const workspaceSaveState = {
  get hasUnsavedChanges(): boolean {
    const latest = historyState.manualEntries[0];
    return !latest || stateKey(latest.state) !== stateKey(inputState);
  },
  get isSaving(): boolean {
    return status === 'saving';
  },
  get lastSavedAt(): number | undefined {
    return lastSavedAt;
  },
  get status(): WorkspaceSaveStatus {
    return status;
  }
};

export const saveCurrentWorkspace = (): Promise<WorkspaceSaveResult> => {
  if (inFlight) return Promise.resolve('busy');
  status = 'saving';
  inFlight = Promise.resolve()
    .then(() => saveManualEntry($state.snapshot(inputState)))
    .then((result): WorkspaceSaveResult => {
      if (result === 'failed') {
        status = 'error';
      } else {
        status = 'saved';
        lastSavedAt = Date.now();
      }
      return result;
    })
    .catch((): WorkspaceSaveResult => {
      status = 'error';
      return 'failed';
    })
    .finally(() => {
      inFlight = undefined;
    });
  return inFlight;
};

export const saveCurrentWorkspaceWithFeedback = async (): Promise<WorkspaceSaveResult> => {
  const result = await saveCurrentWorkspace();
  if (result === 'saved') notify('已保存到当前浏览器的本机版本。');
  else if (result === 'unchanged') notify('当前内容已存在于本机版本中。');
  else if (result === 'failed') {
    notify('保存失败：浏览器存储空间不足或已被禁用。当前编辑仍保留在页面中。');
  }
  return result;
};
