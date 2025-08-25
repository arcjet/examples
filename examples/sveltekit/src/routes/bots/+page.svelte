<script lang="ts">
  import WhatNext from "$lib/components/WhatNext.svelte";
</script>

<main class="page">
  <div class="section">
    <h1 class="heading-primary">Arcjet bot protection example</h1>
    <p class="typography-primary">
      This page is protected by
      <a href="https://docs.arcjet.com/bot-protection/concepts" class="link"
        >Arcjet's bot protection</a
      >
      configured to block automated clients.
    </p>
  </div>

  <hr class="divider" />

  <div class="section">
    <h2 class="heading-secondary">Try it</h2>
    <p class="typography-secondary">
      Make a request using <code>curl</code>, which is considered an automated
      client:
    </p>
    <pre class="codeblock">curl -v http://localhost:5173/bots/test</pre>
    <p class="typography-secondary">Your IP will be blocked for 60 seconds.</p>
    <p class="typography-secondary">
      Bot protection can also be installed in middleware to protect your entire
      site.
    </p>
  </div>

  <hr class="divider" />

  <div class="section">
    <h2 class="heading-secondary">See the code</h2>
    <p class="typography-secondary">
      The
      <a
        href="https://github.com/arcjet/example-sveltekit/blob/main/src/routes/bots/test/+server.ts"
        target="_blank"
        rel="noreferrer"
        class="link"
      >
        route
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
