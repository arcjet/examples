<script lang="ts">
  import { enhance } from "$app/forms";
  import WhatNext from "$lib/components/WhatNext.svelte";
  import type { PageProps } from "./$types";

  let { form }: PageProps = $props();
</script>

<main class="page">
  <div class="section">
    <h1 class="heading-primary">Arcjet signup form protection</h1>
    <p class="typography-primary">
      This form uses
      <a href="https://docs.arcjet.com/signup-protection/concepts" class="link"
        >Arcjet's signup form protection</a
      >
      which includes:
    </p>
    <ul class="bulleted--primary">
      <li>
        Arcjet server-side email verification configured to block disposable
        providers and ensure that the domain has a valid MX record.
      </li>
      <li>
        Rate limiting set to 5 requests over a 2 minute sliding window - a
        reasonable limit for a signup form, but easily configurable.
      </li>
      <li>
        Bot protection to stop automated clients from submitting the form.
      </li>
    </ul>
  </div>

  <hr class="divider" />

  <div class="section">
    <h2 class="heading-secondary">Try it</h2>
    <form class="form" id="form-signup" method="POST" use:enhance>
      <div class="form-field">
        <label class="form-label">
          Email
          <input
            name="email"
            type="email"
            placeholder="totoro@example.com"
            class="form-input"
            value="nonexistent@arcjet.ai"
          />
        </label>
        <span class="form-description"
          >Just a test form - you won't receive any emails.</span
        >
        {#if form?.error}
          <p class="form-error">We couldn't sign you up: {form.error}</p>
        {/if}
      </div>
      <div class="form-button">
        <button type="submit" class="button-primary">Sign up</button>
      </div>
    </form>

    <h2 class="heading-secondary">Test emails</h2>
    <p class="typography-secondary">Try these emails to see how it works:</p>
    <ul class="list-bullets-secondary">
      <li><code>invalid.@arcjet</code> – is an invalid email address.</li>
      <li>
        <code>test@0zc7eznv3rsiswlohu.tk</code> – is from a disposable email provider.
      </li>
      <li>
        <code>nonexistent@arcjet.ai</code> – is a valid email address & domain, but
        has no MX records.
      </li>
    </ul>
  </div>

  <hr class="divider" />

  <div class="section">
    <h2 class="heading-secondary">See the code</h2>
    <p class="typography-secondary">
      The
      <a
        href="https://github.com/arcjet/example-sveltekit/blob/main/src/routes/signup/+page.server.ts"
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
