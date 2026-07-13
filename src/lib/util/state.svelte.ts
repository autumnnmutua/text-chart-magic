import type {
  ErrorHash,
  MarkerData,
  State,
  ValidatedState,
  VisualLayerState,
  VisualStyle
} from '$/types';
import { replaceState as replaceNavigationState } from '$app/navigation';
import { get as lodashGet } from 'lodash-es';
import type { MermaidConfig } from 'mermaid';
import { untrack } from 'svelte';
import {
  extractErrorLineText,
  findMostRelevantLineNumber,
  replaceLineNumberInErrorMessage
} from './errorHandling';
import { defaultMermaidConfig, parse } from './mermaid';
import {
  createBlockArrowCode,
  createDiagramBranch,
  createDiagramBranchCode,
  getDiagramKeyword,
  moveTimelinePeriodCode,
  resizePacketFieldCode,
  type DiagramBranchRequest,
  type PacketFieldSize
} from './diagramBranch';
import { diagramStateKey } from './diagramStateKey';
import { notify } from './notify';
import { readJSON, writeJSON } from './persist.svelte';
import { deserializeState, serializeState } from './serde';
import {
  removeDiagramElementCode,
  replaceDiagramVisualText,
  replaceVisualText,
  type SourceTextRange,
  type VisualTextTarget
} from './visualTextEdit';

const formatJSON = (data: unknown): string => JSON.stringify(data, undefined, 2);

const mermaidFontFamily =
  '"Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", "Recursive Variable", sans-serif';

const lightThemeVariables = {
  background: '#fff7ed',
  fontFamily: mermaidFontFamily,
  lineColor: '#ea580c',
  mainBkg: '#fff7ed',
  nodeBorder: '#f97316',
  primaryBorderColor: '#f97316',
  primaryColor: '#ffedd5',
  primaryTextColor: '#431407',
  secondaryBorderColor: '#fb923c',
  secondaryColor: '#ffffff',
  tertiaryColor: '#fed7aa'
};

const darkThemeVariables = {
  background: '#1c120d',
  fontFamily: mermaidFontFamily,
  lineColor: '#fdba74',
  mainBkg: '#2b1a12',
  nodeBorder: '#fb923c',
  primaryBorderColor: '#fb923c',
  primaryColor: '#3a2116',
  primaryTextColor: '#fff7ed',
  secondaryBorderColor: '#f97316',
  secondaryColor: '#24140e',
  tertiaryColor: '#4a2a18'
};

export const defaultState: State = {
  code: `flowchart TD
    A[输入中文想法] -->|实时解析| B(生成图表)
    B --> C{选择下一步}
    C -->|继续编辑| D[中文节点和连线]
    C -->|切换主题| E[橙白配色预览]
    C -->|导出文件| F[PNG / SVG 文件]
  `,
  grid: true,
  mermaid: formatJSON({
    flowchart: {
      nodeSpacing: 80,
      rankSpacing: 90
    },
    theme: 'default',
    themeVariables: lightThemeVariables
  }),
  panZoom: true,
  rough: false,
  snapToGrid: true,
  updateDiagram: true
};

const urlParseFailedState = `flowchart TD
    A[链接读取失败] -->|重新检查| B[请确认链接是否完整]
    B --> C{这个链接是别人发给你的吗}
    C -->|是| D[请对方重新发送完整链接]
    C -->|不是| E[回到编辑器重新创建图表]
    E --> F[可继续编辑和导出文件]`;

const CODE_STORE_KEY = 'codeStore';
const DIAGRAM_INITIAL_STORE_KEY = 'diagramInitialStore';

const isFinitePoint = (value: unknown): value is NonNullable<State['pan']> => {
  if (!value || typeof value !== 'object') return false;
  const point = value as Record<string, unknown>;
  return (
    typeof point.x === 'number' &&
    Number.isFinite(point.x) &&
    typeof point.y === 'number' &&
    Number.isFinite(point.y)
  );
};

const normalizeVisualPositions = (value: unknown): State['visualPositions'] => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const positions: NonNullable<State['visualPositions']> = {};
  for (const [id, point] of Object.entries(value)) {
    if (id && isFinitePoint(point)) {
      // Copy numeric fields explicitly so Svelte proxies never reach structuredClone/storage.
      positions[id] = { x: point.x, y: point.y };
    }
  }
  return Object.keys(positions).length > 0 ? positions : undefined;
};

