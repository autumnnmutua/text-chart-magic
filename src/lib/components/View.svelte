<script lang="ts">
  import type { State, ValidatedState, VisualConnection, VisualConnectionEndpoint } from '$/types';
  import { recordRenderTime, shouldRefreshView } from '$/util/autoSync';
  import { render as renderDiagram } from '$/util/mermaid';
  import { PanZoomState } from '$/util/panZoom';
  import {
    addBlockArrow,
    addDiagramBranch,
    addVisualConnection,
    deleteDiagramElement,
    moveTimelinePeriod as moveTimelinePeriodState,
    resizePacketField,
    updateCodeInteraction,
    updateCodeStore,
    updateArchitectureGroup,
    updateArchitectureGroups,
    updateVisualConnection,
    updateVisualPositionsBatch,
    validatedState
  } from '$/util/state.svelte';
  import { saveStatistics } from '$/util/stats';
  import { Button } from '$lib/components/ui/button';
  import ConnectionToolbar from '$lib/components/workspace/ConnectionToolbar.svelte';
  import FontAwesome, { mayContainFontAwesome } from '$lib/components/FontAwesome.svelte';
  import {
    applyArchitecturePositions,
    getArchitectureNodeId,
    moveArchitectureNode
  } from '$lib/util/architectureFreeLayout';
  import {
    architectureGroupAtElement,
    architectureGroupResolvedRect,
    parseArchitectureGroups,
    reconcileArchitectureGroupMembership,
    renderArchitectureGroups,
    resizeArchitectureGroup,
    updateArchitectureGroupSelection,
    updateRenderedArchitectureGroup,
    type ArchitectureGroup,
    type ArchitectureResizeHandle
  } from '$lib/util/architectureGroups';
  import {
    applyBlockPositions,
    clientToSvgPoint,
    getBlockNodeId,
    moveBlockNode,
    prepareBlockEdgeTargets,
    type VisualPosition
  } from '$lib/util/blockFreeLayout';
  import { applyC4Positions, getC4NodeId, moveC4Node } from '$lib/util/c4FreeLayout';
  import {
    connectionEditor,
    finishConnectionCreation,
    setConnectionCreationPhase
  } from '$lib/util/connectionEditor.svelte';
  import {
    getDiagramKeyword,
    moveDiagramElementCode,
    type DiagramBranchRequest,
    type PacketFieldSize
  } from '$lib/util/diagramBranch';
  import { requestEditorFocus } from '$lib/util/editorFocus.svelte';
  import { getQuadrantBounds, moveQuadrantPointByPixels } from '$lib/util/quadrantLayout';
  import {
    clearVisualSelection,
    openVisualColorPanel,
    selectVisualElement,
    setVisualSelection,
    visualSelection,
    type VisualSelectionItem
  } from '$lib/util/visualSelection.svelte';
  import {
    clearVisualDocument,
    setVisualDocument,
    visualDocument
  } from '$lib/util/visualDocument.svelte';
  import {
    applyVisualLayerState,
    applyVisualSelectionState,
    buildVisualDocument,
    getVisualDocumentTarget,
    getVisualSourceId
  } from '$lib/util/visualElementModel';
  import { deleteSelectedElements } from '$lib/util/visualOperations';
  import { calculateSnap, type ClientBounds, type SnapGuide } from '$lib/util/snapLayout';
  import { applyVisualStyles } from '$lib/util/visualStyle';
  import {
    clientToConnectionPoint,
    collectVisualConnectionGeometry,
    collectVisualAnchors,
    connectionLaneOffsets,
    CONNECTION_SNAP_PX,
    createVisualConnection,
    endpointAtClientPoint,
    inferVisualConnectionAppearance,
    isStableConnectableItem,
    refreshVisualConnectionsForElements,
    renderVisualConnectionFrame,
    renderVisualConnections,
    TOUCH_CONNECTION_SNAP_PX,
    type VisualConnectionGeometry
  } from '$lib/util/visualConnections';
  import {
    findVisualTextRange,
    findRequirementFieldRange,
    findQuadrantPoint,
    findWardleyPoint,
    findJourneyScore,
    normalizeVisibleText,
    replaceDiagramVisualText,
    replaceQuadrantPoint,
    replaceWardleyPoint,
    replaceJourneyScore,
    type SourceTextRange
  } from '$lib/util/visualTextEdit';
  import uniqueID from 'lodash-es/uniqueId';
  import type { MermaidConfig } from 'mermaid';
  import { mode } from 'mode-watcher';
  import { onMount } from 'svelte';
  import { SvelteMap, SvelteSet } from 'svelte/reactivity';
  import { Svg2Roughjs } from 'svg2roughjs';

  let {
    panZoomState = new PanZoomState(),
    shouldShowGrid = true
  }: { panZoomState?: PanZoomState; shouldShowGrid?: boolean } = $props();
  let code = '';
  let config = '';
  let container: HTMLDivElement | undefined = $state();
  let rough: boolean;
  let visualStylesFingerprint = '';
  let visualPositionsFingerprint = '';
  let visualLayersFingerprint = '';
  let visualConnectionsFingerprint = '';
  let view: HTMLDivElement | undefined = $state();
  let error = $state(false);
  let panZoom = true;
  let manualUpdate = true;
  let textEditInput: HTMLInputElement | undefined = $state();
  let waitForFontAwesomeToLoad: FontAwesome['waitForFontAwesomeToLoad'] | undefined = $state();
  let activeTextEdit:
    | {
        code: string;
        currentText: string;
        height: number;
        originalText: string;
        range: SourceTextRange;
        width: number;
        x: number;
        y: number;
      }
    | undefined = $state();
  let activeTextEditReady = $state(false);
  let activeTextEditRevision = 0;
  let branchTarget:
    | {
        sourceId: string;
        label: string;
        x: number;
        y: number;
      }
    | undefined = $state();
  let colorTarget:
    | {
        id: string;
        label: string;
        x: number;
        y: number;
      }
    | undefined = $state();
  let deleteTarget:
    | {
        label: string;
        occurrence: number;
        sourceId: string;
        styleId: string;
        x: number;
        y: number;
      }
    | undefined = $state();
  let moodDrag:
    | {
        initialScore: number;
        occurrence: number;
        originalCode: string;
        pendingCode?: string;
        previewElements: { element: SVGGraphicsElement; transform: string }[];
        startX: number;
        startY: number;
        started: boolean;
        text: string;
      }
    | undefined = $state();
  let quadrantDrag:
    | {
        initialX: number;
        initialY: number;
        occurrence: number;
        originalCode: string;
        pendingCode?: string;
        previewElements: { element: SVGGraphicsElement; transform: string }[];
        startX: number;
        startY: number;
        started: boolean;
        text: string;
      }
    | undefined = $state();
  let wardleyDrag:
    | {
        initialX: number;
        initialY: number;
        originalCode: string;
        pendingCode?: string;
        previewElements: { element: SVGGraphicsElement; transform: string }[];
        startX: number;
        startY: number;
        started: boolean;
        text: string;
      }
    | undefined = $state();
  let structuralDrag:
    | {
        sourceLabel: string;
        startX: number;
        startY: number;
        started: boolean;
        targetLabel?: string;
      }
    | undefined = $state();
  let blockDrag:
    | {
        current: Record<string, VisualPosition>;
        id: string;
        initial: Record<string, VisualPosition>;
        initialBounds: ClientBounds;
        kind: 'architecture' | 'block' | 'c4';
        otherBounds: ClientBounds[];
        pointerClientStart: VisualPosition;
        pointerId?: number;
        pointerStart: VisualPosition;
        started: boolean;
        svg: SVGSVGElement;
      }
    | undefined = $state();
  let architectureGroupDrag:
    | {
        current: ArchitectureGroup;
        currentMemberPositions: Record<string, VisualPosition>;
        element: SVGGElement;
        initial: ArchitectureGroup;
        initialMemberPositions: Record<string, VisualPosition>;
        mode: 'move' | 'resize';
        pointerId: number;
        resizeHandle?: ArchitectureResizeHandle;
        start: VisualPosition;
        started: boolean;
        svg: SVGSVGElement;
      }
    | undefined = $state();
  let blockArrowSourceLabel = $state('');
  let connectionDraftSource: VisualConnectionEndpoint | undefined = $state();
  let connectionPreview: VisualConnection | undefined = $state();
  let connectionCreationGeometry: VisualConnectionGeometry | undefined;
  let connectionEndpointDrag:
    | {
        current: VisualConnection;
        pointerId: number;
        role: 'source' | 'target';
        geometry: VisualConnectionGeometry;
        svg: SVGSVGElement;
      }
    | undefined = $state();
  let marquee:
    | {
        additive: VisualSelectionItem[];
        currentX: number;
        currentY: number;
        pointerId?: number;
        startX: number;
        startY: number;
        started: boolean;
      }
    | undefined = $state();
  let snapGuides = $state<SnapGuide[]>([]);
  let suppressVisualClickUntil = 0;
  let suppressNextVisualClick = false;
  let handledFocusRequestId = 0;
  let handledEditRequestId = 0;
  let pendingPanZoom: Pick<State, 'pan' | 'zoom'> | undefined;
  let panZoomPersistTimer: ReturnType<typeof setTimeout> | undefined;
  let connectionRenderFrame = 0;
  let linkedConnectionRenderFrame = 0;
  let viewportFitFrame = 0;
  let branchFocusFrame = 0;
  let connectionEditorRevision = 0;
  let pendingBranchFocusBaseline:
    | {
        ids: SvelteSet<string>;
        labelCounts: SvelteMap<string, number>;
      }
    | undefined;

  const captureBranchFocusBaseline = () => {
    const ids = new SvelteSet<string>();
    const labelCounts = new SvelteMap<string, number>();
    for (const item of visualDocument.current) {
      if (item.kind === 'edge') continue;
      ids.add(item.id);
      const label = normalizeVisibleText(item.label).toLocaleLowerCase();
      if (label) labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
    }
    return { ids, labelCounts };
  };

  const flushPanZoom = () => {
    if (panZoomPersistTimer) clearTimeout(panZoomPersistTimer);
    panZoomPersistTimer = undefined;
    const next = pendingPanZoom;
    pendingPanZoom = undefined;
    if (next) updateCodeStore(next);
  };

  // Set up panZoom state observer to update the store when pan/zoom changes
  const setupPanZoomObserver = () => {
    panZoomState.onPanZoomChange = (pan, zoom, immediate = false) => {
      pendingPanZoom = { pan, zoom };
      if (immediate) {
        flushPanZoom();
        return;
      }
      if (panZoomPersistTimer) clearTimeout(panZoomPersistTimer);
      panZoomPersistTimer = setTimeout(flushPanZoom, 100);
    };
  };

  const handlePanZoom = (state: State, graphDiv: SVGSVGElement) => {
    try {
      panZoomState.updateElement(graphDiv, state);
    } catch (error) {
      console.error('PanZoom error:', error);
    }
  };

  const schedulePostRenderViewportFit = () => {
    if (viewportFitFrame) cancelAnimationFrame(viewportFitFrame);
    viewportFitFrame = requestAnimationFrame(() => {
      viewportFitFrame = requestAnimationFrame(() => {
        viewportFitFrame = 0;
        panZoomState.resize();
      });
    });
  };

  const schedulePendingBranchFocus = () => {
    const baseline = pendingBranchFocusBaseline;
    if (!baseline) return;
    pendingBranchFocusBaseline = undefined;
    const currentLabelCounts = new SvelteMap<string, number>();
    const addedByLabel = visualDocument.current.filter(({ kind, label }) => {
      if (kind === 'edge') return false;
      const normalizedLabel = normalizeVisibleText(label).toLocaleLowerCase();
      if (!normalizedLabel) return false;
      const occurrence = (currentLabelCounts.get(normalizedLabel) ?? 0) + 1;
      currentLabelCounts.set(normalizedLabel, occurrence);
      return occurrence > (baseline.labelCounts.get(normalizedLabel) ?? 0);
    });
    const addedById = visualDocument.current.filter(
      ({ id, kind }) => kind !== 'edge' && !baseline.ids.has(id)
    );
    const addedItems = addedByLabel.length > 0 ? addedByLabel : addedById;
    const target =
      addedItems.find(({ kind }) => kind === 'node') ??
      addedItems.find(({ kind }) => kind === 'text') ??
      addedItems[0];
    if (!target) return;
    if (branchFocusFrame) cancelAnimationFrame(branchFocusFrame);
    branchFocusFrame = requestAnimationFrame(() => {
      branchFocusFrame = requestAnimationFrame(() => {
        branchFocusFrame = 0;
        if (!view || !target.element.isConnected) return;
        const viewport = view.getBoundingClientRect();
        const bounds = target.element.getBoundingClientRect();
        const padding = 24;
        const isVisible =
          bounds.width > 0 &&
          bounds.height > 0 &&
          bounds.left >= viewport.left + padding &&
          bounds.right <= viewport.right - padding &&
          bounds.top >= viewport.top + padding &&
          bounds.bottom <= viewport.bottom - padding;
        if (!isVisible) panZoomState.focusElement(target.element);
      });
    });
  };

  const releaseCanvasBounds = (graphDiv: SVGSVGElement) => {
    const viewBox = graphDiv.viewBox?.baseVal;
    if (!viewBox || viewBox.width <= 0 || viewBox.height <= 0) {
      try {
        const bounds = graphDiv.getBBox();
        if (bounds.width > 0 && bounds.height > 0) {
          const padding = 10;
          graphDiv.setAttribute(
            'viewBox',
            `${bounds.x - padding} ${bounds.y - padding} ${bounds.width + padding * 2} ${bounds.height + padding * 2}`
          );
        }
      } catch {
        // Some SVG renderers expose their bounds only after the element is mounted.
      }
    }
    graphDiv.setAttribute('width', '100%');
    graphDiv.setAttribute('height', '100%');
    graphDiv.style.display = 'block';
    graphDiv.style.width = '100%';
    graphDiv.style.height = '100%';
    graphDiv.style.maxWidth = 'none';
    graphDiv.style.overflow = 'hidden';
  };

  const semanticStyleTargetSelector = '.node, .edgePath, .edgeLabel, .cluster';
  const primitiveStyleTargetSelector =
    'path, rect, polygon, circle, ellipse, line, text, foreignObject';
  const styleTargetSelector = `${semanticStyleTargetSelector}, ${primitiveStyleTargetSelector}`;

  const getStyleTarget = (target: EventTarget | null): HTMLElement | SVGElement | undefined => {
    if (!(target instanceof Element)) {
      return undefined;
    }
    return (target.closest(semanticStyleTargetSelector) ??
      target.closest(primitiveStyleTargetSelector)) as HTMLElement | SVGElement | undefined;
  };

  const getStyleID = (element: Element): string => element.getAttribute('data-style-id') ?? '';

  const prepareStyleTargets = (
    graphDiv: SVGSVGElement,
    sourceCode = validatedState.current.code
  ) => {
    const targets = Array.from(graphDiv.querySelectorAll(styleTargetSelector));
    targets.forEach((target, index) => {
      if (target.getAttribute('data-style-id')) {
        return;
      }
      const semanticParent = target.closest(semanticStyleTargetSelector);
      if (semanticParent && semanticParent !== target) {
        return;
      }
      const classPart =
        [...target.classList].find((className) =>
          ['node', 'edgePath', 'edgeLabel', 'cluster'].includes(className)
        ) ?? target.tagName.toLowerCase();
      const id = target.id || `${classPart}-${index}`;
      target.setAttribute('data-style-id', id.replace(/^graph-\d+[-_]?/, ''));
      if (target.matches('path[data-edge="true"]')) {
        (target as SVGElement).style.pointerEvents = 'stroke';
        (target as SVGElement).style.cursor = 'pointer';
      }
    });
    if (getDiagramKeyword(sourceCode) === 'block-beta') {
      prepareBlockEdgeTargets(graphDiv, sourceCode);
    }
  };

  const refreshVisualDocument = (graphDiv: SVGSVGElement, state: State) => {
    if (getDiagramKeyword(state.code) === 'architecture-beta') {
      renderArchitectureGroups(graphDiv, state.code, new Set(visualSelection.ids));
    }
    const baseItems = buildVisualDocument(graphDiv, state.code).filter(
      ({ id }) => !state.visualConnections?.[id]
    );
    renderVisualConnections(graphDiv, state.visualConnections, baseItems, {
      selectedIds: new Set(visualSelection.ids)
    });
    const items = buildVisualDocument(graphDiv, state.code);
    applyVisualLayerState(items, state.visualLayers);
    setVisualDocument(items);
    if (visualSelection.count > 0) {
      const selectedIds = new Set(visualSelection.ids);
      setVisualSelection(items.filter(({ id }) => selectedIds.has(id)));
    }
    applyVisualSelectionState(items, new Set(visualSelection.ids), visualSelection.current?.id);
  };

  const textLeafSelector = '.nodeLabel, .edgeLabel, .label, text, foreignObject p';
  const editableTextSelector = `${textLeafSelector}, tspan, foreignObject, .node, .actor, .messageText, .noteText, .loopText, .task, .journey-section, .legend, .face, .branchLabel`;

  const getEditableTextElement = (target: EventTarget | null): Element | undefined => {
    if (!(target instanceof Element)) {
      return undefined;
    }
    return (
      target.closest(editableTextSelector) ??
      target.querySelector(editableTextSelector) ??
      undefined
    );
  };

  const getTextLeafElement = (
    target: EventTarget | null,
    point?: { clientX: number; clientY: number }
  ): Element | undefined => {
    const labelElement = getEditableTextElement(target);
    if (!labelElement) {
      return undefined;
    }
    if (labelElement.matches('.face')) {
      return (
        labelElement.parentElement?.querySelector('foreignObject .label, foreignObject .task') ??
        undefined
      );
    }
    if (labelElement.matches('p') && labelElement.closest('foreignObject')) {
      return labelElement;
    }
    const closestToPoint = (elements: Element[]): Element | undefined => {
      if (!point || elements.length === 0) return undefined;
      const distance = (element: Element) => {
        const rect = element.getBoundingClientRect();
        const dx = Math.max(rect.left - point.clientX, 0, point.clientX - rect.right);
        const dy = Math.max(rect.top - point.clientY, 0, point.clientY - rect.bottom);
        return Math.hypot(dx, dy);
      };
      return elements.reduce((closest, item) =>
        distance(item) < distance(closest) ? item : closest
      );
    };
    const htmlLabel = labelElement.closest('.nodeLabel, .edgeLabel, .label');
    if (htmlLabel && (htmlLabel instanceof HTMLElement || htmlLabel.closest('foreignObject'))) {
      return htmlLabel;
    }
    if (labelElement.matches('tspan')) {
      return labelElement;
    }
    const svgText = labelElement.closest('text');
    if (svgText) {
      const tspans = Array.from(svgText.querySelectorAll('tspan')).filter((item) =>
        normalizeVisibleText(item.textContent ?? '')
      );
      if (tspans.length > 1) return closestToPoint(tspans) ?? svgText;
      return svgText;
    }
    const foreignLabel = labelElement
      .closest('foreignObject')
      ?.querySelector('.nodeLabel, .edgeLabel, .label');
    if (foreignLabel) {
      return foreignLabel;
    }
    const descendantTexts = Array.from(labelElement.querySelectorAll('text')).filter((item) =>
      normalizeVisibleText(item.textContent ?? '')
    );
    if (descendantTexts.length > 1) return closestToPoint(descendantTexts) ?? descendantTexts[0];
    return labelElement.matches(textLeafSelector)
      ? labelElement
      : (labelElement.querySelector(textLeafSelector) ?? undefined);
  };

  const getEditableLabel = (
    target: EventTarget | null,
    point?: { clientX: number; clientY: number }
  ): string => {
    const textElement = getTextLeafElement(target, point);
    const text = normalizeVisibleText(textElement?.textContent ?? '');
    if (/^\s*requirementDiagram\b/im.test(validatedState.current.code)) {
      const fieldText = text.replace(
        /^(?:Text|ID|Risk|Verification(?: Method)?|Verify Method|Type|Doc(?:ument)? Ref(?:erence)?):\s*/i,
        ''
      );
      return fieldText.match(/^<<\s*(.+?)\s*>>$/)?.[1] ?? fieldText;
    }
    return text;
  };

  const getCanonicalTextLeaves = (root: ParentNode): Element[] =>
    Array.from(root.querySelectorAll(textLeafSelector)).filter((item) => {
      const text = normalizeVisibleText(item.textContent ?? '');
      if (!text) return false;
      return !Array.from(item.querySelectorAll(textLeafSelector)).some(
        (child) => normalizeVisibleText(child.textContent ?? '') === text
      );
    });

  const getTextOccurrence = (
    target: EventTarget | null,
    label: string,
    point?: { clientX: number; clientY: number }
  ): number => {
    if (!(target instanceof Element) || !container) {
      return 0;
    }
    const selected = getTextLeafElement(target, point);
    if (!selected) {
      return 0;
    }
    const labels = getCanonicalTextLeaves(container);
    const canonicalSelected =
      labels.find(
        (item) =>
          (item === selected || selected.contains(item) || item.contains(selected)) &&
          normalizeVisibleText(item.textContent ?? '') === label
      ) ?? selected;
    return labels
      .slice(0, Math.max(labels.indexOf(canonicalSelected), 0))
      .filter((item) => normalizeVisibleText(item.textContent ?? '') === label).length;
  };

  const isFlowchartState = (): boolean =>
    /^\s*(flowchart|graph)\b/im.test(validatedState.current.code);

  const isJourneyState = (): boolean => /^\s*journey\b/im.test(validatedState.current.code);

  const isQuadrantState = (): boolean => /^\s*quadrantChart\b/im.test(validatedState.current.code);

  const isWardleyState = (): boolean => /^\s*wardley-beta\b/im.test(validatedState.current.code);

  const currentDiagramKeyword = (): string => getDiagramKeyword(validatedState.current.code);

  const isTimelinePeriod = (label: string): boolean =>
    /^\s*timeline\b/im.test(validatedState.current.code) &&
    validatedState.current.code.split('\n').some((line) => {
      const match = line.match(/^\s*([^:]+?)\s*:/);
      return match && normalizeVisibleText(match[1]) === normalizeVisibleText(label);
    });

  const specialToolbarX = (x: number): number =>
    Math.max(8, Math.min(x, Math.max((view?.clientWidth ?? 440) - 430, 8)));

  const specialToolbarY = (y: number): number => {
    const height = view?.clientHeight ?? 180;
    return y + 214 <= height ? y + 132 : Math.max(8, y - 90);
  };

  const specialActionX = (x: number, width = 88): number =>
    Math.max(8, Math.min(x + 68, Math.max((view?.clientWidth ?? 180) - width, 8)));

  const showBranchButton = (event: MouseEvent, sourceId: string, label: string) => {
    if (!view || (isFlowchartState() && !sourceId)) {
      branchTarget = undefined;
      return;
    }
    const rect = view.getBoundingClientRect();
    branchTarget = {
      sourceId,
      label,
      x: Math.min(Math.max(event.clientX - rect.left + 12, 12), rect.width - 96),
      y: Math.min(Math.max(event.clientY - rect.top + 12, 12), rect.height - 48)
    };
  };

  const showColorButton = (event: MouseEvent, styleId: string, label: string) => {
    if (!view || !styleId) {
      colorTarget = undefined;
      return;
    }
    const rect = view.getBoundingClientRect();
    colorTarget = {
      id: styleId,
      label: label || '选中元素',
      x: Math.min(Math.max(event.clientX - rect.left + 12, 12), rect.width - 96),
      y: Math.min(Math.max(event.clientY - rect.top + 50, 12), rect.height - 48)
    };
  };

  const showDeleteButton = (
    event: MouseEvent,
    sourceId: string,
    label: string,
    occurrence: number,
    styleId: string
  ) => {
    if (!view || !label) {
      deleteTarget = undefined;
      return;
    }
    const rect = view.getBoundingClientRect();
    deleteTarget = {
      label,
      occurrence,
      sourceId,
      styleId,
      x: Math.min(Math.max(event.clientX - rect.left + 12, 12), rect.width - 96),
      y: Math.min(Math.max(event.clientY - rect.top + 88, 12), rect.height - 48)
    };
  };

  const addBranch = (event: MouseEvent) => {
    event.stopPropagation();
    if (!branchTarget) {
      return;
    }
    const baseline = captureBranchFocusBaseline();
    const didAdd = addDiagramBranch({
      label: branchTarget.label,
      mode: currentDiagramKeyword() === 'kanban' ? 'card' : 'branch',
      sourceId: branchTarget.sourceId
    });
    if (didAdd) pendingBranchFocusBaseline = baseline;
    branchTarget = undefined;
  };

  const addSpecialBranch = (event: MouseEvent, mode: NonNullable<DiagramBranchRequest['mode']>) => {
    event.stopPropagation();
    if (!branchTarget) return;
    const baseline = captureBranchFocusBaseline();
    const didAdd = addDiagramBranch({
      label: branchTarget.label,
      mode,
      sourceId: branchTarget.sourceId
    });
    if (didAdd) pendingBranchFocusBaseline = baseline;
    branchTarget = undefined;
  };

  const editSelectedLabel = (event: MouseEvent) => {
    event.stopPropagation();
    if (!branchTarget || !view) return;
    const range = getInlineTextEditRange(branchTarget.label, branchTarget.sourceId, 0);
    if (!range) {
      requestEditorFocus(branchTarget.label, branchTarget.sourceId || undefined, 0);
      return;
    }
    openInlineTextEdit({
      code: validatedState.current.code,
      currentText: branchTarget.label,
      height: 36,
      originalText: branchTarget.label,
      range,
      width: 180,
      x: branchTarget.x,
      y: branchTarget.y + 44
    });
  };

  const openInlineTextEdit = (next: NonNullable<typeof activeTextEdit>) => {
    const revision = ++activeTextEditRevision;
    activeTextEdit = next;
    activeTextEditReady = false;
    setTimeout(() => {
      if (activeTextEdit && activeTextEditRevision === revision) activeTextEditReady = true;
    }, 0);
  };

  const focusInlineTextInput = (node: HTMLInputElement) => {
    node.focus({ preventScroll: true });
    node.select();
  };

  const selectBlockArrowSource = (event: MouseEvent) => {
    event.stopPropagation();
    if (!branchTarget) return;
    blockArrowSourceLabel = branchTarget.label;
    branchTarget = undefined;
    colorTarget = undefined;
    deleteTarget = undefined;
  };

  const resizePacket = (event: MouseEvent, size: PacketFieldSize) => {
    event.stopPropagation();
    if (!branchTarget) return;
    resizePacketField(branchTarget.label, size);
    branchTarget = undefined;
  };

  const moveTimelinePeriod = (event: MouseEvent, direction: -1 | 1) => {
    event.stopPropagation();
    if (!branchTarget) return;
    moveTimelinePeriodState(branchTarget.label, direction);
    branchTarget = undefined;
  };

  const openColorPicker = (event: MouseEvent) => {
    event.stopPropagation();
    if (colorTarget) {
      if (!visualSelection.ids.includes(colorTarget.id)) {
        selectVisualElement({ id: colorTarget.id, label: colorTarget.label });
      }
      openVisualColorPanel();
    }
  };

  const deleteSelection = (event: MouseEvent) => {
    event.stopPropagation();
    if (visualSelection.count > 1) {
      deleteSelectedElements();
      branchTarget = undefined;
      colorTarget = undefined;
      deleteTarget = undefined;
      return;
    }
    if (!deleteTarget) {
      return;
    }
    const deleted = deleteDiagramElement({
      occurrence: deleteTarget.occurrence,
      sourceId: deleteTarget.sourceId || undefined,
      styleId: deleteTarget.styleId || undefined,
      text: deleteTarget.label
    });
    if (deleted) clearVisualSelection();
    branchTarget = undefined;
    colorTarget = undefined;
    deleteTarget = undefined;
  };

  const clampMoodScore = (score: number): number => Math.min(Math.max(score, 1), 5);

  const isPrimaryDragStart = (event: PointerEvent | MouseEvent): boolean =>
    event.button === 0 && (!('isPrimary' in event) || event.isPrimary);

  const getMoodFaceTarget = (target: EventTarget | null): Element | undefined => {
    if (!(target instanceof Element)) return undefined;
    if (target.matches('.face')) return target;
    const featureGroup = target.closest('g');
    const face = featureGroup?.previousElementSibling;
    return face?.matches('.face') ? face : undefined;
  };

  const previewElementsForTarget = (target: Element): SVGGraphicsElement[] => {
    const preferred = target.closest<SVGGraphicsElement>('[data-visual-id], g');
    return preferred ? [preferred] : target instanceof SVGGraphicsElement ? [target] : [];
  };

  const capturePreviewElements = (elements: readonly SVGGraphicsElement[]) =>
    elements.map((element) => ({
      element,
      transform: element.getAttribute('transform') ?? ''
    }));

  const translatePreviewElements = (
    previews: readonly { element: SVGGraphicsElement; transform: string }[],
    startX: number,
    startY: number,
    clientX: number,
    clientY: number
  ): void => {
    const svg = previews[0]?.element.ownerSVGElement;
    const start = svg ? clientToSvgPoint(svg, startX, startY) : undefined;
    const current = svg ? clientToSvgPoint(svg, clientX, clientY) : undefined;
    if (!start || !current) return;
    const deltaX = current.x - start.x;
    const deltaY = current.y - start.y;
    for (const { element, transform } of previews) {
      element.setAttribute('transform', `${transform} translate(${deltaX}, ${deltaY})`.trim());
    }
  };

  const restorePreviewElements = (
    previews: readonly { element: SVGGraphicsElement; transform: string }[]
  ): void => {
    for (const { element, transform } of previews) {
      if (transform) element.setAttribute('transform', transform);
      else element.removeAttribute('transform');
    }
  };

  const startMoodDrag = (event: PointerEvent | MouseEvent) => {
    const face = getMoodFaceTarget(event.target);
    if (!isPrimaryDragStart(event) || !isJourneyState() || !face) {
      return;
    }
    const text = getEditableLabel(face, event);
    const occurrence = getTextOccurrence(face, text, event);
    const score = findJourneyScore(validatedState.current.code, text, occurrence);
    if (!text || score === undefined) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    panZoomState.suspendInteraction();
    const originalCode = validatedState.current.code;
    const related = [face, face.nextElementSibling].filter(
      (item): item is SVGGraphicsElement => item instanceof SVGGraphicsElement
    );
    moodDrag = {
      initialScore: score,
      occurrence,
      originalCode,
      previewElements: capturePreviewElements(
        related.length > 0 ? related : previewElementsForTarget(face)
      ),
      startX: event.clientX,
      startY: event.clientY,
      started: false,
      text
    };
  };

  const updateMoodDrag = (event: PointerEvent | MouseEvent) => {
    if (!moodDrag || event.buttons !== 1) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const delta = moodDrag.startY - event.clientY;
    const nextScore = clampMoodScore(moodDrag.initialScore + Math.round(delta / 36));
    const nextCode = replaceJourneyScore(
      moodDrag.originalCode,
      moodDrag.text,
      nextScore,
      moodDrag.occurrence
    );
    if (nextCode && nextCode !== moodDrag.originalCode) {
      translatePreviewElements(
        moodDrag.previewElements,
        moodDrag.startX,
        moodDrag.startY,
        event.clientX,
        event.clientY
      );
      moodDrag = { ...moodDrag, pendingCode: nextCode, started: true };
    }
  };

  const finishMoodDrag = () => {
    if (!moodDrag) return;
    const drag = moodDrag;
    moodDrag = undefined;
    panZoomState.resumeInteraction();
    if (drag.pendingCode) {
      updateCodeInteraction(drag.pendingCode, { start: true, updateDiagram: true });
    } else {
      restorePreviewElements(drag.previewElements);
    }
  };

  const startQuadrantDrag = (event: PointerEvent | MouseEvent) => {
    if (
      !isPrimaryDragStart(event) ||
      !isQuadrantState() ||
      event.target instanceof Element === false
    )
      return;
    const text = getEditableLabel(event.target, event);
    const occurrence = getTextOccurrence(event.target, text, event);
    const point = findQuadrantPoint(validatedState.current.code, text, occurrence);
    if (!text || !point) return;
    event.stopPropagation();
    panZoomState.suspendInteraction();
    const originalCode = validatedState.current.code;
    quadrantDrag = {
      initialX: point.x,
      initialY: point.y,
      occurrence,
      originalCode,
      previewElements: capturePreviewElements(previewElementsForTarget(event.target)),
      startX: event.clientX,
      startY: event.clientY,
      started: false,
      text
    };
  };

  const updateQuadrantDrag = (event: PointerEvent | MouseEvent) => {
    if (!quadrantDrag || event.buttons !== 1 || !view) return;
    const deltaX = event.clientX - quadrantDrag.startX;
    const deltaY = event.clientY - quadrantDrag.startY;
    if (!quadrantDrag.started && Math.hypot(deltaX, deltaY) < 4) return;
    event.preventDefault();
    event.stopPropagation();
    const bounds = view.getBoundingClientRect();
    const nextPoint = moveQuadrantPointByPixels({
      bounds: getQuadrantBounds(quadrantDrag.originalCode),
      deltaX,
      deltaY,
      height: bounds.height,
      point: { x: quadrantDrag.initialX, y: quadrantDrag.initialY },
      width: bounds.width
    });
    const nextCode = replaceQuadrantPoint(
      quadrantDrag.originalCode,
      quadrantDrag.text,
      nextPoint,
      quadrantDrag.occurrence
    );
    if (nextCode && nextCode !== quadrantDrag.originalCode) {
      translatePreviewElements(
        quadrantDrag.previewElements,
        quadrantDrag.startX,
        quadrantDrag.startY,
        event.clientX,
        event.clientY
      );
      quadrantDrag = { ...quadrantDrag, pendingCode: nextCode, started: true };
    }
  };

  const finishQuadrantDrag = () => {
    if (!quadrantDrag) return;
    const drag = quadrantDrag;
    quadrantDrag = undefined;
    panZoomState.resumeInteraction();
    if (drag.pendingCode) {
      updateCodeInteraction(drag.pendingCode, { start: true, updateDiagram: true });
    } else {
      restorePreviewElements(drag.previewElements);
    }
  };

  const startWardleyDrag = (event: PointerEvent | MouseEvent) => {
    if (
      !isPrimaryDragStart(event) ||
      !isWardleyState() ||
      event.target instanceof Element === false
    )
      return;
    const text = getEditableLabel(event.target, event);
    const point = findWardleyPoint(validatedState.current.code, text);
    if (!text || !point) return;
    event.stopPropagation();
    panZoomState.suspendInteraction();
    const originalCode = validatedState.current.code;
    wardleyDrag = {
      initialX: point.x,
      initialY: point.y,
      originalCode,
      previewElements: capturePreviewElements(previewElementsForTarget(event.target)),
      startX: event.clientX,
      startY: event.clientY,
      started: false,
      text
    };
  };

  const updateWardleyDrag = (event: PointerEvent | MouseEvent) => {
    if (!wardleyDrag || event.buttons !== 1 || !view) return;
    const deltaX = event.clientX - wardleyDrag.startX;
    const deltaY = event.clientY - wardleyDrag.startY;
    if (!wardleyDrag.started && Math.hypot(deltaX, deltaY) < 4) return;
    event.preventDefault();
    event.stopPropagation();
    const bounds = view.getBoundingClientRect();
    const clamp = (value: number) => Math.min(Math.max(value, 0), 1);
    const nextCode = replaceWardleyPoint(wardleyDrag.originalCode, wardleyDrag.text, {
      x: clamp(wardleyDrag.initialX - deltaY / Math.max(bounds.height, 1)),
      y: clamp(wardleyDrag.initialY + deltaX / Math.max(bounds.width, 1))
    });
    if (nextCode && nextCode !== wardleyDrag.originalCode) {
      translatePreviewElements(
        wardleyDrag.previewElements,
        wardleyDrag.startX,
        wardleyDrag.startY,
        event.clientX,
        event.clientY
      );
      wardleyDrag = { ...wardleyDrag, pendingCode: nextCode, started: true };
    }
  };

  const finishWardleyDrag = () => {
    if (!wardleyDrag) return;
    const drag = wardleyDrag;
    wardleyDrag = undefined;
    panZoomState.resumeInteraction();
    if (drag.pendingCode) {
      updateCodeInteraction(drag.pendingCode, { start: true, updateDiagram: true });
    } else {
      restorePreviewElements(drag.previewElements);
    }
  };

  const cancelPointDrag = () => {
    if (!moodDrag && !quadrantDrag && !wardleyDrag) return;
    if (moodDrag) restorePreviewElements(moodDrag.previewElements);
    if (quadrantDrag) restorePreviewElements(quadrantDrag.previewElements);
    if (wardleyDrag) restorePreviewElements(wardleyDrag.previewElements);
    moodDrag = undefined;
    quadrantDrag = undefined;
    wardleyDrag = undefined;
    panZoomState.resumeInteraction();
  };

  const connectionItems = () =>
    visualDocument.current.filter(({ id }) => !validatedState.current.visualConnections?.[id]);

  const connectionSelectionItem = (id: string): VisualSelectionItem | undefined => {
    const connection = validatedState.current.visualConnections?.[id];
    return connection
      ? {
          canDelete: true,
          canHide: true,
          id: connection.id,
          kind: 'edge',
          label: connection.label || '箭头',
          sourceId: connection.id,
          styleId: connection.id
        }
      : undefined;
  };

  const renderConnectionPreview = (
    svg: SVGSVGElement,
    preview?: VisualConnection,
    activeEndpoint?: VisualConnectionEndpoint
  ) => {
    if (preview) {
      renderVisualConnectionFrame(svg, preview, connectionItems(), {
        activeEndpoint,
        baseConnections: validatedState.current.visualConnections,
        geometry:
          connectionEndpointDrag?.geometry ??
          (connectionEditor.isCreating ? connectionCreationGeometry : undefined),
        laneOffset: connectionLaneOffsets(
          Object.values({
            ...(validatedState.current.visualConnections ?? {}),
            [preview.id]: preview
          })
        )[preview.id],
        selectedIds: new Set(visualSelection.ids),
        showAnchors: true
      });
    } else {
      renderVisualConnections(svg, validatedState.current.visualConnections, connectionItems(), {
        selectedIds: new Set(visualSelection.ids),
        showAnchors: connectionEditor.isCreating
      });
    }
    applyVisualStyles(svg, validatedState.current.visualStyles);
  };

  const endpointForCreation = (
    svg: SVGSVGElement,
    event: PointerEvent
  ): VisualConnectionEndpoint | undefined => {
    const point = clientToConnectionPoint(svg, event.clientX, event.clientY);
    if (!point) return undefined;
    const item = getVisualDocumentTarget(event.target, visualDocument.current);
    if (!item || !isStableConnectableItem(item)) return point;
    const anchors = collectVisualAnchors(svg, visualDocument.current).filter(
      ({ elementId }) => elementId === item.id
    );
    const nearest = anchors.sort(
      (left, right) =>
        Math.hypot(point.x - left.x, point.y - left.y) -
        Math.hypot(point.x - right.x, point.y - right.y)
    )[0];
    return nearest
      ? {
          anchor: nearest.anchor,
          elementId: nearest.elementId,
          x: nearest.x,
          y: nearest.y
        }
      : point;
  };

  const ensureDistinctSameNodeAnchors = (
    svg: SVGSVGElement,
    source: VisualConnectionEndpoint,
    target: VisualConnectionEndpoint
  ): VisualConnectionEndpoint => {
    if (
      !source.elementId ||
      source.elementId !== target.elementId ||
      !source.anchor ||
      source.anchor !== target.anchor
    ) {
      return target;
    }
    const opposite: Record<
      NonNullable<VisualConnectionEndpoint['anchor']>,
      NonNullable<VisualConnectionEndpoint['anchor']>
    > = {
      bottom: 'top',
      'bottom-left': 'top-right',
      'bottom-right': 'top-left',
      left: 'right',
      right: 'left',
      top: 'bottom',
      'top-left': 'bottom-right',
      'top-right': 'bottom-left'
    };
    const replacement = collectVisualAnchors(svg, visualDocument.current).find(
      ({ anchor, elementId }) =>
        elementId === source.elementId &&
        anchor === opposite[source.anchor as keyof typeof opposite]
    );
    return replacement
      ? {
          anchor: replacement.anchor,
          elementId: replacement.elementId,
          x: replacement.x,
          y: replacement.y
        }
      : target;
  };

  const connectionSnapThreshold = (event: PointerEvent): number =>
    event.pointerType === 'touch' ? TOUCH_CONNECTION_SNAP_PX : CONNECTION_SNAP_PX;

  const startConnectionInteraction = (event: PointerEvent) => {
    if (!isPrimaryDragStart(event) || activeTextEdit) return;
    const endpointHandle =
      event.target instanceof Element
        ? event.target.closest<SVGCircleElement>(
            '[data-connection-endpoint], [data-connection-endpoint-hit]'
          )
        : undefined;
    if (endpointHandle) {
      const group = endpointHandle.closest<SVGGElement>('[data-visual-connection]');
      const id = group?.dataset.visualId ?? '';
      const connection = validatedState.current.visualConnections?.[id];
      const role = (endpointHandle.dataset.connectionEndpoint ??
        endpointHandle.dataset.connectionEndpointHit) as 'source' | 'target' | undefined;
      const svg = endpointHandle.ownerSVGElement;
      if (!connection || !role || !svg || validatedState.current.visualLayers?.[id]?.locked) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      panZoomState.suspendInteraction();
      try {
        container?.setPointerCapture(event.pointerId);
      } catch {
        // Synthetic pointers may not support capture.
      }
      connectionEndpointDrag = {
        current: connection,
        geometry: collectVisualConnectionGeometry(svg, connectionItems()),
        pointerId: event.pointerId,
        role,
        svg
      };
      return;
    }
    const connectionGroup =
      event.target instanceof Element
        ? event.target.closest<SVGGElement>('[data-visual-connection]')
        : null;
    const connectionSelection = connectionSelectionItem(connectionGroup?.dataset.visualId ?? '');
    if (connectionSelection) {
      event.preventDefault();
      event.stopImmediatePropagation();
      selectVisualElement(connectionSelection);
      return;
    }
    if (!connectionEditor.isCreating) return;
    const svg = container?.querySelector<SVGSVGElement>('svg');
    const endpoint = svg ? endpointForCreation(svg, event) : undefined;
    if (!svg || !endpoint) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!connectionDraftSource) {
      connectionDraftSource = endpoint;
      connectionPreview = createVisualConnection(
        endpoint,
        endpoint,
        'connection-preview',
        inferVisualConnectionAppearance(
          svg,
          validatedState.current.visualConnections,
          endpoint.elementId
        )
      );
      connectionCreationGeometry = collectVisualConnectionGeometry(svg, connectionItems());
      setConnectionCreationPhase('target');
      renderConnectionPreview(svg, connectionPreview, endpoint);
      return;
    }
    const target = ensureDistinctSameNodeAnchors(svg, connectionDraftSource, endpoint);
    const connection = createVisualConnection(
      connectionDraftSource,
      target,
      undefined,
      inferVisualConnectionAppearance(
        svg,
        validatedState.current.visualConnections,
        connectionDraftSource.elementId
      )
    );
    if (connectionRenderFrame) cancelAnimationFrame(connectionRenderFrame);
    connectionRenderFrame = 0;
    addVisualConnection(connection);
    connectionDraftSource = undefined;
    connectionPreview = undefined;
    connectionCreationGeometry = undefined;
    finishConnectionCreation();
    suppressNextVisualClick = true;
    setTimeout(() => {
      suppressNextVisualClick = false;
    }, 0);
  };

  const updateConnectionInteraction = (event: PointerEvent) => {
    const svg = connectionEndpointDrag?.svg ?? container?.querySelector<SVGSVGElement>('svg');
    if (!svg) return;
    if (connectionEndpointDrag) {
      if (event.pointerId !== connectionEndpointDrag.pointerId || event.buttons !== 1) return;
      event.preventDefault();
      event.stopPropagation();
      const currentEndpoint = connectionEndpointDrag.current[connectionEndpointDrag.role];
      const endpoint = endpointAtClientPoint(
        svg,
        connectionItems(),
        event.clientX,
        event.clientY,
        connectionSnapThreshold(event),
        currentEndpoint.elementId && currentEndpoint.anchor
          ? { anchor: currentEndpoint.anchor, elementId: currentEndpoint.elementId }
          : undefined,
        connectionEndpointDrag.geometry
      );
      if (!endpoint) return;
      const next = {
        ...connectionEndpointDrag.current,
        [connectionEndpointDrag.role]: endpoint
      };
      connectionEndpointDrag = { ...connectionEndpointDrag, current: next };
      if (connectionRenderFrame) cancelAnimationFrame(connectionRenderFrame);
      connectionRenderFrame = requestAnimationFrame(() => {
        connectionRenderFrame = 0;
        renderConnectionPreview(svg, next, endpoint);
      });
      return;
    }
    if (!connectionEditor.isCreating || !connectionDraftSource || !connectionPreview) return;
    const endpoint = endpointAtClientPoint(
      svg,
      connectionItems(),
      event.clientX,
      event.clientY,
      connectionSnapThreshold(event),
      undefined,
      connectionCreationGeometry
    );
    if (!endpoint) return;
    const preview = { ...connectionPreview, target: endpoint };
    connectionPreview = preview;
    if (connectionRenderFrame) cancelAnimationFrame(connectionRenderFrame);
    connectionRenderFrame = requestAnimationFrame(() => {
      connectionRenderFrame = 0;
      renderConnectionPreview(svg, preview, endpoint);
    });
  };

  const finishConnectionEndpointDrag = (event: PointerEvent) => {
    if (!connectionEndpointDrag || event.pointerId !== connectionEndpointDrag.pointerId) return;
    const drag = connectionEndpointDrag;
    connectionEndpointDrag = undefined;
    if (connectionRenderFrame) cancelAnimationFrame(connectionRenderFrame);
    connectionRenderFrame = 0;
    try {
      container?.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture may already be released by the browser.
    }
    panZoomState.resumeInteraction();
    updateVisualConnection(drag.current);
  };

  const cancelConnectionEndpointDrag = (event?: PointerEvent) => {
    if (event && connectionEndpointDrag && event.pointerId !== connectionEndpointDrag.pointerId) {
      return;
    }
    const svg = connectionEndpointDrag?.svg ?? container?.querySelector<SVGSVGElement>('svg');
    connectionEndpointDrag = undefined;
    if (connectionRenderFrame) cancelAnimationFrame(connectionRenderFrame);
    connectionRenderFrame = 0;
    panZoomState.resumeInteraction();
    if (svg) renderConnectionPreview(svg);
  };

  const cancelConnectionOnBlur = () => cancelConnectionEndpointDrag();

  const startArchitectureGroupInteraction = (event: PointerEvent) => {
    if (
      !isPrimaryDragStart(event) ||
      currentDiagramKeyword() !== 'architecture-beta' ||
      activeTextEdit
    ) {
      return;
    }
    const source = architectureGroupAtElement(event.target, validatedState.current.code);
    const element =
      event.target instanceof Element
        ? event.target.closest<SVGGElement>('[data-architecture-group-id]')
        : null;
    const svg = element?.ownerSVGElement;
    const start = svg ? clientToConnectionPoint(svg, event.clientX, event.clientY) : undefined;
    if (!source || !element || !svg || !start) return;
    if (validatedState.current.visualLayers?.[source.id]?.locked) return;
    const item = visualDocument.current.find(({ id }) => id === source.id);
    if (!visualSelection.ids.includes(source.id)) {
      selectVisualElement(
        item ?? {
          canDelete: true,
          id: source.id,
          kind: 'container',
          label: source.label,
          sourceId: source.id,
          styleId: source.id
        }
      );
    }
    const resolved = architectureGroupResolvedRect(element, source);
    const resizeHandle =
      event.target instanceof Element
        ? (event.target.closest<SVGCircleElement>('[data-architecture-group-resize]')?.dataset
            .architectureGroupResize as ArchitectureResizeHandle | undefined)
        : undefined;
    const initialMemberPositions = Object.fromEntries(
      resolved.memberIds.map((id) => [
        id,
        validatedState.current.visualPositions?.[id] ?? { x: 0, y: 0 }
      ])
    );
    event.preventDefault();
    event.stopImmediatePropagation();
    panZoomState.suspendInteraction();
    try {
      container?.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic pointer sources may not expose capture.
    }
    architectureGroupDrag = {
      current: resolved,
      currentMemberPositions: initialMemberPositions,
      element,
      initial: resolved,
      initialMemberPositions,
      mode: resizeHandle ? 'resize' : 'move',
      pointerId: event.pointerId,
      resizeHandle,
      start,
      started: false,
      svg
    };
  };

  const updateArchitectureGroupInteraction = (event: PointerEvent) => {
    if (
      !architectureGroupDrag ||
      event.pointerId !== architectureGroupDrag.pointerId ||
      event.buttons !== 1
    ) {
      return;
    }
    const point = clientToConnectionPoint(architectureGroupDrag.svg, event.clientX, event.clientY);
    if (!point) return;
    const delta = {
      x: point.x - architectureGroupDrag.start.x,
      y: point.y - architectureGroupDrag.start.y
    };
    if (!architectureGroupDrag.started && Math.hypot(delta.x, delta.y) < 4) return;
    event.preventDefault();
    event.stopPropagation();
    const current =
      architectureGroupDrag.mode === 'resize' && architectureGroupDrag.resizeHandle
        ? resizeArchitectureGroup(
            architectureGroupDrag.initial,
            architectureGroupDrag.resizeHandle,
            delta
          )
        : {
            ...architectureGroupDrag.initial,
            auto: false,
            x: architectureGroupDrag.initial.x + delta.x,
            y: architectureGroupDrag.initial.y + delta.y
          };
    const currentMemberPositions =
      architectureGroupDrag.mode === 'move' && current.moveMembers
        ? Object.fromEntries(
            Object.entries(architectureGroupDrag.initialMemberPositions).map(([id, position]) => [
              id,
              { x: position.x + delta.x, y: position.y + delta.y }
            ])
          )
        : architectureGroupDrag.initialMemberPositions;
    updateRenderedArchitectureGroup(architectureGroupDrag.element, current);
    if (architectureGroupDrag.mode === 'move' && current.moveMembers) {
      applyArchitecturePositions(architectureGroupDrag.svg, validatedState.current.code, {
        ...(validatedState.current.visualPositions ?? {}),
        ...currentMemberPositions
      });
    }
    if (linkedConnectionRenderFrame) cancelAnimationFrame(linkedConnectionRenderFrame);
    const movedIds = new Set([current.id, ...Object.keys(currentMemberPositions)]);
    const dragSvg = architectureGroupDrag.svg;
    linkedConnectionRenderFrame = requestAnimationFrame(() => {
      linkedConnectionRenderFrame = 0;
      refreshVisualConnectionsForElements(
        dragSvg,
        validatedState.current.visualConnections,
        connectionItems(),
        movedIds
      );
    });
    architectureGroupDrag = {
      ...architectureGroupDrag,
      current,
      currentMemberPositions,
      started: true
    };
  };

  const finishArchitectureGroupInteraction = (event: PointerEvent) => {
    if (!architectureGroupDrag || event.pointerId !== architectureGroupDrag.pointerId) return;
    const drag = architectureGroupDrag;
    architectureGroupDrag = undefined;
    if (linkedConnectionRenderFrame) {
      cancelAnimationFrame(linkedConnectionRenderFrame);
      linkedConnectionRenderFrame = 0;
    }
    try {
      container?.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture may already be released.
    }
    panZoomState.resumeInteraction();
    if (!drag.started) return;
    refreshVisualConnectionsForElements(
      drag.svg,
      validatedState.current.visualConnections,
      connectionItems(),
      new Set([drag.current.id, ...Object.keys(drag.currentMemberPositions)])
    );
    updateArchitectureGroup(
      drag.current,
      drag.mode === 'move' && drag.current.moveMembers ? drag.currentMemberPositions : {}
    );
  };

  const cancelArchitectureGroupInteraction = (event?: PointerEvent) => {
    if (event && architectureGroupDrag && event.pointerId !== architectureGroupDrag.pointerId) {
      return;
    }
    const drag = architectureGroupDrag;
    architectureGroupDrag = undefined;
    panZoomState.resumeInteraction();
    if (!drag) return;
    if (linkedConnectionRenderFrame) {
      cancelAnimationFrame(linkedConnectionRenderFrame);
      linkedConnectionRenderFrame = 0;
    }
    renderArchitectureGroups(drag.svg, validatedState.current.code, new Set(visualSelection.ids));
    applyArchitecturePositions(
      drag.svg,
      validatedState.current.code,
      validatedState.current.visualPositions
    );
  };

  const cancelArchitectureGroupOnBlur = () => cancelArchitectureGroupInteraction();

  type FreeLayoutKind = NonNullable<typeof blockDrag>['kind'];

  const clientBoundsOf = (elements: readonly Element[]): ClientBounds => {
    const bounds = elements.map((element) => element.getBoundingClientRect());
    const left = Math.min(...bounds.map((item) => item.left));
    const right = Math.max(...bounds.map((item) => item.right));
    const top = Math.min(...bounds.map((item) => item.top));
    const bottom = Math.max(...bounds.map((item) => item.bottom));
    return { bottom, height: bottom - top, left, right, top, width: right - left };
  };

  const startFreeLayoutDrag = (
    event: PointerEvent | MouseEvent,
    kind: FreeLayoutKind,
    getNodeId: (target: EventTarget | null) => string
  ) => {
    if (!isPrimaryDragStart(event)) return;
    const id = getNodeId(event.target);
    const svg = container?.querySelector<SVGSVGElement>('svg');
    const pointerStart = svg ? clientToSvgPoint(svg, event.clientX, event.clientY) : undefined;
    if (!id || !svg || !pointerStart) return;
    if (validatedState.current.visualLayers?.[id]?.locked) return;
    const documentItem = getVisualDocumentTarget(event.target, visualDocument.current);
    if (documentItem && !visualSelection.ids.includes(id)) {
      selectVisualElement(documentItem, {
        additive: event.shiftKey || event.ctrlKey || event.metaKey
      });
    }
    const selectedIds = new Set(visualSelection.ids.includes(id) ? visualSelection.ids : [id]);
    const group = visualDocument.current.filter(
      (item) =>
        selectedIds.has(item.id) &&
        item.layoutKind === kind &&
        !validatedState.current.visualLayers?.[item.id]?.locked
    );
    const movableItems = group.length > 0 ? group : documentItem ? [documentItem] : [];
    if (movableItems.length === 0) return;
    const initial = Object.fromEntries(
      movableItems.map((item) => [
        item.id,
        validatedState.current.visualPositions?.[item.id] ?? { x: 0, y: 0 }
      ])
    );
    const initialBounds = clientBoundsOf(movableItems.map(({ element }) => element));
    const otherBounds = visualDocument.current
      .filter(
        (item) =>
          item.layoutKind === kind &&
          !selectedIds.has(item.id) &&
          !validatedState.current.visualLayers?.[item.id]?.hidden
      )
      .map(({ element }) => clientBoundsOf([element]));
    // Claim module gestures before svg-pan-zoom can interpret them as canvas panning.
    event.stopPropagation();
    panZoomState.suspendInteraction();
    const pointerId = 'pointerId' in event ? event.pointerId : undefined;
    blockDrag = {
      current: initial,
      id,
      initial,
      initialBounds,
      kind,
      otherBounds,
      pointerClientStart: { x: event.clientX, y: event.clientY },
      pointerId,
      pointerStart,
      started: false,
      svg
    };
  };

  const startBlockDrag = (event: PointerEvent | MouseEvent) => {
    if (currentDiagramKeyword() !== 'block-beta' || activeTextEdit || blockArrowSourceLabel) return;
    startFreeLayoutDrag(event, 'block', getBlockNodeId);
  };

  const startC4Drag = (event: PointerEvent | MouseEvent) => {
    if (!currentDiagramKeyword().startsWith('c4') || activeTextEdit) return;
    startFreeLayoutDrag(event, 'c4', getC4NodeId);
  };

  const startArchitectureDrag = (event: PointerEvent | MouseEvent) => {
    if (currentDiagramKeyword() !== 'architecture-beta' || activeTextEdit) return;
    startFreeLayoutDrag(event, 'architecture', getArchitectureNodeId);
  };

  const stopCanvasGestureFromFreeLayoutNode = (event: MouseEvent | TouchEvent) => {
    const keyword = currentDiagramKeyword();
    const id = keyword.startsWith('c4')
      ? getC4NodeId(event.target)
      : keyword === 'block-beta'
        ? getBlockNodeId(event.target)
        : keyword === 'architecture-beta'
          ? getArchitectureNodeId(event.target)
          : '';
    if (!id) return;
    event.stopPropagation();
    if (event.type === 'touchstart') event.preventDefault();
  };

  const updateBlockDrag = (event: PointerEvent | MouseEvent) => {
    if (!blockDrag || event.buttons !== 1) return;
    const rawClientDelta = {
      x: event.clientX - blockDrag.pointerClientStart.x,
      y: event.clientY - blockDrag.pointerClientStart.y
    };
    const viewBounds = view?.getBoundingClientRect();
    const snap = calculateSnap({
      deltaX: rawClientDelta.x,
      deltaY: rawClientDelta.y,
      gridOrigin: { x: viewBounds?.left ?? 0, y: viewBounds?.top ?? 0 },
      moving: blockDrag.initialBounds,
      others: blockDrag.otherBounds,
      snapToGrid: Boolean(validatedState.current.grid && validatedState.current.snapToGrid),
      threshold: 8
    });
    const point = clientToSvgPoint(
      blockDrag.svg,
      blockDrag.pointerClientStart.x + snap.deltaX,
      blockDrag.pointerClientStart.y + snap.deltaY
    );
    if (!point) return;
    const delta = { x: point.x - blockDrag.pointerStart.x, y: point.y - blockDrag.pointerStart.y };
    if (!blockDrag.started && Math.hypot(delta.x, delta.y) < 5) return;
    if (!blockDrag.started && blockDrag.pointerId !== undefined && container?.setPointerCapture) {
      try {
        container.setPointerCapture(blockDrag.pointerId);
      } catch {
        // Some synthetic pointer sources do not expose a capturable pointer.
      }
    }
    event.preventDefault();
    event.stopPropagation();
    const current = Object.fromEntries(
      Object.entries(blockDrag.initial).map(([id, position]) => [
        id,
        { x: position.x + delta.x, y: position.y + delta.y }
      ])
    );
    const nextPositions = { ...(validatedState.current.visualPositions ?? {}), ...current };
    const movedEntries = Object.entries(current);
    if (movedEntries.length === 1) {
      const [movedId, position] = movedEntries[0];
      if (blockDrag.kind === 'block') {
        moveBlockNode(blockDrag.svg, validatedState.current.code, movedId, position);
      } else if (blockDrag.kind === 'c4') {
        moveC4Node(blockDrag.svg, validatedState.current.code, movedId, position);
      } else {
        moveArchitectureNode(
          blockDrag.svg,
          validatedState.current.code,
          movedId,
          position,
          validatedState.current.visualPositions
        );
      }
    } else if (blockDrag.kind === 'block') {
      applyBlockPositions(blockDrag.svg, validatedState.current.code, nextPositions);
    } else if (blockDrag.kind === 'c4') {
      applyC4Positions(blockDrag.svg, validatedState.current.code, nextPositions);
    } else {
      applyArchitecturePositions(blockDrag.svg, validatedState.current.code, nextPositions);
    }
    if (linkedConnectionRenderFrame) cancelAnimationFrame(linkedConnectionRenderFrame);
    const movedIds = new Set(Object.keys(current));
    const dragSvg = blockDrag.svg;
    linkedConnectionRenderFrame = requestAnimationFrame(() => {
      linkedConnectionRenderFrame = 0;
      refreshVisualConnectionsForElements(
        dragSvg,
        validatedState.current.visualConnections,
        connectionItems(),
        movedIds
      );
      applyVisualStyles(dragSvg, validatedState.current.visualStyles);
    });
    snapGuides = snap.guides;
    blockDrag = { ...blockDrag, current, started: true };
  };

  const releaseBlockPointer = (pointerId?: number) => {
    if (pointerId === undefined || !container?.hasPointerCapture?.(pointerId)) return;
    try {
      container.releasePointerCapture(pointerId);
    } catch {
      // The browser may already have released it while ending the gesture.
    }
  };

  const finishBlockDrag = (event: Event) => {
    if (!blockDrag) return;
    if (
      event instanceof PointerEvent &&
      blockDrag.pointerId !== undefined &&
      event.pointerId !== blockDrag.pointerId
    ) {
      return;
    }
    const drag = blockDrag;
    blockDrag = undefined;
    snapGuides = [];
    releaseBlockPointer(drag.pointerId);
    panZoomState.resumeInteraction();
    if (!drag.started) return;
    if (event.cancelable) event.preventDefault();
    event.stopPropagation();
    suppressVisualClickUntil = performance.now() + 300;
    if (linkedConnectionRenderFrame) {
      cancelAnimationFrame(linkedConnectionRenderFrame);
      linkedConnectionRenderFrame = 0;
    }
    refreshVisualConnectionsForElements(
      drag.svg,
      validatedState.current.visualConnections,
      connectionItems(),
      new Set(Object.keys(drag.current))
    );
    if (drag.kind === 'architecture') {
      const groups = parseArchitectureGroups(validatedState.current.code);
      if (groups.length > 0) {
        updateArchitectureGroups(
          reconcileArchitectureGroupMembership(drag.svg, groups, Object.keys(drag.current)),
          drag.current
        );
        return;
      }
    }
    updateVisualPositionsBatch(drag.current);
  };

  const cancelBlockDrag = (event?: Event) => {
    if (
      event instanceof PointerEvent &&
      blockDrag?.pointerId !== undefined &&
      event.pointerId !== blockDrag.pointerId
    ) {
      return;
    }
    if (blockDrag) {
      if (linkedConnectionRenderFrame) {
        cancelAnimationFrame(linkedConnectionRenderFrame);
        linkedConnectionRenderFrame = 0;
      }
      releaseBlockPointer(blockDrag.pointerId);
      if (blockDrag.kind === 'block') {
        applyBlockPositions(
          blockDrag.svg,
          validatedState.current.code,
          validatedState.current.visualPositions
        );
      } else if (blockDrag.kind === 'c4') {
        applyC4Positions(
          blockDrag.svg,
          validatedState.current.code,
          validatedState.current.visualPositions
        );
      } else {
        applyArchitecturePositions(
          blockDrag.svg,
          validatedState.current.code,
          validatedState.current.visualPositions
        );
      }
    }
    blockDrag = undefined;
    snapGuides = [];
    panZoomState.resumeInteraction();
  };

  const isBlankCanvasTarget = (target: EventTarget | null): boolean =>
    target instanceof Element &&
    Boolean(target.closest('#container')) &&
    !target.closest('[data-visual-id]') &&
    !target.closest('text, tspan, foreignObject');

  const startMarquee = (event: PointerEvent) => {
    if (
      event.pointerType === 'touch' ||
      !isPrimaryDragStart(event) ||
      activeTextEdit ||
      !isBlankCanvasTarget(event.target) ||
      (!visualSelection.isSelectionMode && !event.shiftKey)
    ) {
      return;
    }
    const rect = view?.getBoundingClientRect();
    if (!rect) return;
    event.preventDefault();
    event.stopPropagation();
    panZoomState.suspendInteraction();
    const pointerId = event.pointerId;
    try {
      container?.setPointerCapture(pointerId);
    } catch {
      // Synthetic and older touch sources do not always expose pointer capture.
    }
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    marquee = {
      additive: event.ctrlKey || event.metaKey || event.shiftKey ? [...visualSelection.items] : [],
      currentX: x,
      currentY: y,
      pointerId,
      startX: x,
      startY: y,
      started: false
    };
  };

  const updateMarquee = (event: PointerEvent) => {
    if (!marquee || event.buttons !== 1 || !view) return;
    event.preventDefault();
    event.stopPropagation();
    const viewRect = view.getBoundingClientRect();
    const currentX = event.clientX - viewRect.left;
    const currentY = event.clientY - viewRect.top;
    const left = viewRect.left + Math.min(marquee.startX, currentX);
    const right = viewRect.left + Math.max(marquee.startX, currentX);
    const top = viewRect.top + Math.min(marquee.startY, currentY);
    const bottom = viewRect.top + Math.max(marquee.startY, currentY);
    const matches = visualDocument.current.filter((item) => {
      if (validatedState.current.visualLayers?.[item.id]?.hidden) return false;
      const bounds = item.element.getBoundingClientRect();
      return (
        bounds.right >= left && bounds.left <= right && bounds.bottom >= top && bounds.top <= bottom
      );
    });
    marquee = {
      ...marquee,
      currentX,
      currentY,
      started:
        marquee.started || Math.hypot(currentX - marquee.startX, currentY - marquee.startY) >= 4
    };
    setVisualSelection([...marquee.additive, ...matches]);
  };

  const finishMarquee = (event: PointerEvent) => {
    if (!marquee) return;
    if (marquee.pointerId !== undefined && event.pointerId !== marquee.pointerId) return;
    const pointerId = marquee.pointerId;
    const started = marquee.started;
    marquee = undefined;
    if (pointerId !== undefined && container?.hasPointerCapture(pointerId)) {
      try {
        container.releasePointerCapture(pointerId);
      } catch {
        // The browser may have released it already.
      }
    }
    panZoomState.resumeInteraction();
    if (started) suppressVisualClickUntil = performance.now() + 300;
    event.preventDefault();
    event.stopPropagation();
  };

  const cancelMarquee = (event?: Event) => {
    if (
      event instanceof PointerEvent &&
      marquee?.pointerId !== undefined &&
      event.pointerId !== marquee.pointerId
    ) {
      return;
    }
    const pointerId = marquee?.pointerId;
    marquee = undefined;
    if (pointerId !== undefined && container?.hasPointerCapture(pointerId)) {
      try {
        container.releasePointerCapture(pointerId);
      } catch {
        // The browser may have released it while cancelling the gesture.
      }
    }
    panZoomState.resumeInteraction();
  };

  const supportsStructuralDrag = () =>
    ['gantt', 'kanban', 'requirementdiagram'].includes(currentDiagramKeyword());

  const startStructuralDrag = (event: PointerEvent | MouseEvent) => {
    if (
      !isPrimaryDragStart(event) ||
      !supportsStructuralDrag() ||
      event.target instanceof Element === false
    )
      return;
    const sourceLabel = getEditableLabel(event.target, event);
    if (!sourceLabel || !findVisualTextRange(validatedState.current.code, { text: sourceLabel }))
      return;
    event.stopPropagation();
    panZoomState.suspendInteraction();
    structuralDrag = {
      sourceLabel,
      startX: event.clientX,
      startY: event.clientY,
      started: false
    };
  };

  const updateStructuralDrag = (event: PointerEvent | MouseEvent) => {
    if (!structuralDrag || event.buttons !== 1) return;
    if (
      !structuralDrag.started &&
      Math.hypot(event.clientX - structuralDrag.startX, event.clientY - structuralDrag.startY) < 8
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    suppressVisualClickUntil = performance.now() + 300;
    const target = document.elementFromPoint(event.clientX, event.clientY);
    const targetLabel = getEditableLabel(target, event);
    structuralDrag = {
      ...structuralDrag,
      started: true,
      targetLabel: targetLabel || structuralDrag.targetLabel
    };
  };

  const finishStructuralDrag = (event: PointerEvent | MouseEvent) => {
    if (!structuralDrag) return;
    const drag = structuralDrag;
    structuralDrag = undefined;
    panZoomState.resumeInteraction();
    if (!drag.started) return;
    event.preventDefault();
    event.stopPropagation();
    const target = document.elementFromPoint(event.clientX, event.clientY);
    const targetLabel = getEditableLabel(target, event) || drag.targetLabel;
    if (!targetLabel) return;
    const nextCode = moveDiagramElementCode(
      validatedState.current.code,
      drag.sourceLabel,
      targetLabel
    );
    if (nextCode && nextCode !== validatedState.current.code) {
      updateCodeInteraction(nextCode, { start: true, updateDiagram: true });
    }
  };

  const cancelStructuralDrag = () => {
    structuralDrag = undefined;
    panZoomState.resumeInteraction();
  };

  const getInlineTextEditRange = (text: string, sourceId: string, occurrence: number) =>
    findVisualTextRange(validatedState.current.code, {
      occurrence,
      sourceId: sourceId || undefined,
      text
    });

  const startInlineTextEditForTarget = (
    target: EventTarget | null,
    point?: { clientX: number; clientY: number }
  ) => {
    if (
      target instanceof Element &&
      target.closest(
        '.branch-button, .color-button, .delete-button, .timeline-order-button, .diagram-special-button'
      )
    ) {
      return;
    }
    const textElement = getEditableTextElement(target);
    const text = getEditableLabel(target, point);
    if (!view || !textElement || !text) {
      activeTextEdit = undefined;
      return;
    }

    const sourceId = getVisualSourceId(target);
    const occurrence = getTextOccurrence(target, text, point);
    const displayText = normalizeVisibleText(getTextLeafElement(target, point)?.textContent ?? '');
    const range =
      findRequirementFieldRange(validatedState.current.code, displayText, sourceId) ??
      getInlineTextEditRange(text, sourceId, occurrence);
    if (!range) {
      requestEditorFocus(text, sourceId || undefined, occurrence);
      return;
    }

    const textRect = textElement.getBoundingClientRect();
    const viewRect = view.getBoundingClientRect();
    openInlineTextEdit({
      code: validatedState.current.code,
      currentText: text,
      height: Math.max(34, textRect.height + 14),
      originalText: text,
      range,
      width: Math.max(160, textRect.width + 36),
      x: Math.min(Math.max(textRect.left - viewRect.left - 12, 8), viewRect.width - 180),
      y: Math.min(Math.max(textRect.top - viewRect.top - 8, 8), viewRect.height - 44)
    });
  };

  const startInlineTextEdit = (event: MouseEvent) => {
    startInlineTextEditForTarget(event.target, event);
  };

  const applyInlineTextEdit = (nextText: string) => {
    if (!activeTextEdit) {
      return;
    }
    activeTextEdit = {
      ...activeTextEdit,
      currentText: nextText
    };
  };

  const finishInlineTextEdit = () => {
    if (activeTextEdit && activeTextEdit.currentText !== activeTextEdit.originalText) {
      const next = replaceDiagramVisualText(
        activeTextEdit.code,
        activeTextEdit.range,
        activeTextEdit.originalText,
        activeTextEdit.currentText
      );
      updateCodeInteraction(next.code, { start: true, updateDiagram: true });
    }
    activeTextEditReady = false;
    activeTextEditRevision += 1;
    activeTextEdit = undefined;
  };

  const cancelInlineTextEdit = () => {
    activeTextEditReady = false;
    activeTextEditRevision += 1;
    activeTextEdit = undefined;
  };

  const handleInlineTextKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      finishInlineTextEdit();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      cancelInlineTextEdit();
    }
  };

  const handleVisualTextFocus = (event: MouseEvent) => {
    if (connectionEditor.isCreating || suppressNextVisualClick) {
      suppressNextVisualClick = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (performance.now() < suppressVisualClickUntil) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (
      event.target instanceof Element &&
      event.target.closest(
        '.branch-button, .color-button, .delete-button, .timeline-order-button, .diagram-special-button'
      )
    ) {
      return;
    }
    const connectionElement =
      event.target instanceof Element
        ? event.target.closest<SVGGElement>('[data-visual-connection]')
        : null;
    const connectionId = connectionElement?.dataset.visualId ?? '';
    const connectionTarget = connectionSelectionItem(connectionId);
    const documentTarget =
      getVisualDocumentTarget(event.target, visualDocument.current) ?? connectionTarget;
    const styleTarget = getStyleTarget(event.target);
    const text = getEditableLabel(event.target, event);
    const sourceId = documentTarget?.sourceId ?? getVisualSourceId(event.target);
    const occurrence = getTextOccurrence(event.target, text, event);
    const styleId = documentTarget?.styleId ?? (styleTarget ? getStyleID(styleTarget) : '');
    const isBlockEdge = currentDiagramKeyword() === 'block-beta' && /(?:^|-)L_/.test(styleId);
    const isIndependentConnection = Boolean(
      documentTarget && validatedState.current.visualConnections?.[documentTarget.id]
    );
    if (!text && !styleId && !documentTarget) {
      branchTarget = undefined;
      colorTarget = undefined;
      deleteTarget = undefined;
      if (!event.shiftKey && !event.ctrlKey && !event.metaKey) clearVisualSelection();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (documentTarget) {
      const additive =
        event.shiftKey || event.ctrlKey || event.metaKey || visualSelection.isSelectionMode;
      selectVisualElement(documentTarget, { additive, toggle: additive });
    } else if (styleId) {
      selectVisualElement(
        { id: styleId, label: text || '选中元素', occurrence, sourceId, styleId },
        {
          additive: event.shiftKey || event.ctrlKey || event.metaKey,
          toggle: event.shiftKey || event.ctrlKey || event.metaKey
        }
      );
    }
    const locked = Boolean(
      documentTarget && validatedState.current.visualLayers?.[documentTarget.id]?.locked
    );
    if (isIndependentConnection) {
      branchTarget = undefined;
      colorTarget = undefined;
      deleteTarget = undefined;
      return;
    }
    if (isBlockEdge) {
      branchTarget = undefined;
      if (!locked) showDeleteButton(event, '', '箭头', 0, styleId);
      if (!locked) showColorButton(event, styleId, '箭头');
      else colorTarget = undefined;
      return;
    }
    if (blockArrowSourceLabel && text && currentDiagramKeyword() === 'block-beta') {
      addBlockArrow(blockArrowSourceLabel, text);
      blockArrowSourceLabel = '';
      branchTarget = undefined;
      colorTarget = undefined;
      deleteTarget = undefined;
      return;
    }
    if (text && !locked) {
      requestEditorFocus(text, sourceId || undefined, occurrence);
      showBranchButton(event, sourceId, text);
      showDeleteButton(event, sourceId, text, occurrence, styleId);
    } else {
      branchTarget = undefined;
      deleteTarget = undefined;
    }
    if (!locked) {
      showColorButton(
        event,
        styleId,
        visualSelection.count > 1 ? `${visualSelection.count} 个元素` : text
      );
    } else {
      colorTarget = undefined;
    }
  };

  const handleVisualTextDoubleClick = (event: MouseEvent) => {
    const item = getVisualDocumentTarget(event.target, visualDocument.current);
    if (item && validatedState.current.visualLayers?.[item.id]?.locked) return;
    event.preventDefault();
    event.stopPropagation();
    if (item && validatedState.current.visualConnections?.[item.id]) {
      selectVisualElement(item);
      requestAnimationFrame(() =>
        view?.querySelector<HTMLInputElement>('[data-testid="connection-toolbar"] input')?.focus()
      );
      return;
    }
    startInlineTextEdit(event);
  };

  const enableVisualTextFocus = (graphDiv: SVGSVGElement) => {
    graphDiv.classList.add('visual-text-editing');
  };

  const handleStateChange = async (state: ValidatedState) => {
    const startTime = Date.now();
    if (state.error !== undefined) {
      error = true;
      return;
    }
    error = false;
    let diagramType: string | undefined;
    try {
      if (container) {
        manualUpdate = true;
        const nextVisualStylesFingerprint = JSON.stringify(state.visualStyles ?? {});
        const nextVisualPositionsFingerprint = JSON.stringify(state.visualPositions ?? {});
        const nextVisualLayersFingerprint = JSON.stringify(state.visualLayers ?? {});
        const nextVisualConnectionsFingerprint = JSON.stringify(state.visualConnections ?? {});
        // Do not render if there is no change in Code/Config/PanZoom
        if (
          code === state.code &&
          config === state.mermaid &&
          rough === state.rough &&
          panZoom === state.panZoom &&
          visualStylesFingerprint === nextVisualStylesFingerprint &&
          visualPositionsFingerprint === nextVisualPositionsFingerprint &&
          visualLayersFingerprint === nextVisualLayersFingerprint &&
          visualConnectionsFingerprint === nextVisualConnectionsFingerprint
        ) {
          return;
        }

        const renderedContentChanged =
          code !== state.code ||
          config !== state.mermaid ||
          rough !== state.rough ||
          visualStylesFingerprint !== nextVisualStylesFingerprint;
        if (renderedContentChanged) {
          branchTarget = undefined;
          colorTarget = undefined;
          deleteTarget = undefined;
          blockArrowSourceLabel = '';
          if (connectionEditor.isCreating) finishConnectionCreation();
          connectionDraftSource = undefined;
          connectionPreview = undefined;
          connectionCreationGeometry = undefined;
          if (activeTextEdit && activeTextEdit.code !== state.code) {
            activeTextEditReady = false;
            activeTextEditRevision += 1;
            activeTextEdit = undefined;
          }
        }

        const visualStylesChanged = visualStylesFingerprint !== nextVisualStylesFingerprint;
        const visualLayersChanged = visualLayersFingerprint !== nextVisualLayersFingerprint;
        const visualConnectionsChanged =
          visualConnectionsFingerprint !== nextVisualConnectionsFingerprint;
        const mustClearVisualStyles =
          visualStylesChanged && Object.keys(state.visualStyles ?? {}).length === 0;

        if (
          code === state.code &&
          config === state.mermaid &&
          rough === state.rough &&
          panZoom === state.panZoom &&
          ((visualStylesChanged && !mustClearVisualStyles) ||
            visualPositionsFingerprint !== nextVisualPositionsFingerprint ||
            visualLayersChanged ||
            visualConnectionsChanged)
        ) {
          const graphDiv = container.querySelector<SVGSVGElement>('svg');
          if (graphDiv) {
            prepareStyleTargets(graphDiv, state.code);
            if (getDiagramKeyword(state.code) === 'block-beta') {
              applyBlockPositions(graphDiv, state.code, state.visualPositions);
            } else if (getDiagramKeyword(state.code).startsWith('c4')) {
              applyC4Positions(graphDiv, state.code, state.visualPositions);
            } else if (getDiagramKeyword(state.code) === 'architecture-beta') {
              applyArchitecturePositions(graphDiv, state.code, state.visualPositions);
            }
            refreshVisualDocument(graphDiv, state);
            applyVisualStyles(graphDiv, state.visualStyles);
          }
          visualStylesFingerprint = nextVisualStylesFingerprint;
          visualPositionsFingerprint = nextVisualPositionsFingerprint;
          visualLayersFingerprint = nextVisualLayersFingerprint;
          visualConnectionsFingerprint = nextVisualConnectionsFingerprint;
          return;
        }

        if (!shouldRefreshView() && !mustClearVisualStyles) {
          return;
        }

        code = state.code;
        config = state.mermaid;
        rough = state.rough;
        panZoom = state.panZoom ?? true;
        visualStylesFingerprint = nextVisualStylesFingerprint;
        visualPositionsFingerprint = nextVisualPositionsFingerprint;
        visualLayersFingerprint = nextVisualLayersFingerprint;
        visualConnectionsFingerprint = nextVisualConnectionsFingerprint;

        if (mayContainFontAwesome(code)) {
          await waitForFontAwesomeToLoad?.();
        }

        const scroll = view?.parentElement?.scrollTop;
        delete container.dataset.processed;
        const viewID = uniqueID('graph-');
        const {
          svg,
          bindFunctions,
          diagramType: detectedDiagramType
        } = await renderDiagram(JSON.parse(state.mermaid) as MermaidConfig, code, viewID);
        diagramType = detectedDiagramType;
        if (svg.length > 0) {
          // eslint-disable-next-line svelte/no-dom-manipulating
          container.innerHTML = svg;
          let graphDiv = container.querySelector<SVGSVGElement>(`#${viewID}`);
          if (!graphDiv) {
            throw new Error('graph-div not found');
          }
          if (state.rough) {
            const svg2roughjs = new Svg2Roughjs('#container');
            svg2roughjs.svg = graphDiv;
            await svg2roughjs.sketch();
            graphDiv.remove();
            const sketch = container.querySelector<SVGSVGElement>(':scope > svg');
            if (!sketch) {
              throw new Error('sketch not found');
            }
            const height = sketch.getAttribute('height');
            const width = sketch.getAttribute('width');
            sketch.setAttribute('id', 'graph-div');
            sketch.setAttribute('viewBox', `0 0 ${width} ${height}`);
            graphDiv = sketch;
            releaseCanvasBounds(graphDiv);
          } else {
            releaseCanvasBounds(graphDiv);
            if (bindFunctions) {
              bindFunctions(graphDiv);
            }
          }
          if (state.panZoom) {
            handlePanZoom(state, graphDiv);
          }
          enableVisualTextFocus(graphDiv);
          prepareStyleTargets(graphDiv, state.code);
          if (getDiagramKeyword(state.code) === 'block-beta') {
            applyBlockPositions(graphDiv, state.code, state.visualPositions);
          } else if (getDiagramKeyword(state.code).startsWith('c4')) {
            applyC4Positions(graphDiv, state.code, state.visualPositions);
          } else if (getDiagramKeyword(state.code) === 'architecture-beta') {
            applyArchitecturePositions(graphDiv, state.code, state.visualPositions);
          }
          refreshVisualDocument(graphDiv, state);
          applyVisualStyles(graphDiv, state.visualStyles);
          if (state.panZoom) schedulePostRenderViewportFit();
          schedulePendingBranchFocus();
        }
        if (view?.parentElement && scroll) {
          view.parentElement.scrollTop = scroll;
        }
        error = false;
      } else if (manualUpdate) {
        manualUpdate = false;
      }
    } catch (error_) {
      console.error('view fail', error_);
      error = true;
    }
    const renderTime = Date.now() - startTime;
    saveStatistics({ code, diagramType, isRough: state.rough, renderTime });
    recordRenderTime(renderTime, () => {
      updateCodeStore({ updateDiagram: true });
    });
  };

  onMount(() => {
    setupPanZoomObserver();
    const containerElement = container;
    const captureOptions = { capture: true };
    const touchCaptureOptions = { capture: true, passive: false };
    containerElement?.addEventListener(
      'mousedown',
      stopCanvasGestureFromFreeLayoutNode,
      captureOptions
    );
    containerElement?.addEventListener(
      'touchstart',
      stopCanvasGestureFromFreeLayoutNode,
      touchCaptureOptions
    );
    containerElement?.addEventListener('pointerdown', startConnectionInteraction, captureOptions);
    containerElement?.addEventListener(
      'pointerdown',
      startArchitectureGroupInteraction,
      captureOptions
    );
    containerElement?.addEventListener('pointerdown', startMoodDrag, captureOptions);
    containerElement?.addEventListener('pointerdown', startMarquee, captureOptions);
    containerElement?.addEventListener('pointerdown', startQuadrantDrag, captureOptions);
    containerElement?.addEventListener('pointerdown', startWardleyDrag, captureOptions);
    containerElement?.addEventListener('pointerdown', startBlockDrag, captureOptions);
    containerElement?.addEventListener('pointerdown', startC4Drag, captureOptions);
    containerElement?.addEventListener('pointerdown', startArchitectureDrag, captureOptions);
    containerElement?.addEventListener('pointerdown', startStructuralDrag, captureOptions);
    containerElement?.addEventListener('lostpointercapture', finishBlockDrag, captureOptions);
    window.addEventListener('pointermove', updateMoodDrag, captureOptions);
    window.addEventListener('pointermove', updateConnectionInteraction, captureOptions);
    window.addEventListener('pointermove', updateArchitectureGroupInteraction, captureOptions);
    window.addEventListener('pointermove', updateMarquee, captureOptions);
    window.addEventListener('pointermove', updateQuadrantDrag, captureOptions);
    window.addEventListener('pointermove', updateWardleyDrag, captureOptions);
    window.addEventListener('pointermove', updateBlockDrag, captureOptions);
    window.addEventListener('pointermove', updateStructuralDrag, captureOptions);
    window.addEventListener('pointerup', finishMoodDrag, captureOptions);
    window.addEventListener('pointerup', finishConnectionEndpointDrag, captureOptions);
    window.addEventListener('pointerup', finishArchitectureGroupInteraction, captureOptions);
    window.addEventListener('pointerup', finishMarquee, captureOptions);
    window.addEventListener('pointerup', finishQuadrantDrag, captureOptions);
    window.addEventListener('pointerup', finishWardleyDrag, captureOptions);
    window.addEventListener('pointerup', finishBlockDrag, captureOptions);
    window.addEventListener('pointerup', finishStructuralDrag, captureOptions);
    window.addEventListener('pointercancel', cancelStructuralDrag, captureOptions);
    window.addEventListener('pointercancel', cancelConnectionEndpointDrag, captureOptions);
    window.addEventListener('pointercancel', cancelArchitectureGroupInteraction, captureOptions);
    window.addEventListener('pointercancel', cancelMarquee, captureOptions);
    window.addEventListener('pointercancel', cancelBlockDrag, captureOptions);
    window.addEventListener('pointercancel', cancelPointDrag, captureOptions);
    window.addEventListener('blur', cancelStructuralDrag);
    window.addEventListener('blur', cancelConnectionOnBlur);
    window.addEventListener('blur', cancelArchitectureGroupOnBlur);
    window.addEventListener('blur', cancelMarquee);
    window.addEventListener('blur', cancelBlockDrag);
    window.addEventListener('blur', cancelPointDrag);
    containerElement?.addEventListener('click', handleVisualTextFocus, captureOptions);
    containerElement?.addEventListener('dblclick', handleVisualTextDoubleClick, captureOptions);

    return () => {
      containerElement?.removeEventListener(
        'mousedown',
        stopCanvasGestureFromFreeLayoutNode,
        captureOptions
      );
      containerElement?.removeEventListener(
        'touchstart',
        stopCanvasGestureFromFreeLayoutNode,
        touchCaptureOptions
      );
      containerElement?.removeEventListener(
        'pointerdown',
        startConnectionInteraction,
        captureOptions
      );
      containerElement?.removeEventListener(
        'pointerdown',
        startArchitectureGroupInteraction,
        captureOptions
      );
      containerElement?.removeEventListener('pointerdown', startMoodDrag, captureOptions);
      containerElement?.removeEventListener('pointerdown', startMarquee, captureOptions);
      containerElement?.removeEventListener('pointerdown', startQuadrantDrag, captureOptions);
      containerElement?.removeEventListener('pointerdown', startWardleyDrag, captureOptions);
      containerElement?.removeEventListener('pointerdown', startBlockDrag, captureOptions);
      containerElement?.removeEventListener('pointerdown', startC4Drag, captureOptions);
      containerElement?.removeEventListener('pointerdown', startArchitectureDrag, captureOptions);
      containerElement?.removeEventListener('pointerdown', startStructuralDrag, captureOptions);
      containerElement?.removeEventListener('lostpointercapture', finishBlockDrag, captureOptions);
      window.removeEventListener('pointermove', updateMoodDrag, captureOptions);
      window.removeEventListener('pointermove', updateConnectionInteraction, captureOptions);
      window.removeEventListener('pointermove', updateArchitectureGroupInteraction, captureOptions);
      window.removeEventListener('pointermove', updateMarquee, captureOptions);
      window.removeEventListener('pointermove', updateQuadrantDrag, captureOptions);
      window.removeEventListener('pointermove', updateWardleyDrag, captureOptions);
      window.removeEventListener('pointermove', updateBlockDrag, captureOptions);
      window.removeEventListener('pointermove', updateStructuralDrag, captureOptions);
      window.removeEventListener('pointerup', finishMoodDrag, captureOptions);
      window.removeEventListener('pointerup', finishConnectionEndpointDrag, captureOptions);
      window.removeEventListener('pointerup', finishArchitectureGroupInteraction, captureOptions);
      window.removeEventListener('pointerup', finishMarquee, captureOptions);
      window.removeEventListener('pointerup', finishQuadrantDrag, captureOptions);
      window.removeEventListener('pointerup', finishWardleyDrag, captureOptions);
      window.removeEventListener('pointerup', finishBlockDrag, captureOptions);
      window.removeEventListener('pointerup', finishStructuralDrag, captureOptions);
      window.removeEventListener('pointercancel', cancelStructuralDrag, captureOptions);
      window.removeEventListener('pointercancel', cancelConnectionEndpointDrag, captureOptions);
      window.removeEventListener(
        'pointercancel',
        cancelArchitectureGroupInteraction,
        captureOptions
      );
      window.removeEventListener('pointercancel', cancelMarquee, captureOptions);
      window.removeEventListener('pointercancel', cancelBlockDrag, captureOptions);
      window.removeEventListener('pointercancel', cancelPointDrag, captureOptions);
      window.removeEventListener('blur', cancelStructuralDrag);
      window.removeEventListener('blur', cancelConnectionOnBlur);
      window.removeEventListener('blur', cancelArchitectureGroupOnBlur);
      window.removeEventListener('blur', cancelMarquee);
      window.removeEventListener('blur', cancelBlockDrag);
      window.removeEventListener('blur', cancelPointDrag);
      cancelPointDrag();
      cancelBlockDrag();
      cancelStructuralDrag();
      cancelConnectionEndpointDrag();
      cancelMarquee();
      flushPanZoom();
      if (connectionRenderFrame) cancelAnimationFrame(connectionRenderFrame);
      if (linkedConnectionRenderFrame) cancelAnimationFrame(linkedConnectionRenderFrame);
      if (viewportFitFrame) cancelAnimationFrame(viewportFitFrame);
      if (branchFocusFrame) cancelAnimationFrame(branchFocusFrame);
      containerElement?.removeEventListener('click', handleVisualTextFocus, captureOptions);
      containerElement?.removeEventListener(
        'dblclick',
        handleVisualTextDoubleClick,
        captureOptions
      );
      panZoomState.destroy();
      clearVisualDocument();
    };
  });

  $effect(() => {
    const revision = connectionEditor.revision;
    if (revision === connectionEditorRevision) return;
    connectionEditorRevision = revision;
    if (connectionEditor.isCreating) return;
    connectionDraftSource = undefined;
    connectionPreview = undefined;
    connectionCreationGeometry = undefined;
    const graph = container?.querySelector<SVGSVGElement>('svg');
    if (graph) renderConnectionPreview(graph);
  });

  $effect(() => {
    const ids = visualSelection.ids;
    const primaryId = visualSelection.current?.id ?? '';
    const graph = container?.querySelector<SVGSVGElement>('svg');
    if (graph && currentDiagramKeyword() === 'architecture-beta') {
      updateArchitectureGroupSelection(graph, validatedState.current.code, new Set(ids));
    }
    applyVisualSelectionState(visualDocument.current, new Set(ids), primaryId);
  });

  $effect(() => {
    const request = visualDocument.focusRequest;
    if (!request || request.id === handledFocusRequestId || !container) return;
    handledFocusRequestId = request.id;
    container
      .querySelectorAll('.visual-search-current')
      .forEach((element) => element.classList.remove('visual-search-current'));
    let target = request.visualId
      ? visualDocument.current.find(({ id }) => id === request.visualId)?.element
      : undefined;
    if (!target && request.text) {
      const matches = getCanonicalTextLeaves(container).filter(
        (element) =>
          normalizeVisibleText(element.textContent ?? '').toLocaleLowerCase() ===
          normalizeVisibleText(request.text).toLocaleLowerCase()
      );
      target = matches[request.occurrence ?? 0] ?? matches[0];
    }
    if (!target) return;
    const highlight = target.closest('[data-visual-id]') ?? target;
    highlight.classList.add('visual-search-current');
    requestAnimationFrame(() => panZoomState.focusElement(highlight));
  });

  $effect(() => {
    const request = visualDocument.editRequest;
    if (!request || request.id === handledEditRequestId) return;
    handledEditRequestId = request.id;
    const item = visualDocument.current.find(({ id }) => id === request.visualId);
    if (!item || validatedState.current.visualLayers?.[item.id]?.locked) return;
    startInlineTextEditForTarget(item.element);
  });

  // Queue state changes to avoid race condition
  let pendingStateChange = Promise.resolve();
  $effect(() => {
    const state = validatedState.current;
    pendingStateChange = pendingStateChange.then(() =>
      handleStateChange(state).catch((renderError: unknown) => {
        console.error('Queued diagram render failed', renderError);
      })
    );
  });
</script>

<FontAwesome bind:waitForFontAwesomeToLoad />

<div
  id="view"
  bind:this={view}
  class={[
    'relative h-full w-full overflow-hidden',
    shouldShowGrid && `grid-bg-${mode.current}`,
    error && 'opacity-50'
  ]}>
  <div id="container" bind:this={container} class="box-border h-full w-full overflow-auto py-14">
  </div>
  <ConnectionToolbar />
  {#if connectionEditor.isCreating}
    <div
      class="pointer-events-none absolute top-14 left-1/2 z-30 -translate-x-1/2 rounded-md border border-accent bg-background px-3 py-2 text-sm text-foreground shadow-lg"
      data-testid="connection-creation-hint">
      {connectionEditor.phase === 'source'
        ? '请点击箭头起点；点击空白处可创建自由端点'
        : '请点击箭头终点；靠近连接点会自动吸附，Esc 取消'}
    </div>
  {/if}
  {#if marquee}
    <div
      class="pointer-events-none absolute z-30 border border-accent bg-accent/10"
      data-testid="selection-marquee"
      style={`left: ${Math.min(marquee.startX, marquee.currentX)}px; top: ${Math.min(
        marquee.startY,
        marquee.currentY
      )}px; width: ${Math.abs(marquee.currentX - marquee.startX)}px; height: ${Math.abs(
        marquee.currentY - marquee.startY
      )}px;`}>
    </div>
  {/if}
  {#each snapGuides as guide (`${guide.axis}-${guide.value}`)}
    <div
      class={[
        'pointer-events-none absolute z-20 bg-accent/80',
        guide.axis === 'x' ? 'top-0 h-full w-px' : 'left-0 h-px w-full'
      ]}
      data-testid="snap-guide"
      style={guide.axis === 'x'
        ? `left: ${guide.value - (view?.getBoundingClientRect().left ?? 0)}px;`
        : `top: ${guide.value - (view?.getBoundingClientRect().top ?? 0)}px;`}>
    </div>
  {/each}
  {#if branchTarget}
    <Button
      class="branch-button absolute z-20 shadow-lg"
      data-source-id={branchTarget.sourceId}
      style={`left: ${branchTarget.x}px; top: ${branchTarget.y}px;`}
      title={`给“${branchTarget.label}”添加分支`}
      onclick={addBranch}>
      分支
    </Button>
    {#if isTimelinePeriod(branchTarget.label)}
      <Button
        class="timeline-order-button absolute z-20 shadow-lg"
        style={`left: ${branchTarget.x + 68}px; top: ${branchTarget.y}px;`}
        title={`将“${branchTarget.label}”向前移动`}
        onclick={(event) => moveTimelinePeriod(event, -1)}>
        上移
      </Button>
      <Button
        class="timeline-order-button absolute z-20 shadow-lg"
        style={`left: ${branchTarget.x + 132}px; top: ${branchTarget.y}px;`}
        title={`将“${branchTarget.label}”向后移动`}
        onclick={(event) => moveTimelinePeriod(event, 1)}>
        下移
      </Button>
    {/if}
    {#if currentDiagramKeyword() === 'packet'}
      <div
        class="diagram-special-button absolute z-20 flex max-w-[420px] flex-wrap gap-1 rounded-md border border-border bg-background p-1 shadow-lg"
        style={`left: ${specialToolbarX(branchTarget.x)}px; top: ${specialToolbarY(branchTarget.y)}px;`}>
        <Button
          class="h-8 px-2"
          title="在当前字段前插入"
          onclick={(event) => addSpecialBranch(event, 'before')}>前插</Button>
        <Button
          class="h-8 px-2"
          title="在当前字段后插入"
          onclick={(event) => addSpecialBranch(event, 'after')}>后插</Button>
        <Button
          class="h-8 px-2"
          title="拆分当前字段"
          onclick={(event) => addSpecialBranch(event, 'split')}>拆分</Button>
        <span class="mx-1 h-8 w-px bg-border"></span>
        <Button
          class="h-8 px-2"
          title="设为小模块（8 位）"
          onclick={(event) => resizePacket(event, 'small')}>小</Button>
        <Button
          class="h-8 px-2"
          title="设为中模块（16 位）"
          onclick={(event) => resizePacket(event, 'medium')}>中</Button>
        <Button
          class="h-8 px-2"
          title="设为大模块（32 位）"
          onclick={(event) => resizePacket(event, 'large')}>大</Button>
      </div>
    {/if}
    {#if currentDiagramKeyword() === 'gitgraph'}
      <Button
        class="diagram-special-button absolute z-20 shadow-lg"
        style={`left: ${specialActionX(branchTarget.x, 152)}px; top: ${specialToolbarY(branchTarget.y)}px;`}
        title={`在“${branchTarget.label}”所在分支添加提交`}
        onclick={(event) => addSpecialBranch(event, 'commit')}>
        提交
      </Button>
      <Button
        class="diagram-special-button absolute z-20 shadow-lg"
        style={`left: ${specialActionX(branchTarget.x, 152) + 80}px; top: ${specialToolbarY(branchTarget.y)}px;`}
        title={`修改“${branchTarget.label}”名称`}
        onclick={editSelectedLabel}>
        改名
      </Button>
    {/if}
    {#if currentDiagramKeyword() === 'gantt'}
      <Button
        class="diagram-special-button absolute z-20 shadow-lg"
        style={`left: ${specialActionX(branchTarget.x)}px; top: ${specialToolbarY(branchTarget.y)}px;`}
        title="添加新的 section 分组"
        onclick={(event) => addSpecialBranch(event, 'section')}>
        分组
      </Button>
    {/if}
    {#if currentDiagramKeyword() === 'kanban'}
      <div
        class="absolute z-20 flex gap-1 rounded-sm border border-border-dark bg-background p-1 shadow-lg"
        style={`left: ${specialActionX(branchTarget.x, 224)}px; top: ${specialToolbarY(branchTarget.y)}px;`}>
        <Button
          class="h-8 px-2"
          title="新增看板列"
          onclick={(event) => addSpecialBranch(event, 'column')}>新列</Button>
        <Button
          class="h-8 px-2"
          title="在当前列新增卡片"
          onclick={(event) => addSpecialBranch(event, 'card')}>卡片</Button>
        <Button
          class="h-8 px-2"
          title="新增卡片检查项"
          onclick={(event) => addSpecialBranch(event, 'checklist')}>检查项</Button>
      </div>
    {/if}
    {#if currentDiagramKeyword() === 'block-beta'}
      <Button
        class="diagram-special-button absolute z-20 shadow-lg"
        style={`left: ${specialActionX(branchTarget.x)}px; top: ${specialToolbarY(branchTarget.y)}px;`}
        title={`以“${branchTarget.label}”作为箭头起点`}
        onclick={selectBlockArrowSource}>
        箭头
      </Button>
    {/if}
  {/if}
  {#if blockArrowSourceLabel}
    <div
      class="pointer-events-none absolute left-3 top-3 z-20 rounded-md border border-accent bg-background px-3 py-2 text-sm text-foreground shadow-lg">
      已选择“{blockArrowSourceLabel}”，请点击箭头目标
    </div>
  {/if}
  {#if colorTarget}
    <Button
      class="color-button absolute z-20 shadow-lg"
      style={`left: ${colorTarget.x}px; top: ${colorTarget.y}px;`}
      title={`给“${colorTarget.label}”调色`}
      onclick={openColorPicker}>
      调色
    </Button>
  {/if}
  {#if deleteTarget}
    <Button
      class="delete-button absolute z-20 shadow-lg"
      variant="destructive"
      style={`left: ${deleteTarget.x}px; top: ${deleteTarget.y}px;`}
      title={`删除“${deleteTarget.label}”`}
      onclick={deleteSelection}>
      删除
    </Button>
  {/if}
  {#if activeTextEdit && activeTextEditReady}
    <input
      bind:this={textEditInput}
      use:focusInlineTextInput
      aria-label="图中文字编辑"
      class="absolute z-30 rounded-md border border-accent bg-background px-3 py-1 text-sm text-foreground shadow-lg outline-none ring-2 ring-accent/30"
      style={`left: ${activeTextEdit.x}px; top: ${activeTextEdit.y}px; width: ${activeTextEdit.width}px; height: ${activeTextEdit.height}px;`}
      value={activeTextEdit.currentText}
      onblur={finishInlineTextEdit}
      oninput={(event) => applyInlineTextEdit(event.currentTarget.value)}
      onkeydown={handleInlineTextKeydown} />
  {/if}
</div>

<style>
  .grid-bg-light {
    background-size: 30px 30px;
    background-image: radial-gradient(circle, #e4e4e48c 2px, #0000 2px);
  }

  .grid-bg-dark {
    background-size: 30px 30px;
    background-image: radial-gradient(circle, #46464646 2px, #0000 2px);
  }

  :global(.visual-text-editing .node),
  :global(.visual-text-editing .actor),
  :global(.visual-text-editing .edgeLabel),
  :global(.visual-text-editing .messageText),
  :global(.visual-text-editing .noteText),
  :global(.visual-text-editing .loopText),
  :global(.visual-text-editing text),
  :global(.visual-text-editing tspan),
  :global(.visual-text-editing foreignObject) {
    cursor: text;
  }

  :global(.visual-text-editing .face) {
    cursor: ns-resize;
  }

  :global(.visual-text-editing [data-style-id]:hover) {
    outline: 2px solid color-mix(in srgb, var(--color-accent) 70%, transparent);
    outline-offset: 2px;
  }

  :global(.visual-element-selected) {
    outline: 3px solid color-mix(in srgb, var(--color-accent) 88%, white);
    outline-offset: 3px;
  }

  :global(.visual-element-primary) {
    filter: drop-shadow(0 0 5px color-mix(in srgb, var(--color-accent) 65%, transparent));
  }

  :global(.visual-element-locked) {
    cursor: not-allowed !important;
    opacity: 0.82;
  }

  :global(.visual-search-current) {
    outline: 4px solid #facc15;
    outline-offset: 5px;
  }

  :global(
    .visual-connection [data-connection-endpoint],
    .visual-connection [data-connection-endpoint-hit]
  ) {
    display: none;
    cursor: crosshair;
    fill: #fff7ed;
    stroke: #ea580c;
    stroke-width: 2;
    pointer-events: all;
  }

  :global(
    .visual-connection.visual-element-selected [data-connection-endpoint],
    .visual-connection.visual-element-selected [data-connection-endpoint-hit]
  ) {
    display: block;
  }

  :global([data-visual-connection-anchors] circle) {
    pointer-events: none;
    fill: #fff7ed;
    stroke: #f97316;
    stroke-width: 2;
  }

  :global([data-visual-connection-anchors] .visual-connection-anchor-active) {
    fill: #f97316;
    stroke: #fff7ed;
    stroke-width: 3;
  }
</style>
