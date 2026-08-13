<script lang="ts">
  import type { Tab } from '$/types';
  import type { Component, Snippet } from 'svelte';
  import { quintOut } from 'svelte/easing';
  import { slide } from 'svelte/transition';
  import CollapseAllIcon from '~icons/material-symbols/collapse-all-rounded';
  import Tabs from './Tabs.svelte';

  interface Props {
    fillHeight?: boolean;
    isClosable?: boolean;
    isOpen?: boolean;
    isStackable?: boolean;
    tabs?: Tab[];
    activeTabID?: string;
    title?: string;
    icon?: {
      component: Component;
      class?: string;
    };
    onselect?: (tab: Tab) => void;
    actions?: Snippet;
    children: Snippet;
  }

  let {
    fillHeight = false,
    isClosable = true,
    isOpen = false,
    isStackable = false,
    tabs = [],
    activeTabID = '',
    title,
    icon,
    onselect,
    actions,
    children
  }: Props = $props();

  const toggleCardOpen = () => {
    if (isClosable) {
      isOpen = !isOpen;
    }
  };

  const handleHeaderClick = (event: MouseEvent) => {
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest('button, a, input, select, textarea, [role="tab"], [contenteditable="true"]')
    ) {
      return;
    }
    toggleCardOpen();
  };

  const handleHeaderKeydown = (event: KeyboardEvent) => {
    if (event.currentTarget !== event.target || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    toggleCardOpen();
  };

  let isTabsShown = $derived(isOpen && tabs.length > 0);
</script>

<div
  class={[
    'card flex flex-col overflow-hidden rounded-lg border-2 border-muted',
    fillHeight ? 'h-full min-h-0' : 'h-fit',
    isOpen && 'isOpen flex-grow',
    isStackable ? 'flex-1 group-has-[.isOpen]:w-full group-has-[.isOpen]:flex-none' : 'w-full'
  ]}>
  <div
    role="toolbar"
    tabindex={isClosable ? 0 : undefined}
    class={[
      'flex h-11 flex-none items-center justify-between bg-muted p-2 whitespace-nowrap',
      isClosable && 'cursor-pointer',
      isTabsShown && 'pb-1'
    ]}
    onclick={handleHeaderClick}
    onkeydown={handleHeaderKeydown}>
    {#if icon || title}
      <span class="flex w-fit items-center gap-3">
        {#if icon}
          <icon.component class={icon.class} />
        {/if}
        {title}
      </span>
    {/if}
    {#if isOpen && tabs && tabs.length > 0}
      <Tabs {onselect} {tabs} {activeTabID} />
    {/if}

    {@render actions?.()}

    {#if isOpen && isClosable}
      <CollapseAllIcon />
    {/if}
  </div>
  {#if isOpen}
    {#if fillHeight}
      <div class="min-h-0 flex-1 overflow-hidden">
        {@render children()}
      </div>
    {:else}
      <div class="flex-grow overflow-x-auto" transition:slide={{ easing: quintOut }}>
        {@render children()}
      </div>
    {/if}
  {/if}
</div>