const normalizeVisualStyles = (value: unknown): State['visualStyles'] => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const styles: NonNullable<State['visualStyles']> = {};
  for (const [id, rawStyle] of Object.entries(value)) {
    if (!id || !rawStyle || typeof rawStyle !== 'object' || Array.isArray(rawStyle)) continue;
    const candidate = rawStyle as Record<string, unknown>;
    const style: NonNullable<State['visualStyles']>[string] = {};
    if (typeof candidate.fill === 'string') style.fill = candidate.fill;
    if (typeof candidate.stroke === 'string') style.stroke = candidate.stroke;
    if (typeof candidate.text === 'string') style.text = candidate.text;
    if (typeof candidate.alpha === 'number' && Number.isFinite(candidate.alpha)) {
      style.alpha = Math.min(Math.max(candidate.alpha, 0), 1);
    }
    if (Object.keys(style).length > 0) styles[id] = style;
  }
  return Object.keys(styles).length > 0 ? styles : undefined;
};

const normalizeVisualLayers = (value: unknown): State['visualLayers'] => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const layers: NonNullable<State['visualLayers']> = {};
  for (const [id, rawLayer] of Object.entries(value)) {
    if (!id || !rawLayer || typeof rawLayer !== 'object' || Array.isArray(rawLayer)) continue;
    const candidate = rawLayer as Record<string, unknown>;
    const layer: VisualLayerState = {};
    if (typeof candidate.hidden === 'boolean') layer.hidden = candidate.hidden;
    if (typeof candidate.locked === 'boolean') layer.locked = candidate.locked;
    if (typeof candidate.zIndex === 'number' && Number.isFinite(candidate.zIndex)) {
      layer.zIndex = Math.trunc(candidate.zIndex);
    }
    if (Object.keys(layer).length > 0) layers[id] = layer;
  }
  return Object.keys(layers).length > 0 ? layers : undefined;
};

/**
 * Fills fields that did not exist in older saved links or localStorage data.
 * Unknown optional fields are retained so newer data can still round-trip.
 */
export const normalizeState = (value: unknown): State => {
  const candidate =
    value && typeof value === 'object' ? (value as Partial<State>) : ({} as Partial<State>);
  const normalized: State = {
    ...defaultState,
    ...candidate,
    code: typeof candidate.code === 'string' ? candidate.code : defaultState.code,
    mermaid: typeof candidate.mermaid === 'string' ? candidate.mermaid : defaultState.mermaid,
    rough: typeof candidate.rough === 'boolean' ? candidate.rough : defaultState.rough,
    updateDiagram:
      typeof candidate.updateDiagram === 'boolean'
        ? candidate.updateDiagram
        : defaultState.updateDiagram
  };

  normalized.grid = typeof candidate.grid === 'boolean' ? candidate.grid : defaultState.grid;
  normalized.snapToGrid = typeof candidate.snapToGrid === 'boolean' ? candidate.snapToGrid : true;
  normalized.panZoom =
    typeof candidate.panZoom === 'boolean' ? candidate.panZoom : defaultState.panZoom;
  normalized.editorMode = candidate.editorMode === 'config' ? 'config' : 'code';

  if (!isFinitePoint(candidate.pan)) delete normalized.pan;
  if (typeof candidate.zoom !== 'number' || !Number.isFinite(candidate.zoom)) {
    delete normalized.zoom;
  }
  normalized.visualPositions = normalizeVisualPositions(candidate.visualPositions);
  normalized.visualStyles = normalizeVisualStyles(candidate.visualStyles);
  normalized.visualLayers = normalizeVisualLayers(candidate.visualLayers);
  if (!normalized.visualPositions) delete normalized.visualPositions;
  if (!normalized.visualStyles) delete normalized.visualStyles;
  if (!normalized.visualLayers) delete normalized.visualLayers;
  return normalized;
};

// The single mutable input state; only update() below may write to it.
// The fallback is cloned so mutations never write through to defaultState.
const input = $state<State>(normalizeState(readJSON<unknown>(CODE_STORE_KEY, defaultState)));

interface StoredDiagramInitial {
  diagramType: string;
  state: State;
}

const readStoredDiagramInitial = (): StoredDiagramInitial | undefined => {
  const value = readJSON<unknown>(DIAGRAM_INITIAL_STORE_KEY, undefined);
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Partial<StoredDiagramInitial>;
  if (
    typeof candidate.diagramType !== 'string' ||
    !candidate.state ||
    typeof candidate.state !== 'object' ||
    typeof (candidate.state as Partial<State>).code !== 'string'
  ) {
    return undefined;
  }
  const state = normalizeState(candidate.state);
  delete state.pan;
  delete state.zoom;
  const diagramType = candidate.diagramType || getDiagramKeyword(state.code);
  return diagramType ? { diagramType, state } : undefined;
};

