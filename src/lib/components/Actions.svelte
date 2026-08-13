<script lang="ts">
  import Card from '$/components/Card/Card.svelte';
  import { Button } from '$/components/ui/button';
  import { Input } from '$/components/ui/input';
  import * as ToggleGroup from '$/components/ui/toggle-group';
  import { getRenderedStateKey, waitForRender } from '$lib/util/autoSync';
  import { diagramRenderKey } from '$lib/util/diagramStateKey';
  import { notify } from '$lib/util/notify';
  import { validatedState, waitForStateValidation } from '$lib/util/state.svelte';
  import { logEvent } from '$lib/util/stats';
  import { version as FAVersion } from '@fortawesome/fontawesome-free/package.json';
  import dayjs from 'dayjs';
  import { toBase64 } from 'js-base64';
  import { tick } from 'svelte';
  import DownloadIcon from '~icons/material-symbols/download';
  import WidthIcon from '~icons/material-symbols/width-rounded';

  const FONT_AWESOME_URL = `https://cdnjs.cloudflare.com/ajax/libs/font-awesome/${FAVersion}/css/all.min.css`;

  type Exporter = (context: CanvasRenderingContext2D, image: HTMLImageElement) => () => void;

  const getFileName = (extension: string) =>
    `mermaid-diagram-${dayjs().format('YYYY-MM-DD-HHmmss')}.${extension}`;

  const fixForeignObjectClipping = (svg: SVGSVGElement) => {
    const foreignObjects = svg.querySelectorAll('foreignObject');
    foreignObjects.forEach((foreignObj) => {
      const currentHeight = parseFloat(foreignObj.getAttribute('height') || '0');
      if (currentHeight <= 0) return;

      const currentY = parseFloat(foreignObj.getAttribute('y') || '0');
      const newHeight = currentHeight * 1.5;
      const heightDiff = newHeight - currentHeight;

      foreignObj.setAttribute('height', newHeight.toString());
      foreignObj.setAttribute('y', (currentY - heightDiff / 2).toString());

      const htmlElements = foreignObj.querySelectorAll('div, span, p');
      htmlElements.forEach((htmlEl) => {
        const el = htmlEl as HTMLElement;
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.height = '100%';
      });
    });
  };

  const getSvgElement = () => {
    const source = document.querySelector<SVGSVGElement>('#container svg');
    if (!source) throw new Error('No rendered SVG is available');
    const svgElement = source.cloneNode(true) as SVGSVGElement;
    svgElement.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    // Export diagram coordinates, not the temporary viewport pan/zoom matrix.
    svgElement.querySelector('.svg-pan-zoom_viewport')?.removeAttribute('transform');
    const viewBox = svgElement.viewBox?.baseVal;
    if (viewBox && viewBox.width > 0 && viewBox.height > 0) {
      svgElement.setAttribute('width', `${Math.ceil(viewBox.width)}px`);
      svgElement.setAttribute('height', `${Math.ceil(viewBox.height)}px`);
    }
    svgElement.style.removeProperty('display');
    svgElement.style.removeProperty('width');
    svgElement.style.removeProperty('height');
    svgElement.style.removeProperty('max-width');
    svgElement.style.removeProperty('overflow');
    return svgElement;
  };

  const getBase64SVG = (svg?: SVGSVGElement, width?: number, height?: number): string => {
    if (svg) {
      svg = svg.cloneNode(true) as SVGSVGElement;
      svg.querySelector('.svg-pan-zoom_viewport')?.removeAttribute('transform');
      svg.style.removeProperty('display');
      svg.style.removeProperty('width');
      svg.style.removeProperty('height');
      svg.style.removeProperty('max-width');
      svg.style.removeProperty('overflow');
    }
    if (height) {
      svg?.setAttribute('height', `${height}px`);
    }
    if (width) {
      svg?.setAttribute('width', `${width}px`);
    }
    if (!svg) {
      svg = getSvgElement();
    }

    if (validatedState.current.rough) {
      fixForeignObjectClipping(svg);
    }

    svg.style.backgroundColor = window
      .getComputedStyle(document.body)
      .getPropertyValue('--background');

    const svgString = svg.outerHTML
      .replaceAll('<br>', '<br/>')
      .replaceAll(/<img([^>]*)>/g, (m, g: string) => `<img ${g} />`);

    return toBase64(`<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet href="${FONT_AWESOME_URL}" type="text/css"?>
${svgString}`);
  };

  const simulateDownload = (download: string, href: string): void => {
    const a = document.createElement('a');
    a.download = download;
    a.href = href;
    a.click();
    a.remove();
  };

  const waitForCurrentRender = async (): Promise<void> => {
    // A template change validates asynchronously before entering the serial SVG
    // render queue. Export only when the current SVG matches that validated state.
    await tick();
    await waitForStateValidation();
    const deadline = performance.now() + 30_000;
    while (true) {
      const state = validatedState.current;
      if (state.error) {
        await waitForRender();
        return;
      }
      if (
        getRenderedStateKey() === diagramRenderKey(state) &&
        document.querySelector('#container svg')
      ) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        return;
      }
      if (performance.now() >= deadline) {
        throw new Error('Timed out waiting for the current diagram render');
      }
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      await waitForStateValidation();
    }
  };

  const exportImage = async (event: Event, exporter: Exporter) => {
    event.stopPropagation();
    event.preventDefault();
    await waitForCurrentRender();
    const canvas = document.createElement('canvas');
    const svg = document.querySelector<SVGSVGElement>('#container svg');
    if (!svg) {
      throw new Error('svg not found');
    }

    const box = svg.getBoundingClientRect();
    const viewBox = svg.viewBox?.baseVal;
    const contentWidth = viewBox && viewBox.width > 0 ? viewBox.width : box.width;
    const contentHeight = viewBox && viewBox.height > 0 ? viewBox.height : box.height;
    if (contentWidth <= 0 || contentHeight <= 0) {
      throw new Error('Rendered SVG has invalid dimensions');
    }
    const requestedSize = Number.isFinite(imageSize)
      ? Math.min(Math.max(Math.round(imageSize), 3), 10_000)
      : 1080;

    if (imageSizeMode === 'width') {
      const ratio = contentHeight / contentWidth;
      canvas.width = requestedSize;
      canvas.height = requestedSize * ratio;
    } else if (imageSizeMode === 'height') {
      const ratio = contentWidth / contentHeight;
      canvas.width = requestedSize * ratio;
      canvas.height = requestedSize;
    } else {
      const multiplier = 2;
      canvas.width = contentWidth * multiplier;
      canvas.height = contentHeight * multiplier;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('context not found');
    }

    context.fillStyle = window.getComputedStyle(document.body).getPropertyValue('--background');
    context.fillRect(0, 0, canvas.width, canvas.height);

    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.addEventListener('load', () => {
        try {
          exporter(context, image)();
          resolve();
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      });
      image.addEventListener('error', () => reject(new Error('image export failed')));
      image.src = `data:image/svg+xml;base64,${getBase64SVG(svg, canvas.width, canvas.height)}`;
    });
  };

  const downloadImage: Exporter = (context, image) => {
    return () => {
      const { canvas } = context;
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      simulateDownload(
        getFileName('png'),
        canvas.toDataURL('image/png').replace('image/png', 'image/octet-stream')
      );
    };
  };

  const onDownloadPNG = async (event: Event) => {
    try {
      await exportImage(event, downloadImage);
      logEvent('download', { type: 'png' });
    } catch (error) {
      console.error('PNG export failed', error);
      notify('PNG 导出失败，请确认图表已经正常显示后重试。');
    }
  };

  const onDownloadSVG = async () => {
    try {
      await waitForCurrentRender();
      simulateDownload(getFileName('svg'), `data:image/svg+xml;base64,${getBase64SVG()}`);
      logEvent('download', { type: 'svg' });
    } catch (error) {
      console.error('SVG export failed', error);
      notify('SVG 导出失败，请确认图表已经正常显示后重试。');
    }
  };

  let imageSizeMode: 'auto' | 'width' | 'height' = $state('auto');

  $effect(() => {
    if (!imageSizeMode) {
      imageSizeMode = 'auto';
    }
  });

  let imageSize = $state(1080);
