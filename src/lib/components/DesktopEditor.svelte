<script lang="ts">
  import type { EditorProps } from '$/types';
  import { env } from '$/util/env';
  import { updateCodeStore, validatedState } from '$/util/state.svelte';
  import { editorFocus } from '$lib/util/editorFocus.svelte';
  import { initEditor } from '$lib/util/monacoExtra';
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
    minimap: {
      enabled: false
    },
    overviewRulerLanes: 0,
    glyphMargin: false,
    lineNumbersMinChars: 4
  } satisfies monaco.editor.IStandaloneEditorConstructionOptions;
  let currentText = '';
  let isUpdatingFromState = false;
  let hasHydratedEditor = false;
  let handledFocusRequestID = 0;

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

    const resizeObserver = new ResizeObserver((entries) => {
      editor?.layout({
        height: entries[0].contentRect.height,
        width: entries[0].contentRect.width
      });
    });

    if (divElement.parentElement) {
      resizeObserver.observe(divElement);
    }

    return () => {
      resizeObserver.disconnect();
      jsonModel.dispose();
      mermaidModel.dispose();
      editor?.dispose();
      editor = undefined;
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
    const { errorMarkers, editorMode, code, mermaid } = validatedState.current;
    if (!editor) {
      return;
    }

    const model = editorMode === 'code' ? mermaidModel : jsonModel;

    if (editor.getModel()?.id !== model.id) {
      editor.setModel(model);
      currentText = model.getValue();
    }

    // Update editor text if it's different
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

    // Display/clear errors
    monaco.editor.setModelMarkers(model, 'mermaid', errorMarkers);
  });
</script>

<div class="relative h-full grow overflow-hidden">
  <div bind:this={divElement} id="editor" class="h-full w-full"></div>
</div>