// inputState is shared externally when exporting via URL, History, etc.
// It is reactive for reads; the read-only type keeps writes inside this
// module, where update() persists and re-validates every change.
export const inputState: Readonly<State> = input;

const validatedStateOf = (state: State, serialized: string): ValidatedState => ({
  ...state,
  editorMode: state.editorMode ?? 'code',
  error: undefined,
  errorMarkers: [],
  serialized
});

const initialState = $state.snapshot(input) as State;
// Only ever replaced wholesale, so raw (shallow) reactivity is enough.
let validatedCurrent = $state.raw<ValidatedState>(
  validatedStateOf(initialState, serializeState(initialState))
);

const undoStack = $state<State[]>([]);
const redoStack = $state<State[]>([]);
const MAX_UNDO_STEPS = 30;
const TYPING_UNDO_WINDOW_MS = 1200;
let lastUndoSource = '';
let lastUndoAt = 0;
let lastValidState: State | undefined = structuredClone(initialState);
const storedDiagramInitial = readStoredDiagramInitial();
let currentDiagramInitialState: State | undefined = storedDiagramInitial?.state;
let currentDiagramInitialType = storedDiagramInitial?.diagramType ?? '';
let captureNextValidAsInitial = !storedDiagramInitial;
let processRevision = 0;
let invalidRollbackTimer: ReturnType<typeof setTimeout> | undefined;
const INVALID_ROLLBACK_DELAY_MS = 1200;

const processState = async (state: State) => {
  const processed = validatedStateOf(state, '');
  // No changes should be done to fields part of `state`.
  try {
    processed.serialized = serializeState(state);
    const { diagramType } = await parse(state.code);
    processed.diagramType = diagramType;
    JSON.parse(state.mermaid);
  } catch (error) {
    processed.error = error as Error;
    console.error(error);
    if (error && typeof error === 'object' && 'hash' in error) {
      try {
        let errorString = processed.error.toString();
        const errorLineText = extractErrorLineText(errorString);
        const realLineNumber = findMostRelevantLineNumber(errorLineText, state.code);

        let first_line: number, last_line: number, first_column: number, last_column: number;
        try {
          ({ first_line, last_line, first_column, last_column } = (error.hash as ErrorHash).loc);
        } catch {
          const lineNo = findMostRelevantLineNumber(errorString, state.code);
          first_line = lineNo;
          last_line = lineNo + 1;
          first_column = 0;
          last_column = 0;
        }

        const markerLineNumber = realLineNumber === -1 ? Math.max(first_line, 1) : realLineNumber;
        if (realLineNumber !== -1) {
          errorString = replaceLineNumberInErrorMessage(errorString, realLineNumber);
        }

        processed.error = new Error(errorString);
        const marker: MarkerData = {
          endColumn: last_column + (first_column === last_column ? 0 : 5),
          endLineNumber: Math.max(markerLineNumber, last_line + (markerLineNumber - first_line)),
          message: errorString || '语法错误',
          severity: 8, // Error
          startColumn: first_column,
          startLineNumber: markerLineNumber
        };
        processed.errorMarkers = [marker];
      } catch (error) {
        console.error('Error without line helper', error);
      }
    }
  }
  return processed;
};

// Replaces the old URL-hash store subscription; assigned by initURLSubscription.
let updateHash: ((serialized: string) => void) | undefined;

// Persist the current input state and asynchronously re-validate it,
// publishing the result to `validatedState` (and the URL hash, once
// initURLSubscription has run). Only called from update(), which suppresses
// dependency tracking.
const processSnapshot = (snapshot: State): void => {
  if (invalidRollbackTimer) clearTimeout(invalidRollbackTimer);
  invalidRollbackTimer = undefined;
  const revision = ++processRevision;
  void processState(snapshot).then((processed) => {
    if (revision !== processRevision) return;
    if (processed.error) {
      if (shouldRollbackInvalidState(snapshot)) {
        restoreLastValidState();
        return;
      }
      if (lastValidState && snapshot.code !== lastValidState.code) {
        invalidRollbackTimer = setTimeout(() => {
          invalidRollbackTimer = undefined;
          if (input.code === snapshot.code) restoreLastValidState();
        }, INVALID_ROLLBACK_DELAY_MS);
      }
    }
    validatedCurrent = processed;
    updateHash?.(processed.serialized);
    if (!processed.error) {
      rememberValidState(snapshot, processed.diagramType);
    }
  });
};

const persistAndProcess = (): void => {
  const snapshot = $state.snapshot(input) as State;
  writeJSON(CODE_STORE_KEY, snapshot);
  processSnapshot(snapshot);
};

