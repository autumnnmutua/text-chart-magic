<script>
  import { goto } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { onMount } from 'svelte';

  onMount(() => {
    if (page.status === 404) {
      void goto(resolve('/'));
    }
  });
</script>

{#if page.status !== 404}
  <div class="container mx-auto p-8">
    <h1 class="mb-4 text-2xl font-bold">页面出错了：{page.status}</h1>
    <p class="mb-4">刚才的页面没有正常打开，请回到编辑器继续。</p>
    <a href={resolve('/')} class="text-accent hover:underline">返回编辑器</a>
  </div>
{/if}
