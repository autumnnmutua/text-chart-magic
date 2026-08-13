let open = $state(false);

export const visualElementPicker = {
  get isOpen(): boolean {
    return open;
  }
};

export const openVisualElementPicker = (): void => {
  open = true;
};

export const closeVisualElementPicker = (): void => {
  open = false;
};
