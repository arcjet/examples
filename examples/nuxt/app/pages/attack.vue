<script setup lang="ts">
const protocol = "http";
const hostname = "localhost:3000";
</script>

<template>
  <main class="page">
    <div class="section">
      <h1 class="heading-primary">Arcjet attack protection example</h1>
      <p class="typography-primary">
        This page is protected by{{ " " }}
        <a href="https://docs.arcjet.com/shield/concepts" class="link">
          Arcjet Shield
        </a>
        .
      </p>
      <p class="typography-secondary">
        Once a certain suspicion threshold is reached, subsequent requests from
        that client are blocked for a period of time. Shield detects{{ " " }}
        <a
          href="https://docs.arcjet.com/shield/concepts#which-attacks-will-arcjet-shield-block"
          class="link"
        >
          suspicious behavior
        </a>
        , such as SQL injection and cross-site scripting attacks.
      </p>
    </div>

    <hr class="divider" />

    <div class="section">
      <h2 class="heading-secondary">Try it</h2>
      <p class="typography-secondary">
        Simulate an attack using <code>curl</code>:
      </p>
      <pre class="codeblock">
curl -v -H &quot;x-arcjet-suspicious: true&quot; {{ protocol }}://{{
          hostname
        }}/attack/test</pre
      >
      <p class="typography-secondary">
        After the 5th request, your IP will be blocked for 15 minutes.
        Suspicious requests must meet a threshold before they are blocked to
        avoid false positives.
      </p>
      <p class="typography-secondary">
        Shield can also be installed in middleware to protect your entire site.
      </p>
    </div>

    <hr class="divider" />

    <div class="section">
      <h2 class="heading-secondary">See the code</h2>
      <p class="typography-secondary">
        The{{ " " }}
        <a
          href="https://github.com/arcjet/example-nuxt/blob/main/server/routes/attack/test.get.ts"
          target="_blank"
          rel="noreferrer"
          class="link"
        >
          endpoint </a
        >{{ " " }} imports a{{ " " }}
        <a
          href="https://github.com/arcjet/example-nuxt/blob/main/nuxt.config.ts"
          target="_blank"
          rel="noreferrer"
          class="link"
        >
          centralized Arcjet client </a
        >{{ " " }}
        which sets base rules.
      </p>
    </div>

    <hr class="divider" />

    <WhatNext />
  </main>
</template>
