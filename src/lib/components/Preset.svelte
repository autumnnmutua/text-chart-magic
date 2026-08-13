<script lang="ts">
  import Card from '$/components/Card/Card.svelte';
  import { Button, buttonVariants } from '$/components/ui/button';
  import { Input } from '$/components/ui/input';
  import * as Popover from '$/components/ui/popover';
  import { filterDiagramCatalog, investorSamples } from '$lib/util/diagramCatalog';
  import { loadCatalogDiagram, loadCatalogShowcase } from '$lib/util/diagramCatalogActions';
  import { cn } from '$lib/utils';
  import ShapesIcon from '~icons/material-symbols/account-tree-outline-rounded';
  import ChevronDownIcon from '~icons/material-symbols/keyboard-arrow-down-rounded';
  import ShowcaseIcon from '~icons/material-symbols/auto-awesome-outline-rounded';
  import { Search } from 'lucide-svelte';

  let query = $state('');
  const normalizedQuery = $derived(query.trim().toLocaleLowerCase());
  const visibleShowcases = $derived(
    investorSamples.filter(({ title }) => title.toLocaleLowerCase().includes(normalizedQuery))
  );
  const visibleGroups = $derived(filterDiagramCatalog(query));
</script>

<Card title="精选示例" isOpen isStackable icon={{ component: ShowcaseIcon }}>
  <div class="grid grid-cols-1 gap-2 p-2 sm:grid-cols-2">
    {#each visibleShowcases as example (example.title)}
      <Button
        size="sm"
        variant="secondary"
        class="h-auto min-h-9 justify-start whitespace-normal text-left normal-case"
        onclick={() => loadCatalogShowcase(example)}>
        {example.title}
      </Button>
    {/each}
    {#if visibleShowcases.length === 0}
      <div class="col-span-full py-3 text-center text-xs text-muted-foreground">
        没有匹配的精选示例
      </div>
    {/if}
  </div>
</Card>

<Card title="图表库" isOpen isStackable icon={{ component: ShapesIcon }}>
  <div class="border-b p-2">
    <label class="relative block">
      <Search
        class="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input bind:value={query} class="h-9 pl-8" type="search" placeholder="搜索图表或示例" />
    </label>
  </div>
  <div class="flex h-fit max-h-72 flex-col gap-3 overflow-y-auto p-2">
    {#each visibleGroups as group (group.id)}
      <section>
        <h3 class="mb-1.5 px-1 text-xs font-semibold text-muted-foreground">{group.label}</h3>
        <div class="grid grid-cols-2 gap-1.5">
          {#each group.items as item (item.type)}
            {@const examples = item.examples}
            <div class="flex min-w-0">
              <Button
                size="sm"
                aria-label={item.label}
                title={`${item.profile}：${item.capabilities.join('、')}`}
                class={cn(
                  'h-auto min-h-10 min-w-0 flex-grow flex-col items-start gap-0 px-2 py-1 normal-case',
                  examples.length > 1 && 'rounded-r-none'
                )}
                onclick={() => loadCatalogDiagram(item.type, examples[0])}>
                <span class="max-w-full truncate">{item.label}</span>
                <span class="text-[10px] font-normal text-muted-foreground">{item.profile}</span>
              </Button>
              {#if examples.length > 1}
                <Popover.Root>
                  <Popover.Trigger
                    aria-label={`选择${item.label}示例`}
                    class={cn(
                      buttonVariants({ size: 'sm' }),
                      'h-auto min-h-10 rounded-l-none border-l border-primary-foreground/30 px-0.5 [&_svg]:size-5'
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
                        onclick={() => loadCatalogDiagram(item.type, example)}>
                        {example.title}
                      </Popover.Close>
                    {/each}
                  </Popover.Content>
                </Popover.Root>
              {/if}
            </div>
          {/each}
        </div>
      </section>
    {/each}
    {#if visibleGroups.length === 0}
      <div class="py-6 text-center text-sm text-muted-foreground">没有匹配的图表</div>
    {/if}
  </div>
</Card>
