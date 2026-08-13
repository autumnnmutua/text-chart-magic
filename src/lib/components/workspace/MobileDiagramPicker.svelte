<script lang="ts">
  import { Button } from '$lib/components/ui/button';
  import { filterDiagramCatalog, investorSamples } from '$lib/util/diagramCatalog';
  import { loadCatalogDiagram, loadCatalogShowcase } from '$lib/util/diagramCatalogActions';
  import { ChevronDown, Search, Sparkles } from 'lucide-svelte';

  let { onSelect }: { onSelect: () => void } = $props();

  let query = $state('');
  let expanded = $state<string[]>([]);
  const normalizedQuery = $derived(query.trim().toLocaleLowerCase());
  const visibleShowcases = $derived(
    investorSamples.filter(({ title }) => title.toLocaleLowerCase().includes(normalizedQuery))
  );
  const visibleGroups = $derived(filterDiagramCatalog(query));

  const toggleExpanded = (diagramType: string): void => {
    expanded = expanded.includes(diagramType)
      ? expanded.filter((item) => item !== diagramType)
      : [...expanded, diagramType];
  };

  const loadDiagram = (
    diagramType: string,
    example: Parameters<typeof loadCatalogDiagram>[1]
  ): void => {
    loadCatalogDiagram(diagramType, example);
    onSelect();
  };
</script>

<div class="flex h-full min-h-0 flex-col" data-testid="mobile-diagram-picker">
  <div class="shrink-0 border-b p-3">
    <label class="relative block">
      <Search
        class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        bind:value={query}
        class="h-11 w-full rounded-md border border-input bg-background pr-3 pl-9 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
        type="search"
        placeholder="搜索图表或示例"
        aria-label="搜索其他图表" />
    </label>
  </div>

  <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
    {#if visibleShowcases.length > 0}
      <section class="mb-4" aria-labelledby="mobile-showcase-title">
        <h3
          id="mobile-showcase-title"
          class="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Sparkles class="size-4" />精选示例
        </h3>
        <div class="grid grid-cols-2 gap-2">
          {#each visibleShowcases as example (example.title)}
            <Button
              class="h-auto min-h-12 justify-start whitespace-normal px-3 text-left"
              variant="secondary"
              onclick={() => {
                loadCatalogShowcase(example);
                onSelect();
              }}>
              {example.title}
            </Button>
          {/each}
        </div>
      </section>
    {/if}

    <section class="space-y-4" aria-labelledby="mobile-diagram-title">
      <h3 id="mobile-diagram-title" class="sr-only">全部图表</h3>
      {#each visibleGroups as group (group.id)}
        <section aria-labelledby={`diagram-category-${group.id}`}>
          <h4
            id={`diagram-category-${group.id}`}
            class="mb-2 text-xs font-semibold text-muted-foreground">
            {group.label}
          </h4>
          <div class="grid gap-2 sm:grid-cols-2">
            {#each group.items as item (item.type)}
              {@const examples = item.examples}
              {@const isExpanded = expanded.includes(item.type) || Boolean(normalizedQuery)}
              <div class="min-w-0 rounded-md border border-border bg-background/70">
                <div class="flex min-w-0">
                  <Button
                    class="h-12 min-w-0 flex-1 flex-col items-start gap-0 rounded-r-none px-3"
                    variant="ghost"
                    aria-label={item.label}
                    data-diagram-type={item.type}
                    title={`${item.profile}：${item.capabilities.join('、')}`}
                    onclick={() => loadDiagram(item.type, examples[0])}>
                    <span class="max-w-full truncate">{item.label}</span>
                    <span class="text-[10px] font-normal text-muted-foreground"
                      >{item.profile}</span>
                  </Button>
                  {#if examples.length > 1}
                    <Button
                      size="icon"
                      class="size-12 shrink-0 rounded-l-none border-l"
                      variant="ghost"
                      aria-label={`展开${item.label}示例`}
                      aria-expanded={isExpanded}
                      onclick={() => toggleExpanded(item.type)}>
                      <ChevronDown
                        class={`size-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </Button>
                  {/if}
                </div>
                {#if examples.length > 1 && isExpanded}
                  <div class="grid gap-1 border-t p-1">
                    {#each examples as example (example.title)}
                      <Button
                        class="h-auto min-h-11 justify-start whitespace-normal text-left"
                        variant="ghost"
                        onclick={() => loadDiagram(item.type, example)}>
                        {example.title}
                      </Button>
                    {/each}
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        </section>
      {/each}
    </section>

    {#if visibleShowcases.length === 0 && visibleGroups.length === 0}
      <div class="py-12 text-center text-sm text-muted-foreground">没有匹配的图表</div>
    {/if}
  </div>
</div>
