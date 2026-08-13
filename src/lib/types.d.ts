import type { Component } from 'svelte';
import type { HTMLInputTypeAttribute } from 'svelte/elements';
import 'unplugin-icons/types/svelte';

export interface MarkerData {
  severity: number;
  message: string;
  source?: string;
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

export interface Tab {
  id: string;
  title: string;
  icon: Component;
}

export interface State {
  code: string;
  mermaid: string;
  updateDiagram: boolean;
  rough: boolean;
  // All new options must be optional, as users would have old states saved
  schemaVersion?: number;
  renderCount?: number;
  panZoom?: boolean;
  grid?: boolean;
  editorMode?: EditorMode;
  pan?: { x: number; y: number };
  zoom?: number;
  loader?: LoaderConfig;
  visualStyles?: Record<string, VisualStyle>;
  visualPositions?: Record<string, VisualPosition>;
  visualLayers?: Record<string, VisualLayerState>;
  visualConnections?: Record<string, VisualConnection>;
  visualElements?: Record<string, VisualElement>;
  sampleDescription?: string;
  snapToGrid?: boolean;
}

export interface VisualPosition {
  x: number;
  y: number;
}

export interface VisualStyle {
  alpha?: number;
  fill?: string;
  stroke?: string;
  text?: string;
}

export interface VisualLayerState {
  hidden?: boolean;
  locked?: boolean;
  zIndex?: number;
}

export type VisualAnchorId =
  | 'bottom'
  | 'bottom-left'
  | 'bottom-right'
  | 'left'
  | 'right'
  | 'top'
  | 'top-left'
  | 'top-right';

export interface VisualConnectionEndpoint extends VisualPosition {
  anchor?: VisualAnchorId;
  elementId?: string;
}

export type VisualConnectionDirection = 'both' | 'forward' | 'none';
export type VisualConnectionLineStyle = 'dashed' | 'solid';

export interface VisualConnection {
  direction: VisualConnectionDirection;
  id: string;
  labelBackground?: string;
  labelColor?: string;
  label: string;
  lineStyle: VisualConnectionLineStyle;
  source: VisualConnectionEndpoint;
  stroke?: string;
  strokeWidth: number;
  target: VisualConnectionEndpoint;
}

export type VisualOverlayKind = 'icon' | 'shape';

export type VisualElementShape =
  | 'circle'
  | 'cloud'
  | 'cylinder'
  | 'diamond'
  | 'document'
  | 'ellipse'
  | 'person'
  | 'rectangle'
  | 'rounded'
  | 'server';

/** A diagram-independent SVG element that participates in the shared editor model. */
export interface VisualElement {
  height: number;
  id: string;
  kind: VisualOverlayKind;
  label: string;
  parentId?: string;
  shape: VisualElementShape;
  width: number;
  x: number;
  y: number;
}

export interface ValidatedState extends State {
  editorMode: EditorMode;
  diagramType?: string;
  error?: Error;
  errorMarkers: MarkerData[];
  serialized: string;
}

export interface GistLoaderConfig {
  url: string;
}

export interface LoadingState {
  loading: boolean;
  message?: string;
}
export interface FileLoaderConfig {
  codeURL: string;
  configURL?: string;
}
export type LoaderConfig =
  | {
      type: 'gist';
      config: GistLoaderConfig;
    }
  | {
      type: 'files';
      config: FileLoaderConfig;
    };
export type HistoryType = 'auto' | 'manual' | 'loader';
export type HistoryEntry = { id: string; state: State; time: number; url?: string } & (
  | {
      type: 'loader';
      name: string;
    }
  | {
      type: Exclude<HistoryType, 'loader'>;
      name?: string;
    }
);

export type EditorMode = 'code' | 'config';

export type Loader = (url: string) => Promise<State>;
export type Optional<T, K extends keyof T> = Pick<Partial<T>, K> & Omit<T, K>;

export interface ErrorHash {
  loc: {
    first_line: number;
    last_line: number;
    first_column: number;
    last_column: number;
  };
}

export type InputType = Exclude<HTMLInputTypeAttribute, 'file'>;

export interface EditorProps {
  onUpdate: (text: string) => void;
}
