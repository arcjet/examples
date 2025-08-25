<script lang="ts">
  import { enhance } from "$app/forms";
  import WhatNext from "$lib/components/WhatNext.svelte";
  import type { PageProps } from "./$types";

  let { form }: PageProps = $props();
</script>

<main class="page">
  <div class="section">
    <h1 class="heading-primary">Arcjet sensitive info detection example</h1>
    <p class="typography-primary">
      This form uses
      <a href="https://docs.arcjet.com/sensitive-info/concepts" class="link"
        >Arcjet's sensitive info detection</a
      >
      feature which is configured to detect credit card numbers. It can be configured
      to detect other types of sensitive information and custom patterns.
    </p>
    <p class="typography-secondary">
      The request is analyzed entirely on your server so no sensitive
      information is sent to Arcjet.
    </p>
  </div>

  <hr class="divider" />

  <div class="section">
    <h2 class="heading-secondary">Try it</h2>

    <form class="form" id="form-sensitive-info" method="POST" use:enhance>
      <div class="form-field">
        <label class="form-label">
          Message
          <textarea
            placeholder="Please enter your message."
            class="form-textarea"
            name="supportMessage"
            >{"I ordered a hat from your store and would like to request a refund. My credit card number is 4111111111111111"}</textarea
          >
        </label>
        {#if form?.error}
          <p class="form-error">{form.error}</p>
        {/if}
      </div>
      <button type="submit" class="button-primary form-button">Submit</button>
    </form>
  </div>

  <hr class="divider" />

  <div class="section">
    <h2 class="heading-secondary">See the code</h2>
    <p class="typography-secondary">
      The
      <a
        href="https://github.com/arcjet/example-sveltekit/blob/main/src/routes/sensitive-info/+page.server.ts"
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
