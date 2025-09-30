<script setup lang="ts">
import { FetchError } from "ofetch";

let message = ref<string | null>(null);

async function onSubmit() {
  try {
    message.value = await $fetch("/api/rate-limiting", {
      method: "POST",
    });
  } catch (cause) {
    if (!(cause instanceof FetchError)) {
      throw new Error("Failed to fetch /api/rate-limiting", { cause });
    }
    message.value = cause.data.message ?? cause.message;
  }
}
</script>

<template>
  <main class="page">
    <div class="section">
      <h1 class="heading-primary">Arcjet rate limiting example</h1>
      <p class="typography--description">
        This page is protected by{{ " " }}
        <a href="https://docs.arcjet.com/bot-protection/concepts" class="link">
          Arcjet&apos;s rate limiting
        </a>
        .
      </p>
    </div>

    <hr class="divider" />

    <div class="section">
      <h2 class="heading-secondary">Try it</h2>
      <form class="form" id="form-rate-limit" @submit.prevent="onSubmit">
        <button type="submit" class="button-primary form-button">
          Push me
        </button>
      </form>
      <code v-if="message" className="codeblock">{{ message }}</code>
      <p>The limit is set to 2 requests every 60 seconds.</p>
      <p class="typography--subtitle">
        Rate limits can be{{ " " }}
        <a
          href="https://docs.arcjet.com/reference/nuxt#ad-hoc-rules"
          class="link"
        >
          dynamically adjusted </a
        >{{ " " }}
        e.g. to set a limit based on the authenticated user.
      </p>
    </div>

    <hr class="divider" />

    <div class="section">
      <h2 class="heading-secondary">See the code</h2>
      <p class="typography--subtitle">
        The{{ " " }}
        <a
          href="https://github.com/arcjet/example-nuxt/blob/main/server/api/rate-limiting.post.ts"
          target="_blank"
          rel="noreferrer"
          class="link"
        >
          Server Route </a
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
