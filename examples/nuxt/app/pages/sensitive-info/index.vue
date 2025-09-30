<script setup lang="ts">
import { FetchError } from "ofetch";

let message = ref<string | null>(null);

async function onSubmit(event: SubmitEvent) {
  if (!(event.target instanceof HTMLFormElement)) {
    throw new Error("assert event.target is HTMLFormElement");
  }

  const body = new FormData(event.target);

  try {
    await $fetch("/api/sensitive-info", {
      method: "POST",
      body,
    });
    await navigateTo("/sensitive-info/submitted");
  } catch (cause) {
    if (!(cause instanceof FetchError)) {
      throw new Error("Failed to fetch /api/sensitive-info", { cause });
    }
    message.value = cause.data?.message ?? cause.message;
  }
}
</script>

<template>
  <main class="page">
    <div class="section">
      <h1 class="heading-primary">Arcjet sensitive info detection example</h1>
      <p class="typography-primary">
        This form uses{{ " " }}
        <a href="https://docs.arcjet.com/sensitive-info/concepts" class="link">
          Arcjet&apos;s sensitive info detection </a
        >{{ " " }}
        feature which is configured to detect credit card numbers. It can be
        configured to detect other types of sensitive information and custom
        patterns.
      </p>
      <p class="typography-secondary">
        The request is analyzed entirely on your server so no sensitive
        information is sent to Arcjet.
      </p>
    </div>

    <hr class="divider" />

    <div class="section">
      <h2 class="heading-secondary">Try it</h2>

      <form class="form" id="form-sensitive-info" @submit.prevent="onSubmit">
        <div class="form-field">
          <label class="form-label">
            Message
            <!-- prettier doesn't understand textarea children are white-space sensitive -->
            <!-- prettier-ignore -->
            <textarea
              placeholder="Please enter your message."
              class="form-textarea"
              name="supportMessage"
              >I ordered a hat from your store and would like to request a refund. My credit card number is 4111111111111111</textarea>
          </label>
          <div v-if="message" className="form-error">{{ message }}</div>
        </div>
        <button type="submit" class="button-primary form-button">Submit</button>
      </form>
    </div>
    <hr class="divider" />
    <div class="section">
      <h2 class="heading-secondary">See the code</h2>
      <p class="typography-secondary">
        The{{ " " }}
        <a
          href="https://github.com/arcjet/example-nuxt/blob/main/server/api/sensitive-info.post.ts"
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
