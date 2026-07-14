let message = $state('');
let dismissTimer: ReturnType<typeof setTimeout> | undefined;

export const diagramNotice = {
  get message(): string {
    return message;
  }
};

export const dismissDiagramNotice = (): void => {
  message = '';
  if (dismissTimer) clearTimeout(dismissTimer);
  dismissTimer = undefined;
};

export const showDiagramNotice = (next: string, duration = 12_000): void => {
  dismissDiagramNotice();
  message = next;
  if (typeof window !== 'undefined') {
    dismissTimer = setTimeout(dismissDiagramNotice, duration);
  }
};
