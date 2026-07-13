<script lang="ts">
  import type { EditorProps } from '$/types';
  import { editorFocus } from '$/util/editorFocus.svelte';
  import { updateCodeStore, validatedState } from '$/util/state.svelte';
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
  // Deliberately not $state: the sync effect below both reads and writes it,
  // so a reactive currentText would make every keystroke re-run the effect
  // against the not-yet-revalidated state and revert the user's input.
  let currentText = '';
  let handledFocusRequestID = 0;
  let pendingFocus: (typeof editorFocus)['current'];
  const themeCompartment = new Compartment();
  const languageCompartment = new Compartment();

  const { onUpdate }: EditorProps = $props();

  const applyPendingFocus = () => {
    if (!editorView || !pendingFocus || validatedState.current.editorMode !== 'code') return;
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
    const initial = validatedState.current;
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
              overflow: 'auto'
            }
          })
        ]
      }),
      parent: editorContainer
    });

    return () => {
      editorView?.destroy();
      editorView = undefined;
    };
  });

  $effect(() => {
    const { editorMode, code, mermaid } = validatedState.current;
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

<div bind:this={editorContainer} class="size-full"></div>
