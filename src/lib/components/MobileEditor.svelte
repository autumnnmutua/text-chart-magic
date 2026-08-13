<script lang="ts">
  import type { EditorProps } from '$/types';
  import { editorFocus } from '$/util/editorFocus.svelte';
  import { inputState, updateCodeStore } from '$/util/state.svelte';
  import { findVisualTextRange } from '$/util/visualTextEdit';
  import { json, jsonLanguage } from '@codemirror/lang-json';
  import { markdown } from '@codemirror/lang-markdown';
  import { yamlFrontmatter } from '@codemirror/lang-yaml';
  import { language } from '@codemirror/language';
  import { Compartment, EditorState } from '@codemirror/state';
  import { EditorView } from '@codemirror/view';
  import { vsCodeDark } from '@fsegurai/codemirror-theme-vscode-dark';
  import { vsCodeLight } from '@fsegurai/codemirror-theme-vscode-light';
  import { basicSetup } from 'codemirror';
  import { mode } from 'mode-watcher';
  import { onMount } from 'svelte';

  let editorView: EditorView | undefined;
  let editorContainer: HTMLDivElement;
  // Deliberately not $state: it is an editor synchronization guard, not UI
  // state. Making it reactive would add an unnecessary effect cycle per key.
  let currentText = '';
  let handledFocusRequestID = 0;
  let pendingFocus: (typeof editorFocus)['current'];
  let measureFrame = 0;
  const themeCompartment = new Compartment();
  const languageCompartment = new Compartment();

  const { onUpdate }: EditorProps = $props();

  const scheduleEditorMeasure = (): void => {
    if (!editorView) return;
    if (measureFrame) cancelAnimationFrame(measureFrame);
    measureFrame = requestAnimationFrame(() => {
      measureFrame = 0;
      editorView?.requestMeasure();
    });
  };

  const applyPendingFocus = () => {
    if (!editorView || !pendingFocus || inputState.editorMode !== 'code') return;
    const range = findVisualTextRange(editorView.state.doc.toString(), {
      occurrence: pendingFocus.occurrence,
      sourceId: pendingFocus.sourceId,
      text: pendingFocus.text
    });
    if (range) {
      editorView.dispatch({
        effects: EditorView.scrollIntoView(range.start, { y: 'center' }),
        selection: { anchor: range.start, head: range.end }
      });
    }
    editorView.focus();
    pendingFocus = undefined;
  };

  $effect(() => {
    editorView?.dispatch({
      effects: themeCompartment.reconfigure(mode.current === 'dark' ? vsCodeDark : vsCodeLight)
    });
  });

  $effect(() => {
    const request = editorFocus.current;
    if (!request || request.id === handledFocusRequestID) return;
    handledFocusRequestID = request.id;
    pendingFocus = request;
    updateCodeStore({ editorMode: 'code' });
    requestAnimationFrame(applyPendingFocus);
  });

  onMount(() => {
    const initial = inputState;
    const initialIsJson = initial.editorMode === 'config';
    currentText = initialIsJson ? initial.mermaid : initial.code;
    editorView = new EditorView({
      state: EditorState.create({
        doc: currentText,
        extensions: [
          basicSetup,
          languageCompartment.of(initialIsJson ? json() : yamlFrontmatter({ content: markdown() })),
          themeCompartment.of(mode.current === 'dark' ? vsCodeDark : vsCodeLight),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              const newText = update.state.doc.toString();
              if (currentText === newText) {
                return;
              }
              currentText = newText;
              onUpdate(newText);
            }
          }),
          EditorView.theme({
            '&.cm-focused': {
              outline: 'none'
            },
            '&.cm-editor': {
              height: '100%'
            },
            '&.cm-scroller': {
              overscrollBehavior: 'contain',
              overflow: 'auto',
              touchAction: 'pan-x pan-y'
            }
          })
        ]
      }),
      parent: editorContainer
    });

    const resizeObserver = new ResizeObserver(scheduleEditorMeasure);
    const visualViewport = window.visualViewport;
    resizeObserver.observe(editorContainer);
    window.addEventListener('resize', scheduleEditorMeasure);
    window.addEventListener('orientationchange', scheduleEditorMeasure);
    visualViewport?.addEventListener('resize', scheduleEditorMeasure);
    scheduleEditorMeasure();

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', scheduleEditorMeasure);
      window.removeEventListener('orientationchange', scheduleEditorMeasure);
      visualViewport?.removeEventListener('resize', scheduleEditorMeasure);
      if (measureFrame) cancelAnimationFrame(measureFrame);
      editorView?.destroy();
      editorView = undefined;
    };
  });

  $effect(() => {
    const { editorMode, code, mermaid } = inputState;
    const text = editorMode === 'code' ? code : mermaid;
    if (!editorView) {
      return;
    }
    if (currentText !== text) {
      currentText = text;
      editorView.dispatch({
        changes: {
          from: 0,
          to: editorView.state.doc.length,
          insert: text
        }
      });
    }
    const stateLanguage = editorView.state.facet(language);
    const isStateJson = stateLanguage === jsonLanguage;
    const isCodeJson = editorMode === 'config';
    if (stateLanguage && isStateJson === isCodeJson) {
      applyPendingFocus();
      return;
    }
    editorView.dispatch({
      effects: languageCompartment.reconfigure(
        isCodeJson ? json() : yamlFrontmatter({ content: markdown() })
      )
    });
    applyPendingFocus();
  });
</script>

<div
  bind:this={editorContainer}
  class="h-full min-h-0 w-full overflow-hidden"
  data-testid="mobile-code-editor">
</div>