// The single mutation gateway: every update function funnels its writes
// through here. The mutator runs untracked so effects that call an update
// function never subscribe to the input state it reads, and the trailing
// persist + re-validate cannot be forgotten by a new update function.
const update = (mutate: (state: State) => void): void => {
  untrack(() => {
    mutate(input);
    persistAndProcess();
  });
};

// All internal reads should be done via validatedState, but it should not be
// persisted/shared externally.
export const validatedState = {
  get current(): ValidatedState {
    return validatedCurrent;
  }
};

export const canUndoEdit = {
  get current(): boolean {
    return undoStack.length > 0;
  }
};

export const canRedoEdit = {
  get current(): boolean {
    return redoStack.length > 0;
  }
};

/**
 * Gets a list of paths that contain unsafe keys which might pose security risks.
 *
 * @param object - The object to check for unsafe keys.
 * @param unsafeKeys - List of unsafe keys.
 * @param path - The current path being checked (used for recursion).
 * @returns List of unsafe paths.
 */
function getUnsafePaths(object: object, unsafeKeys: string[], path: string[] = []) {
  const unsafePaths = new Array<string[]>();
  for (const key of unsafeKeys) {
    // Copied from mermaid's sanitize function in case there's non-enumerable keys
    if (Object.hasOwn(object, key)) {
      unsafePaths.push([...path, key]);
      continue;
    }
  }
  Object.keys(object).forEach((key) => {
    const value = (object as Record<string, unknown>)[key];
    const currentPath = [...path, key];
    // Prototype pollution check.
    if (key.startsWith('__')) {
      unsafePaths.push(currentPath);
      return;
    }
    if (typeof value === 'object' && value !== null) {
      unsafePaths.push(...getUnsafePaths(value as object, unsafeKeys, currentPath));
    } else if (
      typeof value === 'string' &&
      // XSS prevention checks -- See mermaid `sanitize` function for reference.
      (value.includes('<') || value.includes('>') || value.includes('url(data:'))
    ) {
      unsafePaths.push(currentPath);
    }
  });
  return unsafePaths;
}

/**
 * Asks the user for confirmation if the config contains settings that might
 * pose security risks, such as a relaxed `securityLevel`.
 *
 * @param config - The Mermaid configuration to sanitize.
 * @returns The sanitized Mermaid configuration as a JSON string.
 */
export const sanitizeConfig = (config: string | MermaidConfig) => {
  const mermaidConfig: MermaidConfig =
    typeof config === 'string' ? (JSON.parse(config) as MermaidConfig) : config;

  const secureKeys = defaultMermaidConfig.secure ?? [];
  const unsafePaths = getUnsafePaths(mermaidConfig, secureKeys).filter((path) => {
    return lodashGet(mermaidConfig, path) !== lodashGet(defaultMermaidConfig, path);
  });

  if (
    unsafePaths.length > 0 &&
    confirm(
      `为了安全，编辑器将移除以下高风险配置：\n${unsafePaths
        .map((unsafePath) => {
          return `${JSON.stringify(unsafePath.join('.'))}: ${JSON.stringify(lodashGet(mermaidConfig, unsafePath))}`;
        })
        .join(',\n')}\n如果你完全信任这个图表来源，可以点击取消并保留原配置。`
    )
  ) {
    for (const unsafePath of unsafePaths) {
      const pathToObject = [...unsafePath];
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- We know this exists since it was found in `getUnsafePaths`
      const lastKey = pathToObject.pop()!;
      const lastObject =
        pathToObject.length === 0 ? mermaidConfig : lodashGet(mermaidConfig, pathToObject);
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- Copied from mermaid code
      delete lastObject[lastKey];
    }
  }
  return formatJSON(mermaidConfig);
};

export const loadState = (data: string): void => {
  update((state) => {
    clearUndoStack();
    if (!data) return;
    let next: State;
    try {
      next = normalizeState(deserializeState(data));
      next.mermaid = sanitizeConfig(next.mermaid || defaultState.mermaid);
    } catch (error) {
      next = $state.snapshot(state) as State;
      if (data) {
        console.error('Init error', error);
        next.code = urlParseFailedState;
        next.mermaid = defaultState.mermaid;
      }
    }
    if (diagramStateKey(state) !== diagramStateKey(next)) {
      captureNextValidAsInitial = true;
    }
    replaceStateData(state, next);
  });
};

let renderCount = 0;
const undoableStoreKeys = [
  'code',
  'mermaid',
  'grid',
  'rough',
  'snapToGrid',
  'visualLayers',
  'visualStyles',
  'visualPositions'
] satisfies (keyof State)[];
const applyPartial = (state: State, newState: Partial<State>): void => {
  renderCount++;
  Object.assign(state, newState, { renderCount });
};

