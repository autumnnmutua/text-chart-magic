<script lang="ts">
  import Card from '$/components/Card/Card.svelte';
  import { Button } from '$/components/ui/button';
  import { Input } from '$/components/ui/input';
  import { validatedState, updateVisualStyles } from '$/util/state.svelte';
  import {
    closeVisualColorPanel,
    defaultVisualStyle,
    visualSelection
  } from '$lib/util/visualSelection.svelte';
  import { visualDocument } from '$lib/util/visualDocument.svelte';
  import { applyVisualStyleToElement } from '$lib/util/visualStyle';
  import { onMount } from 'svelte';
  import PaletteIcon from '~icons/material-symbols/palette-outline';

  interface RGB {
    blue: number;
    green: number;
    red: number;
  }

  interface HSL {
    hue: number;
    lightness: number;
    saturation: number;
  }

  const RECENT_COLORS_KEY = 'recentVisualColors';
  const presets = [
    '#111827',
    '#ffffff',
    '#f97316',
    '#facc15',
    '#22c55e',
    '#06b6d4',
    '#3b82f6',
    '#8b5cf6',
    '#ec4899',
    '#ef4444',
    '#78716c',
    '#fed7aa'
  ];
  const validHexColor = (value: unknown): value is string =>
    typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);

  let hue = $state(24);
  let saturation = $state(86);
  let value = $state(96);
  let alpha = $state(1);
  let hexInput = $state('#f97316');
  let rgbInput = $state('249, 115, 22');
  let hslInput = $state('24, 95%, 53%');
  let recentColors = $state<string[]>([]);
  let panelElement: HTMLButtonElement | undefined = $state();
  let hueElement: HTMLButtonElement | undefined = $state();
  let activeColorPointerId: number | undefined;

  const clamp = (number: number, min: number, max: number): number =>
    Math.min(Math.max(number, min), max);

  const componentToHex = (number: number): string =>
    clamp(Math.round(number), 0, 255).toString(16).padStart(2, '0');

  const rgbToHex = ({ red, green, blue }: RGB): string =>
    `#${componentToHex(red)}${componentToHex(green)}${componentToHex(blue)}`;

  const hexToRgb = (hex: string): RGB => {
    const clean = hex.replace('#', '').trim();
    const value =
      clean.length === 3
        ? clean
            .split('')
            .map((item) => item + item)
            .join('')
        : clean.padEnd(6, '0').slice(0, 6);
    const number = Number.parseInt(value || '000000', 16);
    return {
      blue: number & 255,
      green: (number >> 8) & 255,
      red: (number >> 16) & 255
    };
  };

  const hsvToRgb = (h: number, s: number, v: number): RGB => {
    const chroma = v * s;
    const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
    const match = v - chroma;
    const [red, green, blue] =
      h < 60
        ? [chroma, x, 0]
        : h < 120
          ? [x, chroma, 0]
          : h < 180
            ? [0, chroma, x]
            : h < 240
              ? [0, x, chroma]
              : h < 300
                ? [x, 0, chroma]
                : [chroma, 0, x];
    return {
      blue: (blue + match) * 255,
      green: (green + match) * 255,
      red: (red + match) * 255
    };
  };

  const rgbToHsv = ({ red, green, blue }: RGB) => {
    const r = red / 255;
    const g = green / 255;
    const b = blue / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    const h =
      delta === 0
        ? 0
        : max === r
          ? 60 * (((g - b) / delta) % 6)
          : max === g
            ? 60 * ((b - r) / delta + 2)
            : 60 * ((r - g) / delta + 4);
    return {
      hue: (h + 360) % 360,
      saturation: max === 0 ? 0 : delta / max,
      value: max
    };
  };

  const rgbToHsl = ({ red, green, blue }: RGB): HSL => {
    const r = red / 255;
    const g = green / 255;
    const b = blue / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const lightness = (max + min) / 2;
    const delta = max - min;
    const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
    const h =
      delta === 0
        ? 0
        : max === r
          ? 60 * (((g - b) / delta) % 6)
          : max === g
            ? 60 * ((b - r) / delta + 2)
            : 60 * ((r - g) / delta + 4);
    return {
      hue: (h + 360) % 360,
      lightness: lightness * 100,
      saturation: saturation * 100
    };
  };

  const hslToRgb = ({ hue, saturation, lightness }: HSL): RGB => {
    const s = saturation / 100;
    const l = lightness / 100;
    const chroma = (1 - Math.abs(2 * l - 1)) * s;
    const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1));
    const match = l - chroma / 2;
    const [red, green, blue] =
      hue < 60
        ? [chroma, x, 0]
        : hue < 120
          ? [x, chroma, 0]
          : hue < 180
            ? [0, chroma, x]
            : hue < 240
              ? [0, x, chroma]
              : hue < 300
                ? [x, 0, chroma]
                : [chroma, 0, x];
    return {
      blue: (blue + match) * 255,
      green: (green + match) * 255,
      red: (red + match) * 255
    };
  };

  const currentRgb = $derived(hsvToRgb(hue, saturation / 100, value / 100));
  const currentHex = $derived(rgbToHex(currentRgb));
  const currentHsl = $derived(rgbToHsl(currentRgb));
  const currentColor = $derived(
    `rgba(${Math.round(currentRgb.red)}, ${Math.round(currentRgb.green)}, ${Math.round(
      currentRgb.blue
    )}, ${alpha})`
  );
  const selectedStyle = $derived(
    visualSelection.current
      ? (validatedState.current.visualStyles?.[visualSelection.current.id] ?? defaultVisualStyle)
      : defaultVisualStyle
  );

  const syncInputs = () => {
    hexInput = currentHex;
    rgbInput = `${Math.round(currentRgb.red)}, ${Math.round(currentRgb.green)}, ${Math.round(
      currentRgb.blue
    )}`;
    hslInput = `${Math.round(currentHsl.hue)}, ${Math.round(currentHsl.saturation)}%, ${Math.round(
      currentHsl.lightness
    )}%`;
  };

  const writeStyle = () => {
    const selection = visualSelection.current;
    if (!selection) {
      return;
    }
    const editableIds = visualSelection.ids.filter(
      (id) => !validatedState.current.visualLayers?.[id]?.locked
    );
    if (editableIds.length === 0) return;
    updateVisualStyles(editableIds, {
      alpha,
      fill: currentHex,
      stroke: currentHex,
      text: currentHsl.lightness < 52 ? '#ffffff' : '#111827'
    });
  };

  const previewStyle = () => {
    const style = {
      alpha,
      fill: currentHex,
      stroke: currentHex,
      text: currentHsl.lightness < 52 ? '#ffffff' : '#111827'
    };
    const selectedIds = new Set(visualSelection.ids);
    for (const item of visualDocument.current) {
      if (selectedIds.has(item.id) && !validatedState.current.visualLayers?.[item.id]?.locked) {
        applyVisualStyleToElement(item.element, style);
      }
    }
  };

  const setFromRgb = (rgb: RGB, { save = true }: { save?: boolean } = {}) => {
    const next = rgbToHsv({
      blue: clamp(rgb.blue, 0, 255),
      green: clamp(rgb.green, 0, 255),
      red: clamp(rgb.red, 0, 255)
    });
    hue = next.hue;
    saturation = next.saturation * 100;
    value = next.value * 100;
    syncInputs();
    if (save) {
      writeStyle();
    }
  };

  const setFromHex = (hex: string) => {
    if (!/^#?[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(hex.trim())) {
      return;
    }
    setFromRgb(hexToRgb(hex));
  };

  const setFromRgbInput = () => {
    const [red, green, blue] = rgbInput
      .split(/[,\s]+/)
      .map((item) => Number.parseFloat(item))
      .filter((item) => Number.isFinite(item));
    if ([red, green, blue].some((item) => item === undefined)) {
      return;
    }
    setFromRgb({ blue, green, red });
  };

  const setFromHslInput = () => {
    const [nextHue, nextSaturation, nextLightness] = hslInput
      .replaceAll('%', '')
      .split(/[,\s]+/)
      .map((item) => Number.parseFloat(item))
      .filter((item) => Number.isFinite(item));
    if ([nextHue, nextSaturation, nextLightness].some((item) => item === undefined)) {
      return;
    }
    setFromRgb(
      hslToRgb({
        hue: clamp(nextHue, 0, 359),
        lightness: clamp(nextLightness, 0, 100),
        saturation: clamp(nextSaturation, 0, 100)
      })
    );
  };

  const updateFromPointer = (event: PointerEvent) => {
    if (!panelElement) {
      return;
    }
    const rect = panelElement.getBoundingClientRect();
    saturation = clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100);
    value = clamp(100 - ((event.clientY - rect.top) / rect.height) * 100, 0, 100);
    syncInputs();
    previewStyle();
  };

  const updateHueFromPointer = (event: PointerEvent) => {
    if (!hueElement) {
      return;
    }
    const rect = hueElement.getBoundingClientRect();
    hue = clamp(((event.clientX - rect.left) / rect.width) * 359, 0, 359);
    syncInputs();
    previewStyle();
  };

  const updateAlphaPreview = (event: Event) => {
    alpha = Number((event.currentTarget as HTMLInputElement).value);
    syncInputs();
    previewStyle();
  };

  const finishPointerPick = (event: PointerEvent): void => {
    if (activeColorPointerId === undefined || event.pointerId !== activeColorPointerId) return;
    activeColorPointerId = undefined;
    writeStyle();
  };

  const startPointerPick = (event: PointerEvent) => {
    activeColorPointerId = event.pointerId;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    updateFromPointer(event);
  };

  const startHuePick = (event: PointerEvent) => {
    activeColorPointerId = event.pointerId;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    updateHueFromPointer(event);
  };

  const useColor = (hex: string) => {
    setFromHex(hex);
    rememberRecent(hex);
  };

  const rememberRecent = (hex = currentHex) => {
    recentColors = [hex, ...recentColors.filter((item) => item !== hex)].slice(0, 10);
    try {
      localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify(recentColors));
    } catch {
      // Color selection still works when storage is blocked or full.
    }
  };

  onMount(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(RECENT_COLORS_KEY) ?? '[]') as unknown;
      recentColors = Array.isArray(stored) ? stored.filter(validHexColor).slice(0, 10) : [];
    } catch {
      recentColors = [];
    }
    window.addEventListener('pointerup', finishPointerPick);
    window.addEventListener('pointercancel', finishPointerPick);
    return () => {
      window.removeEventListener('pointerup', finishPointerPick);
      window.removeEventListener('pointercancel', finishPointerPick);
    };
  });

  $effect(() => {
    const style = selectedStyle;
    alpha = style.alpha ?? 1;
    setFromRgb(hexToRgb(style.fill ?? defaultVisualStyle.fill), { save: false });
  });

  $effect(() => {
    syncInputs();
  });
