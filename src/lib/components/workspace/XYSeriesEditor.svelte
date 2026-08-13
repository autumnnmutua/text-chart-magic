<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { notify } from '$lib/util/notify';
  import { updateCodeInteraction, validatedState } from '$lib/util/state.svelte';
  import {
    addXYSeries,
    moveXYSeries,
    parseXYChart,
    parseXYSeriesValues,
    removeXYSeries,
    updateXYAxis,
    updateXYSeries,
    type XYSeriesType
  } from '$lib/util/xyChart';
  import { BarChart3, ChevronDown, ChevronUp, LineChart, Plus, Trash2 } from 'lucide-svelte';

  const model = $derived(parseXYChart(validatedState.current.code));

  const commit = (nextCode: string | undefined, successMessage: string): void => {
    if (!nextCode || nextCode === validatedState.current.code) {
      notify('纵坐标修改无效，请检查名称、范围或数值数量。');
      return;
    }
    updateCodeInteraction(nextCode, { start: true, updateDiagram: true });
    notify(successMessage);
  };

  const addSeries = (type: XYSeriesType): void =>
    commit(addXYSeries(validatedState.current.code, type), '已添加纵坐标系列，可撤回恢复。');

  const renameSeries = (index: number, value: string): void =>
    commit(
      updateXYSeries(validatedState.current.code, index, { label: value }),
      '纵坐标名称已更新。'
    );

  const changeSeriesType = (index: number, type: XYSeriesType): void =>
    commit(updateXYSeries(validatedState.current.code, index, { type }), '系列类型已更新。');

  const changeSeriesValues = (index: number, value: string): void => {
    const expectedCount = model?.xLabels.length ?? 0;
    const values = parseXYSeriesValues(value, expectedCount);
    if (!values) {
      notify(
        expectedCount > 0
          ? `请输入 ${expectedCount} 个用逗号分隔的数字，与横坐标一一对应。`
          : '请输入用逗号分隔的有效数字。'
      );
      return;
    }
    commit(updateXYSeries(validatedState.current.code, index, { values }), '纵坐标数值已更新。');
  };

  const changeAxis = (update: { label?: string; max?: number; min?: number }): void =>
    commit(updateXYAxis(validatedState.current.code, update), '纵坐标范围已更新。');

  const finishOnEnter = (event: KeyboardEvent): void => {
    if (event.isComposing || event.key !== 'Enter') return;
    event.preventDefault();
    if (event.currentTarget instanceof HTMLElement) event.currentTarget.blur();
  };
</script>

{#if model}
  <section
    class="max-h-[min(56vh,30rem)] overflow-y-auto overscroll-contain border-b p-3"
    data-testid="xy-series-editor">
    <div class="mb-3 flex items-center justify-between gap-2">
      <div class="min-w-0">
        <h3 class="text-sm font-semibold">纵坐标与数据系列</h3>
        <p class="text-xs text-muted-foreground">
          {model.xLabels.length || '未设置'} 个横坐标，{model.series.length} 个纵向系列
        </p>
      </div>
      <div class="flex shrink-0 gap-1">
        <Button
          size="sm"
          variant="outline"
          class="min-h-10 px-2"
          title="添加柱状纵坐标系列"
          aria-label="添加柱状纵坐标系列"
          onclick={() => addSeries('bar')}
          ><BarChart3 class="size-4" /><Plus class="size-3" /></Button>
        <Button
          size="sm"
          variant="outline"
          class="min-h-10 px-2"
          title="添加折线纵坐标系列"
          aria-label="添加折线纵坐标系列"
          onclick={() => addSeries('line')}
          ><LineChart class="size-4" /><Plus class="size-3" /></Button>
      </div>
    </div>

    <div class="mb-3 grid grid-cols-[minmax(0,1fr)_5.5rem_5.5rem] gap-2">
      <label class="min-w-0 text-xs">
        <span class="mb-1 block text-muted-foreground">轴名称</span>
        <Input
          value={model.yAxis.label}
          aria-label="纵坐标轴名称"
          onkeydown={finishOnEnter}
          onchange={(event) => changeAxis({ label: event.currentTarget.value })} />
      </label>
      <label class="text-xs">
        <span class="mb-1 block text-muted-foreground">最小值</span>
        <Input
          type="number"
          value={model.yAxis.min}
          aria-label="纵坐标最小值"
          onkeydown={finishOnEnter}
          onchange={(event) => changeAxis({ min: Number(event.currentTarget.value) })} />
      </label>
      <label class="text-xs">
        <span class="mb-1 block text-muted-foreground">最大值</span>
        <Input
          type="number"
          value={model.yAxis.max}
          aria-label="纵坐标最大值"
          onkeydown={finishOnEnter}
          onchange={(event) => changeAxis({ max: Number(event.currentTarget.value) })} />
      </label>
    </div>

    <div class="space-y-2">
      {#each model.series as series, index (`${series.type}-${series.start}`)}
        <div class="rounded-md border bg-background p-2">
          <div class="grid grid-cols-[minmax(0,1fr)_5rem] gap-2">
            <Input
              class="min-w-0"
              value={series.label}
              aria-label={`纵坐标系列 ${index + 1} 名称`}
              onkeydown={finishOnEnter}
              onchange={(event) => renameSeries(index, event.currentTarget.value)} />
            <select
              class="h-10 rounded-sm border border-input bg-background px-2 text-sm"
              value={series.type}
              aria-label={`纵坐标系列 ${index + 1} 类型`}
              onchange={(event) =>
                changeSeriesType(index, event.currentTarget.value as XYSeriesType)}>
              <option value="bar">柱状</option>
              <option value="line">折线</option>
            </select>
          </div>
          <div class="mt-2 grid grid-cols-[minmax(0,1fr)_7.5rem] items-end gap-2">
            <label class="min-w-0 text-xs">
              <span class="mb-1 block text-muted-foreground">
                数值（{model.xLabels.length || series.values.length} 项，以逗号分隔）
              </span>
              <Input
                value={series.values.join(', ')}
                aria-label={`纵坐标系列 ${index + 1} 数值`}
                inputmode="decimal"
                onkeydown={finishOnEnter}
                onchange={(event) => changeSeriesValues(index, event.currentTarget.value)} />
            </label>
            <div class="grid grid-cols-3">
              <Button
                size="icon"
                variant="ghost"
                class="size-10"
                title="上移纵坐标系列"
                aria-label={`上移纵坐标系列 ${index + 1}`}
                disabled={index === 0}
                onclick={() =>
                  commit(moveXYSeries(validatedState.current.code, index, -1), '系列顺序已更新。')}>
                <ChevronUp class="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                class="size-10"
                title="下移纵坐标系列"
                aria-label={`下移纵坐标系列 ${index + 1}`}
                disabled={index === model.series.length - 1}
                onclick={() =>
                  commit(moveXYSeries(validatedState.current.code, index, 1), '系列顺序已更新。')}>
                <ChevronDown class="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                class="size-10 hover:text-destructive"
                title="删除纵坐标系列"
                aria-label={`删除纵坐标系列 ${index + 1}`}
                disabled={model.series.length <= 1}
                onclick={() =>
                  commit(removeXYSeries(validatedState.current.code, index), '纵坐标系列已删除。')}>
                <Trash2 class="size-4" />
              </Button>
            </div>
          </div>
        </div>
      {/each}
    </div>
  </section>
{/if}