const replaceStateData = (state: State, next: State): void => {
  for (const key of Object.keys(state)) {
    if (!(key in next)) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- full-replace semantics
      delete (state as unknown as Record<string, unknown>)[key];
    }
  }
  applyPartial(state, next);
};

const cloneState = (state: State): State => structuredClone(state);

const rememberValidState = (snapshot: State, diagramType = ''): void => {
  const nextValid = cloneState(snapshot);
  const stableDiagramType = diagramType || getDiagramKeyword(snapshot.code);
  lastValidState = nextValid;
  if (
    captureNextValidAsInitial ||
    !currentDiagramInitialState ||
    (stableDiagramType && stableDiagramType !== currentDiagramInitialType)
  ) {
    currentDiagramInitialState = cloneState({
      ...nextValid,
      pan: undefined,
      updateDiagram: true,
      zoom: undefined
    });
    currentDiagramInitialType = stableDiagramType;
    writeJSON(DIAGRAM_INITIAL_STORE_KEY, {
      diagramType: currentDiagramInitialType,
      state: currentDiagramInitialState
    } satisfies StoredDiagramInitial);
    captureNextValidAsInitial = false;
  }
};

const restoreLastValidState = (): void => {
  if (!lastValidState) {
    return;
  }
  const validState = cloneState(lastValidState);
  notify('这次修改有语法问题，已恢复到修改前的状态。');
  untrack(() => {
    const restored = cloneState({
      ...validState,
      updateDiagram: true
    });
    replaceStateData(input, restored);
    const snapshot = cloneState($state.snapshot(input) as State);
    writeJSON(CODE_STORE_KEY, snapshot);
    processSnapshot(snapshot);
  });
};

const shouldRollbackInvalidState = (snapshot: State): boolean => {
  if (!lastValidState || snapshot.code === lastValidState.code) {
    return false;
  }
  return snapshot.updateDiagram;
};

export const updateCodeStore = (newState: Partial<State>): void => {
  update((state) => {
    const shouldRecordUndo =
      undoableStoreKeys.some((key) => key in newState) &&
      diagramStateKey(state) !== diagramStateKey({ ...state, ...newState });
    if (shouldRecordUndo) {
      pushUndoFor(state, 'state');
    }
    applyPartial(state, newState);
  });
};

export const updateCode = (
  code: string,
  { updateDiagram = false }: { updateDiagram?: boolean } = {}
): void => {
  update((state) => {
    if (state.code !== code) {
      pushUndoFor(state, 'code', { coalesce: true });
    }
    const currentDiagramType = getDiagramKeyword(state.code);
    const nextDiagramType = getDiagramKeyword(code);
    if (currentDiagramType && nextDiagramType && currentDiagramType !== nextDiagramType) {
      delete state.pan;
      delete state.zoom;
    }
    state.code = code;
    state.updateDiagram = updateDiagram;
  });
};

export const cancelCodeEdit = (code: string, { updateDiagram = true } = {}): void => {
  update((state) => {
    if (undoStack.at(-1)?.code === code) {
      undoStack.pop();
    }
    state.code = code;
    state.updateDiagram = updateDiagram;
  });
};

const pushStateToStack = (stack: State[], snapshot: State): void => {
  stack.push(snapshot);
  if (stack.length > MAX_UNDO_STEPS) {
    stack.shift();
  }
};

const pushUndoState = (state: State): boolean => {
  const snapshot = $state.snapshot(state) as State;
  const last = undoStack.at(-1);
  if (last && diagramStateKey(last) === diagramStateKey(snapshot)) {
    return false;
  }
  pushStateToStack(undoStack, snapshot);
  return true;
};

const pushUndoFor = (
  state: State,
  source:
    | 'branch'
    | 'arrow'
    | 'batch'
    | 'code'
    | 'color'
    | 'config'
    | 'delete'
    | 'interaction'
    | 'layer'
    | 'replace'
    | 'reset'
    | 'resize'
    | 'sort'
    | 'state'
    | 'theme',
  { coalesce = false }: { coalesce?: boolean } = {}
): void => {
  const now = Date.now();
  if (coalesce && lastUndoSource === source && now - lastUndoAt < TYPING_UNDO_WINDOW_MS) {
    lastUndoAt = now;
    return;
  }
  if (pushUndoState(state)) {
    redoStack.length = 0;
  }
  lastUndoSource = source;
  lastUndoAt = now;
};

const clearUndoStack = (): void => {
  undoStack.length = 0;
  redoStack.length = 0;
  lastUndoSource = '';
  lastUndoAt = 0;
};

