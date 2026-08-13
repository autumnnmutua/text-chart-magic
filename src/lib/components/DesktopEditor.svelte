<script lang="ts">
  import type { EditorProps } from '$/types';
  import { env } from '$/util/env';
  import { inputState, updateCodeStore, validatedState } from '$/util/state.svelte';
  import { editorFocus } from '$lib/util/editorFocus.svelte';
  import { initEditor, installMonacoCancellationGuard } from '$lib/util/monacoExtra';
  import { findVisualTextRange } from '$lib/util/visualTextEdit';
  import { mode } from 'mode-watcher';
  import * as monaco from 'monaco-editor';
  import monacoEditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
  import monacoJsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
  import { onMount } from 'svelte';

  const { onUpdate }: EditorProps = $props();

  let divElement: HTMLDivElement | undefined = $state();
  let editor: monaco.editor.IStandaloneCodeEditor | undefined;
  const editorOptions = {
    glyphMargin: false,
    lineNumbersMinChars: 4,
    minimap: {
      enabled: false
    },
    occurrencesHighlight: 'off',
    overviewRulerLanes: 0,
    selectionHighlight: false
  } satisfies monaco.editor.IStandaloneEditorConstructionOptions;
  let currentText = '';
  let isUpdatingFromState = false;
  let hasHydratedEditor = false;
  let handledFocusRequestID = 0;
  let layoutFrame = 0;

  const applyEditorTheme = (currentMode: typeof mode.current) => {
    if (!editor) return;
    monaco.editor.setTheme(`mermaid${currentMode === 'dark' ? '-dark' : ''}`);
    divElement?.classList.toggle('mermaid-dark', currentMode === 'dark');
  };

  $effect(() => {
    applyEditorTheme(mode.current);
  });

  const jsonModel = monaco.editor.createModel(
    '',
    'json',
    monaco.Uri.parse('internal://config.json')
  );
  const mermaidModel = monaco.editor.createModel(
    '',
    'mermaid',
    monaco.Uri.parse('internal://mermaid.mmd')
  );

  const scheduleEditorLayout = (): void => {
    if (!editor || !divElement) return;
    if (layoutFrame) cancelAnimationFrame(layoutFrame);
    layoutFrame = requestAnimationFrame(() => {
      layoutFrame = 0;
      if (!editor || !divElement) return;
      const { height, width } = divElement.getBoundingClientRect();
      if (height <= 0 || width <= 0) return;
      editor.layout({ height, width });
    });
  };

  const syncEditorFromState = (
    state: typeof inputState,
    errorMarkers: typeof validatedState.current.errorMarkers
  ): void => {
    if (!editor) return;
    const { editorMode, code, mermaid } = state;
    const model = editorMode === 'code' ? mermaidModel : jsonModel;

    if (editor.getModel()?.id !== model.id) {
      editor.setModel(model);
      currentText = model.getValue();
    }

    const newText = editorMode === 'code' ? code : mermaid;
    if (newText !== currentText) {
      isUpdatingFromState = true;
      try {
        editor.setScrollTop(0);
        editor.pushUndoStop();
        editor.executeEdits('updateCode', [
          {
            range: model.getFullModelRange(),
            text: newText
          }
        ]);
        editor.pushUndoStop();
        currentText = newText;
      } finally {
        queueMicrotask(() => {
          isUpdatingFromState = false;
          hasHydratedEditor = true;
        });
      }
    } else {
      hasHydratedEditor = true;
    }

    monaco.editor.setModelMarkers(model, 'mermaid', errorMarkers);
    scheduleEditorLayout();
  };

  const currentErrorMarkers = (): typeof validatedState.current.errorMarkers => {
    const validated = validatedState.current;
    const validationMatchesInput =
      inputState.editorMode === 'code'
        ? validated.code === inputState.code
        : validated.mermaid === inputState.mermaid;
    return validationMatchesInput ? validated.errorMarkers : [];
  };

  const toMonacoRange = ({ end, start }: { end: number; start: number }) => {
    const startPosition = mermaidModel.getPositionAt(start);
    const endPosition = mermaidModel.getPositionAt(end);
    return new monaco.Range(
      startPosition.lineNumber,
      startPosition.column,
      endPosition.lineNumber,
      endPosition.column
    );
  };

  const focusTextInCode = (text: string, sourceId?: string, occurrence = 0) => {
    if (!editor) return;
    updateCodeStore({ editorMode: 'code' });

    requestAnimationFrame(() => {
      if (!editor) return;
      if (editor.getModel()?.id !== mermaidModel.id) {
        editor.setModel(mermaidModel);
      }

      const range = findVisualTextRange(mermaidModel.getValue(), { occurrence, sourceId, text });
      if (range) {
        const monacoRange = toMonacoRange(range);
        editor.setPosition(monacoRange.getStartPosition());
        editor.setSelection(monacoRange);
        editor.revealRangeInCenter(monacoRange);
        editor.focus();
        return;
      }

      const candidates = [text, text.replace(/\s*\/\s*/g, ' / '), text.replace(/\s+/g, '')].filter(
        Boolean
      );
      const match = candidates
        .flatMap((candidate) =>
          mermaidModel.findMatches(candidate, false, false, true, null, false, 1)
        )
        .at(0);
      if (!match) {
        editor.focus();
        return;
      }

      editor.setPosition(match.range.getStartPosition());
      editor.setSelection(match.range);
      editor.revealRangeInCenter(match.range);
      editor.focus();
    });
  };

  onMount(() => {
    installMonacoCancellationGuard();
    self.MonacoEnvironment = {
      getWorker(_, label) {
        if (label === 'json') {
          return new monacoJsonWorker();
        }
        return new monacoEditorWorker();
      }
    };

    if (!divElement) {
      throw new Error('divEl is undefined');
    }

    monaco.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      enableSchemaRequest: true,
      schemas: [
        {
          fileMatch: ['config.json'],
          uri: `${env.docsUrl}/schemas/config.schema.json`
        }
      ]
    });

    initEditor(monaco);
    editor = monaco.editor.create(divElement, editorOptions);
    editor.onDidChangeModelContent(({ isFlush }) => {
      const newText = editor?.getValue();
      if (newText === undefined || currentText === newText || isFlush) {
        return;
      }
      if (!hasHydratedEditor || isUpdatingFromState) {
        currentText = newText;
        return;
      }
      currentText = newText;
      onUpdate(currentText);
    });

    applyEditorTheme(mode.current);
    syncEditorFromState(inputState, currentErrorMarkers());

    const resizeObserver = new ResizeObserver(scheduleEditorLayout);
    const visualViewport = window.visualViewport;

    resizeObserver.observe(divElement);
    if (divElement.parentElement) resizeObserver.observe(divElement.parentElement);
    window.addEventListener('resize', scheduleEditorLayout);
    window.addEventListener('orientationchange', scheduleEditorLayout);
    visualViewport?.addEventListener('resize', scheduleEditorLayout);
    scheduleEditorLayout();

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', scheduleEditorLayout);
      window.removeEventListener('orientationchange', scheduleEditorLayout);
      visualViewport?.removeEventListener('resize', scheduleEditorLayout);
      if (layoutFrame) cancelAnimationFrame(layoutFrame);
      editor?.dispose();
      editor = undefined;
      jsonModel.dispose();
      mermaidModel.dispose();
    };
  });

  $effect(() => {
    const request = editorFocus.current;
    if (!request || request.id === handledFocusRequestID) {
      return;
    }
    handledFocusRequestID = request.id;
    focusTextInCode(request.text, request.sourceId, request.occurrence);
  });

  $effect(() => {
    // The editable text follows the synchronous input state. Validation may finish
    // later, so only markers come from validatedState; this prevents older parse
    // results from overwriting characters typed in the meantime.
    syncEditorFromState(inputState, currentErrorMarkers());
  });
</script>

<div class="relative h-full min-h-0 grow overflow-hidden">
  <div
    bind:this={divElement}
    id="editor"
    class="h-full min-h-0 w-full"
    data-testid="desktop-code-editor">
  </div>
</div>