</script>

<Card title="调色" isOpen isClosable={false} icon={{ component: PaletteIcon }}>
  <div class="flex flex-col gap-4 p-3">
    <div class="flex items-center gap-3">
      <div
        class="size-14 rounded-md border border-border shadow-inner"
        style={`background: ${currentColor};`}>
      </div>
      <div class="min-w-0">
        <div class="truncate text-sm font-medium">
          {visualSelection.count > 1
            ? `${visualSelection.count} 个元素`
            : (visualSelection.current?.label ?? '选中元素')}
        </div>
        <div class="text-xs text-muted-foreground">
          {currentHex.toUpperCase()} / {Math.round(alpha * 100)}%
        </div>
      </div>
    </div>

    <button
      type="button"
      bind:this={panelElement}
      aria-label="饱和度和明度"
      class="relative h-56 cursor-crosshair overflow-hidden rounded-md border border-border"
      style={`background:
        linear-gradient(to top, #000, transparent),
        linear-gradient(to right, #fff, hsl(${hue} 100% 50%));`}
      onpointerdown={startPointerPick}
      onpointermove={(event) => {
        if (event.buttons === 1) updateFromPointer(event);
      }}>
      <span
        class="absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
        style={`left: ${saturation}%; top: ${100 - value}%; background: ${currentColor};`}></span>
    </button>

    <label class="grid gap-1 text-xs font-medium">
      色相
      <button
        type="button"
        bind:this={hueElement}
        aria-label="色相"
        class="relative h-5 cursor-ew-resize rounded-full border border-border"
        style="background: linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00);"
        onpointerdown={startHuePick}
        onpointermove={(event) => {
          if (event.buttons === 1) updateHueFromPointer(event);
        }}>
        <span
          class="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
          style={`left: ${(hue / 359) * 100}%; background: hsl(${hue} 100% 50%);`}></span>
      </button>
    </label>

    <label class="grid gap-1 text-xs font-medium">
      透明度 Alpha
      <input
        class="h-3 cursor-pointer appearance-none rounded-full"
        style={`background: linear-gradient(to right, transparent, ${currentHex});`}
        type="range"
        aria-label="透明度 Alpha"
        min="0"
        max="1"
        step="0.01"
        bind:value={alpha}
        oninput={updateAlphaPreview}
        onchange={writeStyle} />
    </label>

    <div class="grid gap-2">
      <label class="grid gap-1 text-xs font-medium">
        HEX
        <Input
          bind:value={hexInput}
          onblur={() => {
            setFromHex(hexInput);
            rememberRecent();
          }} />
      </label>
      <label class="grid gap-1 text-xs font-medium">
        RGB
        <Input
          bind:value={rgbInput}
          placeholder="249, 115, 22"
          onblur={() => {
            setFromRgbInput();
            rememberRecent();
          }} />
      </label>
      <label class="grid gap-1 text-xs font-medium">
        HSL
        <Input
          bind:value={hslInput}
          placeholder="24, 95%, 53%"
          onblur={() => {
            setFromHslInput();
            rememberRecent();
          }} />
      </label>
    </div>

    <div class="grid gap-2">
      <div class="text-xs font-medium">最近使用</div>
      <div class="flex flex-wrap gap-2">
        {#each recentColors as color (color)}
          <button
            class="size-7 rounded border border-border"
            style={`background: ${color};`}
            title={color}
            onclick={() => useColor(color)}></button>
        {/each}
      </div>
    </div>

    <div class="grid gap-2">
      <div class="text-xs font-medium">常用预设</div>
      <div class="flex flex-wrap gap-2">
        {#each presets as color (color)}
          <button
            class="size-7 rounded border border-border"
            style={`background: ${color};`}
            title={color}
            onclick={() => useColor(color)}></button>
        {/each}
      </div>
    </div>

    <div class="flex justify-between gap-2">
      <Button variant="secondary" onclick={() => rememberRecent()}>保存到最近</Button>
      <Button variant="outline" onclick={closeVisualColorPanel}>返回编辑器</Button>
    </div>
  </div>
</Card>