const restoreSnapshot = (state: State, snapshot: State): void => {
  const { pan, zoom } = state;
  const restored: State = {
    ...snapshot,
    updateDiagram: true
  };
  if (pan) restored.pan = pan;
  else delete restored.pan;
  if (zoom !== undefined) restored.zoom = zoom;
  else delete restored.zoom;
  replaceStateData(state, restored);
};

const optimizeFlowchartLayout = (state: State): void => {
  try {
    const config = JSON.parse(state.mermaid) as MermaidConfig;
    config.flowchart = {
      ...config.flowchart,
      nodeSpacing: Math.max(Number(config.flowchart?.nodeSpacing) || 0, 80),
      rankSpacing: Math.max(Number(config.flowchart?.rankSpacing) || 0, 90)
    };
    state.mermaid = formatJSON(config);
  } catch {
    // Keep the user's current config untouched if it is not valid JSON.
  }
};

export const addDiagramBranch = ({
  label = '',
  mode = 'branch',
  sourceId = ''
}: {
  label?: string;
  mode?: NonNullable<DiagramBranchRequest['mode']>;
  sourceId?: string;
}): boolean => {
  let didAdd = false;
  update((state) => {
    const result = createDiagramBranch({ code: state.code, label, mode, sourceId });
    if (!result) {
      return;
    }
    pushUndoFor(state, 'branch');
    state.code = result.code;
    if (result.optimizeFlowchart) {
      optimizeFlowchartLayout(state);
    }
    state.updateDiagram = true;
    if (result.notice) notify(result.notice);
    didAdd = true;
  });

  return didAdd;
};

const cleanVisualMetadata = (
  state: State,
  nextCode: string,
  removedIds: readonly string[]
): void => {
  if (state.visualStyles) {
    const remainingStyles = Object.fromEntries(
      Object.entries(state.visualStyles).filter(([id]) => !removedIds.includes(id))
    );
    if (Object.keys(remainingStyles).length > 0) state.visualStyles = remainingStyles;
    else delete state.visualStyles;
  }
  if (state.visualLayers) {
    const remainingLayers = Object.fromEntries(
      Object.entries(state.visualLayers).filter(([id]) => !removedIds.includes(id))
    );
    if (Object.keys(remainingLayers).length > 0) state.visualLayers = remainingLayers;
    else delete state.visualLayers;
  }
  if (state.visualPositions) {
    const remainingPositions = Object.fromEntries(
      Object.entries(state.visualPositions).filter(
        ([id]) =>
          !removedIds.includes(id) &&
          new RegExp(
            String.raw`(^|[^A-Za-z0-9_-])${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=[^A-Za-z0-9_-]|$)`
          ).test(nextCode)
      )
    );
    if (Object.keys(remainingPositions).length > 0) state.visualPositions = remainingPositions;
    else delete state.visualPositions;
  }
};

export const deleteDiagramElements = (targets: readonly VisualTextTarget[]): number => {
  let deletedCount = 0;
  update((state) => {
    let nextCode = state.code;
    const removedIds: string[] = [];
    const orderedTargets = [...targets].sort(
      (left, right) => (right.occurrence ?? 0) - (left.occurrence ?? 0)
    );
    for (const target of orderedTargets) {
      const candidate = removeDiagramElementCode(nextCode, target);
      if (candidate === undefined || candidate === nextCode) continue;
      nextCode = candidate;
      deletedCount += 1;
      if (target.styleId && !removedIds.includes(target.styleId)) removedIds.push(target.styleId);
      if (target.sourceId && !removedIds.includes(target.sourceId))
        removedIds.push(target.sourceId);
    }
    if (deletedCount === 0) return;
    pushUndoFor(state, targets.length > 1 ? 'batch' : 'delete');
    state.code = nextCode;
    cleanVisualMetadata(state, nextCode, removedIds);
    state.updateDiagram = true;
  });
  if (deletedCount === 0) notify('没有找到可删除的数据，请重新选择图表元素后再试。');
  return deletedCount;
};

export const deleteDiagramElement = (target: VisualTextTarget): boolean => {
  return deleteDiagramElements([target]) > 0;
};

export const addBlockArrow = (sourceLabel: string, targetLabel: string): boolean => {
  let didAdd = false;
  update((state) => {
    const nextCode = createBlockArrowCode(state.code, sourceLabel, targetLabel);
    if (!nextCode || nextCode === state.code) return;
    pushUndoFor(state, 'arrow');
    state.code = nextCode;
    state.updateDiagram = true;
    didAdd = true;
  });
  if (!didAdd) notify('无法添加箭头，请选择两个不同的块，且不要重复连接。');
  return didAdd;
};

