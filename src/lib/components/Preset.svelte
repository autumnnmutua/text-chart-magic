<script lang="ts">
  import Card from '$/components/Card/Card.svelte';
  import { Button, buttonVariants } from '$/components/ui/button';
  import * as Popover from '$/components/ui/popover';
  import { localizedDiagramSamples } from '$/util/diagramSamples';
  import { getSampleDiagrams, type SampleExample } from '$/util/mermaid';
  import { loadDiagramCode } from '$lib/util/state.svelte';
  import { clearVisualSelection } from '$lib/util/visualSelection.svelte';
  import { logEvent } from '$lib/util/stats';
  import { cn } from '$lib/utils';
  import ShapesIcon from '~icons/material-symbols/account-tree-outline-rounded';
  import ChevronDownIcon from '~icons/material-symbols/keyboard-arrow-down-rounded';

  const samples = { ...getSampleDiagrams(), ...localizedDiagramSamples };

  const diagramLabels: Record<string, string> = {
    Architecture: '架构图',
    Block: '块图',
    C4: 'C4',
    Class: '类图',
    'Entity Relationship': '实体关系',
    Flowchart: '流程图',
    Gantt: '甘特图',
    Git: 'Git 图',
    Ishikawa: '鱼骨图',
    Kanban: '看板',
    Mindmap: '思维导图',
    Packet: '数据包',
    Pie: '饼图',
    Quadrant: '象限图',
    Radar: '雷达图',
    Requirement: '需求图',
    Sankey: '桑基图',
    Sequence: '时序图',
    State: '状态图',
    Timeline: '时间线',
    TreeView: '树图',
    Treemap: '矩形树图',
    'User Journey': '用户旅程',
    Venn: '维恩图',
    'Wardley Maps': '沃德利地图',
    XY: 'XY 图',
    ZenUML: 'ZenUML'
  };

  const loadSampleDiagram = (diagramType: string, example: SampleExample): void => {
    clearVisualSelection();
    loadDiagramCode(example.code);
    logEvent('loadSampleDiagram', { diagramType, exampleTitle: example.title });
  };

  const mainDiagrams = [
    'Flowchart',
    'Class',
    'Sequence',
    'Entity Relationship',
    'State',
    'Mindmap'
  ];

  const diagramOrder = [
    ...mainDiagrams,
    ...Object.keys(samples)
      .filter((key) => !mainDiagrams.includes(key))
      .sort()
  ];
</script>

<Card title="示例图表" isOpen isStackable icon={{ component: ShapesIcon }}>
  <div class="flex h-fit max-h-52 flex-wrap gap-2 overflow-y-auto p-2">
    {#each diagramOrder as sample (sample)}
      {@const examples = samples[sample]}
      <div class="flex min-w-20 flex-grow">
        <Button
          size="sm"
          class={cn('flex-grow normal-case', examples.length > 1 && 'rounded-r-none')}
          onclick={() => loadSampleDiagram(sample, examples[0])}>
          {diagramLabels[sample] ?? sample}
        </Button>
        {#if examples.length > 1}
          <Popover.Root>
            <Popover.Trigger
              aria-label="选择{diagramLabels[sample] ?? sample}示例"
              class={cn(
                buttonVariants({ size: 'sm' }),
                'rounded-l-none border-l border-primary-foreground/30 px-0.5 [&_svg]:size-5'
              )}>
              <ChevronDownIcon />
            </Popover.Trigger>
            <Popover.Content align="start" class="flex w-fit flex-col gap-1 p-1">
              {#each examples as example (example.title)}
                <Popover.Close
                  class={cn(
                    buttonVariants({ variant: 'ghost', size: 'sm' }),
                    'justify-start normal-case'
                  )}
                  onclick={() => loadSampleDiagram(sample, example)}>
                  {example.title}
                </Popover.Close>
              {/each}
            </Popover.Content>
          </Popover.Root>
        {/if}
      </div>
    {/each}
  </div>
</Card>
