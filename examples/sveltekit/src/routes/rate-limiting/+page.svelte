<script lang="ts">
  import { enhance } from "$app/forms";
  import WhatNext from "$lib/components/WhatNext.svelte";
  import type { PageProps } from "./$types";

  let { form }: PageProps = $props();
</script>

<main class="page">
  <div class="section">
    <h1 class="heading-primary">Arcjet rate limiting example</h1>
    <p class="typography--description">
      This page is protected by
      <a href="https://docs.arcjet.com/bot-protection/concepts" class="link"
        >Arcjet's rate limiting</a
      >.
    </p>
  </div>

  <hr class="divider" />

  <div class="section">
    <h2 class="heading-secondary">Try it</h2>
    <form class="form" id="form-rate-limit" method="POST" use:enhance>
      <button type="submit" class="button-primary form-button">Push me</button>
      {#if form?.message || form?.error}
        <pre class="code-block"><code>{form?.message ?? form?.error}</code
          ></pre>
      {/if}
    </form>

    <p>The limit is set to 2 requests every 60 seconds.</p>
    <p class="typography--subtitle">
      Rate limits can be
      <a
        href="https://docs.arcjet.com/reference/astro#ad-hoc-rules"
        class="link">dynamically adjusted</a
      >
      e.g. to set a limit based on the authenticated user.
    </p>
  </div>

  <hr class="divider" />

  <div class="section">
    <h2 class="heading-secondary">See the code</h2>
    <p class="typography--subtitle">
      The
      <a
        href="https://github.com/arcjet/example-sveltekit/blob/main/src/routes/rate-limiting/+page.server.ts"
        target="_blank"
        rel="noreferrer"
        class="link"
      >
        form action
      </a>
      imports a
      <a
        href="https://github.com/arcjet/example-sveltekit/blob/main/src/lib/server/arcjet.ts"
        target="_blank"
        rel="noreferrer"
        class="link"
      >
        centralized Arcjet client
      </a>
      which sets base rules.
    </p>
  </div>

  <hr class="divider" />

  <WhatNext />
</main>
