<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { notify } from '$lib/util/notify';
  import { inputState, updateCodeInteraction } from '$lib/util/state.svelte';
  import {
    addXYCategory,
    addXYSeries,
    moveXYCategory,
    moveXYSeries,
    parseXYChart,
    removeXYCategory,
    removeXYSeries,
    updateXYAxis,
    updateXYCategory,
    updateXYSeries,
    updateXYValue,
    updateXYXAxis,
    type XYSeriesType
  } from '$lib/util/xyChart';
  import {
    BarChart3,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    LineChart,
    Plus,
    Trash2
  } from 'lucide-svelte';

  const model = $derived(parseXYChart(inputState.code));

  const commit = (nextCode: string | undefined, successMessage: string): void => {
    if (!nextCode) {
      notify('XY 图修改无效，请检查名称、单位、范围或数字。');
      return;
    }
    if (nextCode === inputState.code) return;
    updateCodeInteraction(nextCode, { start: true, updateDiagram: true });
    notify(successMessage);
  };

  const addSeries = (type: XYSeriesType): void =>
    commit(addXYSeries(inputState.code, type), '已添加数据系列，可撤回恢复。');

  const finishOnEnter = (event: KeyboardEvent): void => {
    if (event.isComposing || event.key !== 'Enter') return;
    event.preventDefault();
    if (!(event.currentTarget instanceof HTMLInputElement)) return;
    event.currentTarget.dispatchEvent(new Event('change', { bubbles: true }));
    event.currentTarget.blur();
  };

  const numberFromInput = (input: HTMLInputElement): number | undefined => {
    if (input.value.trim() === '') return undefined;
    const value = input.valueAsNumber;
    return Number.isFinite(value) ? value : undefined;
  };
</script>