export const resizePacketField = (label: string, size: PacketFieldSize): boolean => {
  let didResize = false;
  update((state) => {
    const nextCode = resizePacketFieldCode(state.code, label, size);
    if (!nextCode || nextCode === state.code) return;
    pushUndoFor(state, 'resize');
    state.code = nextCode;
    state.updateDiagram = true;
    didResize = true;
  });
  if (!didResize) notify('没有找到对应的数据包字段，请重新选择后再试。');
  return didResize;
};

export const moveTimelinePeriod = (label: string, direction: -1 | 1): boolean => {
  let didMove = false;
  update((state) => {
    const nextCode = moveTimelinePeriodCode(state.code, label, direction);
    if (!nextCode || nextCode === state.code) return;
    pushUndoFor(state, 'sort');
    state.code = nextCode;
    state.updateDiagram = true;
    didMove = true;
  });
  return didMove;
};

export { createDiagramBranchCode };

export const updateCodeInteraction = (
  code: string,
  { start = false, updateDiagram = true }: { start?: boolean; updateDiagram?: boolean } = {}
): void => {
  update((state) => {
    if (start && state.code !== code) pushUndoFor(state, 'interaction');
    state.code = code;
    state.updateDiagram = updateDiagram;
  });
};

export const updateVisualPositions = (visualPositions: State['visualPositions']): void => {
  update((state) => {
    const normalized = normalizeVisualPositions(visualPositions);
    if (JSON.stringify(state.visualPositions ?? {}) === JSON.stringify(normalized ?? {})) return;
    pushUndoFor(state, 'interaction');
    if (normalized) {
      state.visualPositions = normalized;
    } else {
      delete state.visualPositions;
    }
    state.updateDiagram = true;
  });
};

export const updateVisualPositionsBatch = (
  updates: Record<string, NonNullable<State['visualPositions']>[string]>
): boolean => {
  let changed = false;
  update((state) => {
    const next = normalizeVisualPositions({ ...(state.visualPositions ?? {}), ...updates });
    if (JSON.stringify(state.visualPositions ?? {}) === JSON.stringify(next ?? {})) return;
    pushUndoFor(state, 'batch');
    if (next) state.visualPositions = next;
    else delete state.visualPositions;
    state.updateDiagram = true;
    changed = true;
  });
  return changed;
};

export const replaceDiagramText = (
  range: SourceTextRange,
  currentText: string,
  nextText: string
): boolean => {
  let changed = false;
  update((state) => {
    const next = replaceDiagramVisualText(state.code, range, currentText, nextText);
    if (next.code === state.code) return;
    pushUndoFor(state, 'replace');
    state.code = next.code;
    state.updateDiagram = true;
    changed = true;
  });
  return changed;
};

export interface DiagramTextReplacement {
  currentText: string;
  nextText: string;
  range: SourceTextRange;
}

export const replaceAllDiagramText = (replacements: readonly DiagramTextReplacement[]): number => {
  let replaced = 0;
  update((state) => {
    let nextCode = state.code;
    for (const replacement of [...replacements].sort(
      (left, right) => right.range.start - left.range.start
    )) {
      if (
        nextCode.slice(replacement.range.start, replacement.range.end) !== replacement.currentText
      ) {
        continue;
      }
      nextCode = replaceVisualText(nextCode, replacement.range, replacement.nextText).code;
      replaced += 1;
    }
    if (nextCode === state.code) return;
    pushUndoFor(state, 'replace');
    state.code = nextCode;
    state.updateDiagram = true;
  });
  return replaced;
};

export const undoLastEdit = (): boolean => {
  const previous = undoStack.pop();
  if (!previous) {
    return false;
  }
  lastUndoSource = '';
  lastUndoAt = 0;

  update((state) => {
    pushStateToStack(redoStack, $state.snapshot(state) as State);
    restoreSnapshot(state, previous);
  });

  return true;
};

export const redoLastEdit = (): boolean => {
  const next = redoStack.pop();
  if (!next) {
    return false;
  }
  lastUndoSource = '';
  lastUndoAt = 0;

  update((state) => {
    pushStateToStack(undoStack, $state.snapshot(state) as State);
    restoreSnapshot(state, next);
  });

  return true;
};

export const resetToDefaultGraph = (): void => {
  update((state) => {
    pushUndoFor(state, 'reset');
    const initialStateForCurrentDiagram = currentDiagramInitialState ?? defaultState;
    const resetState = cloneState({
      ...initialStateForCurrentDiagram,
      updateDiagram: true
    });
    delete resetState.pan;
    delete resetState.zoom;
    replaceStateData(state, resetState);
  });
};