</script>

<Card title="导出" isStackable icon={{ component: DownloadIcon, class: 'rotate-180' }}>
  <div class="flex min-w-fit flex-col gap-3 p-3">
    <div class="flex w-full flex-wrap items-center gap-2 whitespace-nowrap">
      <span class="text-sm font-medium">PNG 尺寸</span>
      <ToggleGroup.Root type="single" variant="outline" bind:value={imageSizeMode}>
        <ToggleGroup.Item value="auto">自动</ToggleGroup.Item>
        <ToggleGroup.Item value="width">宽度</ToggleGroup.Item>
        <ToggleGroup.Item value="height">高度</ToggleGroup.Item>
      </ToggleGroup.Root>
      {#if imageSizeMode !== 'auto'}
        <WidthIcon
          class={['size-6 shrink-0 transition-all', imageSizeMode === 'width' && 'rotate-90']} />
      {/if}
      <Input
        class="max-w-36"
        type="number"
        min="3"
        max="10000"
        disabled={imageSizeMode === 'auto'}
        bind:value={imageSize} />
    </div>
    <div class="grid grid-cols-2 gap-2">
      <Button onclick={onDownloadPNG} data-testid="download-PNG">
        <DownloadIcon />
        PNG
      </Button>
      <Button onclick={onDownloadSVG} data-testid="download-SVG">
        <DownloadIcon />
        SVG
      </Button>
    </div>
  </div>
</Card>