{#if model}
  <section
    class="max-h-[min(68dvh,42rem)] overflow-y-auto overscroll-contain border-b p-3"
    data-testid="xy-series-editor">
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div class="min-w-0">
        <h3 class="text-sm font-semibold">坐标轴与数据</h3>
        <p class="text-xs text-muted-foreground">
          {model.xLabels.length} 个横坐标，{model.series.length} 个数据系列
        </p>
      </div>
      <div class="flex shrink-0 gap-1">
        <Button
          size="sm"
          variant="outline"
          class="min-h-10 px-2"
          title="添加柱状数据系列"
          aria-label="添加柱状纵坐标系列"
          onclick={() => addSeries('bar')}>
          <BarChart3 class="size-4" /><Plus class="size-3" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          class="min-h-10 px-2"
          title="添加折线数据系列"
          aria-label="添加折线纵坐标系列"
          onclick={() => addSeries('line')}>
          <LineChart class="size-4" /><Plus class="size-3" />
        </Button>
      </div>
    </div>

    <div class="mb-3 space-y-3 rounded-md border bg-muted/20 p-2">
      <fieldset>
        <legend class="mb-1 text-xs font-semibold">横坐标</legend>
        <div class="grid grid-cols-2 gap-2">
          <label class="min-w-0 text-xs">
            <span class="mb-1 block text-muted-foreground">名称</span>
            <Input
              value={model.xAxis.label}
              aria-label="横坐标轴名称"
              onkeydown={finishOnEnter}
              onchange={(event) =>
                commit(
                  updateXYXAxis(inputState.code, {
                    label: event.currentTarget.value
                  }),
                  '横坐标名称已更新。'
                )} />
          </label>
          <label class="min-w-0 text-xs">
            <span class="mb-1 block text-muted-foreground">单位</span>
            <Input
              value={model.xAxis.unit}
              placeholder="例如：月"
              aria-label="横坐标单位"
              onkeydown={finishOnEnter}
              onchange={(event) =>
                commit(
                  updateXYXAxis(inputState.code, {
                    unit: event.currentTarget.value
                  }),
                  '横坐标单位已更新。'
                )} />
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend class="mb-1 text-xs font-semibold">纵坐标</legend>
        <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <label class="min-w-0 text-xs">
            <span class="mb-1 block text-muted-foreground">名称</span>
            <Input
              value={model.yAxis.label}
              aria-label="纵坐标轴名称"
              onkeydown={finishOnEnter}
              onchange={(event) =>
                commit(
                  updateXYAxis(inputState.code, {
                    label: event.currentTarget.value
                  }),
                  '纵坐标名称已更新。'
                )} />
          </label>
          <label class="min-w-0 text-xs">
            <span class="mb-1 block text-muted-foreground">单位</span>
            <Input
              value={model.yAxis.unit}
              placeholder="例如：单"
              aria-label="纵坐标单位"
              onkeydown={finishOnEnter}
              onchange={(event) =>
                commit(
                  updateXYAxis(inputState.code, {
                    unit: event.currentTarget.value
                  }),
                  '纵坐标单位已更新。'
                )} />
          </label>
          <label class="min-w-0 text-xs">
            <span class="mb-1 block text-muted-foreground">最小值</span>
            <Input
              type="number"
              value={model.yAxis.min}
              aria-label="纵坐标最小值"
              onkeydown={finishOnEnter}
              onchange={(event) => {
                const min = numberFromInput(event.currentTarget);
                if (min === undefined) return notify('请输入有效的纵坐标最小值。');
                commit(updateXYAxis(inputState.code, { min }), '纵坐标范围已更新。');
              }} />
          </label>
          <label class="min-w-0 text-xs">
            <span class="mb-1 block text-muted-foreground">最大值</span>
            <Input
              type="number"
              value={model.yAxis.max}
              aria-label="纵坐标最大值"
              onkeydown={finishOnEnter}
              onchange={(event) => {
                const max = numberFromInput(event.currentTarget);
                if (max === undefined) return notify('请输入有效的纵坐标最大值。');
                commit(updateXYAxis(inputState.code, { max }), '纵坐标范围已更新。');
              }} />
          </label>
        </div>
      </fieldset>
    </div>

    <div class="mb-2 flex items-center justify-between gap-2">
      <h4 class="text-xs font-semibold">数据表</h4>
      <Button
        size="sm"
        variant="outline"
        class="min-h-10"
        aria-label="添加横坐标"
        onclick={() => commit(addXYCategory(inputState.code), '已添加横坐标分类，可撤回恢复。')}>
        <Plus class="size-4" />分类
      </Button>
    </div>

    <div class="overflow-x-auto overscroll-contain rounded-md border" data-testid="xy-data-table">
      <table class="w-max min-w-full border-collapse text-xs">
        <thead class="bg-muted/50">
          <tr>
            <th class="sticky left-0 z-10 min-w-32 border-r bg-muted px-2 py-2 text-left">分类</th>
            {#each model.series as series, seriesIndex (`header-${series.type}-${series.start}`)}
              <th class="min-w-36 border-r px-2 py-2 text-left last:border-r-0">
                <div class="flex items-center gap-1">
                  <Input
                    class="min-w-24"
                    value={series.label}
                    aria-label={`纵坐标系列 ${seriesIndex + 1} 名称`}
                    onkeydown={finishOnEnter}
                    onchange={(event) =>
                      commit(
                        updateXYSeries(inputState.code, seriesIndex, {
                          label: event.currentTarget.value
                        }),
                        '数据系列名称已更新。'
                      )} />
                  <select
                    class="h-10 min-w-16 rounded-sm border border-input bg-background px-1"
                    value={series.type}
                    aria-label={`纵坐标系列 ${seriesIndex + 1} 类型`}
                    onchange={(event) =>
                      commit(
                        updateXYSeries(inputState.code, seriesIndex, {
                          type: event.currentTarget.value as XYSeriesType
                        }),
                        '数据系列类型已更新。'
                      )}>
                    <option value="bar">柱状</option>
                    <option value="line">折线</option>
                  </select>
                </div>
                <div class="mt-1 flex justify-end">
                  <Button
                    size="icon"
                    variant="ghost"
                    class="size-10"
                    title="左移数据系列"
                    aria-label={`上移纵坐标系列 ${seriesIndex + 1}`}
                    disabled={seriesIndex === 0}
                    onclick={() =>
                      commit(
                        moveXYSeries(inputState.code, seriesIndex, -1),
                        '数据系列顺序已更新。'
                      )}>
                    <ChevronLeft class="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    class="size-10"
                    title="右移数据系列"
                    aria-label={`下移纵坐标系列 ${seriesIndex + 1}`}
                    disabled={seriesIndex === model.series.length - 1}
                    onclick={() =>
                      commit(
                        moveXYSeries(inputState.code, seriesIndex, 1),
                        '数据系列顺序已更新。'
                      )}>
                    <ChevronRight class="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    class="size-10 hover:text-destructive"
                    title="删除数据系列"
                    aria-label={`删除纵坐标系列 ${seriesIndex + 1}`}
                    onclick={() =>
                      commit(removeXYSeries(inputState.code, seriesIndex), '数据系列已删除。')}>
                    <Trash2 class="size-4" />
                  </Button>
                </div>
              </th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each model.xLabels as category, categoryIndex (`category-${categoryIndex}-${category}`)}
            <tr class="border-t">
              <th class="sticky left-0 z-10 border-r bg-background p-2 text-left font-normal">
                <Input
                  value={category}
                  aria-label={`横坐标 ${categoryIndex + 1} 名称`}
                  onkeydown={finishOnEnter}
                  onchange={(event) =>
                    commit(
                      updateXYCategory(inputState.code, categoryIndex, event.currentTarget.value),
                      '横坐标分类已更新。'
                    )} />
                <div class="mt-1 flex justify-end">
                  <Button
                    size="icon"
                    variant="ghost"
                    class="size-10"
                    title="上移横坐标"
                    aria-label={`上移横坐标 ${categoryIndex + 1}`}
                    disabled={categoryIndex === 0}
                    onclick={() =>
                      commit(
                        moveXYCategory(inputState.code, categoryIndex, -1),
                        '横坐标顺序已更新。'
                      )}>
                    <ChevronUp class="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    class="size-10"
                    title="下移横坐标"
                    aria-label={`下移横坐标 ${categoryIndex + 1}`}
                    disabled={categoryIndex === model.xLabels.length - 1}
                    onclick={() =>
                      commit(
                        moveXYCategory(inputState.code, categoryIndex, 1),
                        '横坐标顺序已更新。'
                      )}>
                    <ChevronDown class="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    class="size-10 hover:text-destructive"
                    title="删除横坐标"
                    aria-label={`删除横坐标 ${categoryIndex + 1}`}
                    disabled={model.xLabels.length <= 1}
                    onclick={() =>
                      commit(
                        removeXYCategory(inputState.code, categoryIndex),
                        '横坐标及对应数据已删除。'
                      )}>
                    <Trash2 class="size-4" />
                  </Button>
                </div>
              </th>
              {#each model.series as series, seriesIndex (`value-${series.start}-${categoryIndex}`)}
                <td class="border-r p-2 last:border-r-0">
                  <Input
                    type="number"
                    inputmode="decimal"
                    value={series.values[categoryIndex] ?? 0}
                    aria-label={`纵坐标系列 ${seriesIndex + 1} 横坐标 ${categoryIndex + 1} 数值`}
                    title={`${category} / ${series.label}`}
                    onkeydown={finishOnEnter}
                    onchange={(event) => {
                      const value = numberFromInput(event.currentTarget);
                      if (value === undefined) return notify('请输入有效数字。');
                      commit(
                        updateXYValue(inputState.code, seriesIndex, categoryIndex, value),
                        '数据值已更新。'
                      );
                    }} />
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </section>
{/if}