export const loadDiagramCode = (code: string): void => {
  update((state) => {
    clearUndoStack();
    captureNextValidAsInitial = true;
    state.code = code;
    state.pan = undefined;
    state.zoom = undefined;
    delete state.visualStyles;
    delete state.visualPositions;
    delete state.visualLayers;
    state.updateDiagram = true;
  });
};

export const updateVisualStyle = (
  targetId: string,
  style: NonNullable<State['visualStyles']>[string]
): void => {
  updateVisualStyles([targetId], style);
};

export const updateVisualStyles = (targetIds: readonly string[], style: VisualStyle): boolean => {
  const ids = targetIds.filter((id, index) => Boolean(id) && targetIds.indexOf(id) === index);
  if (ids.length === 0) return false;
  let changed = false;
  update((state) => {
    const next = { ...(state.visualStyles ?? {}) };
    for (const id of ids) {
      if (JSON.stringify(next[id] ?? {}) === JSON.stringify(style)) continue;
      next[id] = { ...style };
      changed = true;
    }
    if (!changed) return;
    pushUndoFor(state, 'color', { coalesce: true });
    state.visualStyles = next;
    state.updateDiagram = true;
  });
  return changed;
};

export const updateVisualLayers = (
  patches: Readonly<Record<string, VisualLayerState>>
): boolean => {
  const entries = Object.entries(patches).filter(([id]) => Boolean(id));
  if (entries.length === 0) return false;
  let changed = false;
  update((state) => {
    let next = { ...(state.visualLayers ?? {}) };
    for (const [id, patch] of entries) {
      const current = next[id] ?? {};
      const merged = { ...current, ...patch };
      const candidate: VisualLayerState = {};
      if (merged.hidden) candidate.hidden = true;
      if (merged.locked) candidate.locked = true;
      if (merged.zIndex) candidate.zIndex = merged.zIndex;
      if (JSON.stringify(current) === JSON.stringify(candidate)) continue;
      if (Object.keys(candidate).length > 0) next[id] = candidate;
      else next = Object.fromEntries(Object.entries(next).filter(([key]) => key !== id));
      changed = true;
    }
    if (!changed) return;
    pushUndoFor(state, 'layer');
    if (Object.keys(next).length > 0) state.visualLayers = next;
    else delete state.visualLayers;
    state.updateDiagram = true;
  });
  return changed;
};

export const updateVisualLayer = (
  targetIds: readonly string[],
  patch: VisualLayerState
): boolean => {
  const ids = targetIds.filter((id, index) => Boolean(id) && targetIds.indexOf(id) === index);
  return updateVisualLayers(Object.fromEntries(ids.map((id) => [id, patch])));
};

export const setSnapToGrid = (enabled: boolean): void => {
  updateCodeStore({ snapToGrid: enabled });
};

export const updateConfig = (config: string): void => {
  update((state) => {
    if (state.mermaid !== config) {
      pushUndoFor(state, 'config', { coalesce: true });
    }
    applyPartial(state, { mermaid: config });
  });
};

export const toggleDarkTheme = (dark: boolean): void => {
  update((state) => {
    let config: MermaidConfig;
    try {
      config = JSON.parse(state.mermaid) as MermaidConfig;
    } catch {
      return;
    }
    if (config.theme && !['dark', 'default'].includes(config.theme)) return;
    const nextTheme = dark ? 'dark' : 'default';
    const nextThemeVariables = dark ? darkThemeVariables : lightThemeVariables;
    if (
      config.theme === nextTheme &&
      JSON.stringify(config.themeVariables ?? {}) === JSON.stringify(nextThemeVariables)
    ) {
      return;
    }
    pushUndoFor(state, 'theme');
    config.theme = nextTheme;
    config.themeVariables = nextThemeVariables;
    state.mermaid = formatJSON(config);
  });
};

// Replaces the whole input state (e.g. when restoring a history entry),
// dropping keys the next state does not define.
export const replaceInputState = (next: State): void => {
  update((state) => {
    const normalized = normalizeState(next);
    if (diagramStateKey(state) !== diagramStateKey(normalized)) {
      pushUndoFor(state, 'state');
    }
    captureNextValidAsInitial = true;
    replaceStateData(state, normalized);
  });
};

export const initURLSubscription = (): void => {
  updateHash = (serialized: string) => {
    const hash = `#${serialized}`;
    if (window.location.hash !== hash) replaceNavigationState(hash, {});
  };
  updateHash(validatedCurrent.serialized);
};

export const verifyState = (): void => {
  update((state) => applyPartial(state, state.panZoom ? {} : { panZoom: true }));
};
