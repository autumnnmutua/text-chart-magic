interface EditorFocusRequest {
  id: number;
  occurrence?: number;
  sourceId?: string;
  text: string;
}

let currentRequest = $state<EditorFocusRequest | undefined>();
let nextRequestID = 0;

export const editorFocus = {
  get current() {
    return currentRequest;
  }
};

export const requestEditorFocus = (text: string, sourceId?: string, occurrence = 0): void => {
  const cleanText = text.replace(/\s+/g, ' ').trim();
  if (!cleanText) {
    return;
  }
  currentRequest = {
    id: ++nextRequestID,
    occurrence,
    sourceId,
    text: cleanText
  };
};
