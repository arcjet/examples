<script setup lang="ts">
import { FetchError } from "ofetch";

let message = ref<string | null>(null);

async function onSubmit(event: SubmitEvent) {
  if (!(event.target instanceof HTMLFormElement)) {
    throw new Error("assert event.target is HTMLFormElement");
  }

  const body = new FormData(event.target);

  try {
    await $fetch("/api/signup", {
      method: "POST",
      body,
    });
    await navigateTo("/signup/submitted");
  } catch (cause) {
    if (!(cause instanceof FetchError)) {
      throw new Error("Failed to fetch /api/signup", { cause });
    }
    message.value = `We couldn't sign you up: ${cause.data?.message ?? cause.message}`;
  }
}
</script>

<template>
  <main class="page">
    <div class="section">
      <h1 class="heading-primary">Arcjet signup form protection</h1>
      <p class="typography-primary">
        This form uses{{ " " }}
        <a
          href="https://docs.arcjet.com/signup-protection/concepts"
          class="link"
        >
          Arcjet&apos;s signup form protection </a
        >{{ " " }}
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
      <form class="form" id="form-signup" @submit.prevent="onSubmit">
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
          <span class="form-description">
            Just a test form - you won&apos;t receive any emails.
          </span>
          <div v-if="message" className="form-error">{{ message }}</div>
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
          <code>test@0zc7eznv3rsiswlohu.tk</code>{{ " " }}
          <span>– is from a disposable email provider.</span>
        </li>
        <li>
          <code>nonexistent@arcjet.ai</code> – is a valid email address &
          domain, but has no MX records.
        </li>
      </ul>
    </div>
    <hr class="divider" />
    <div class="section">
      <h2 class="heading-secondary">See the code</h2>
      <p class="typography-secondary">
        The{{ " " }}
        <a
          href="https://github.com/arcjet/example-nuxt/blob/main/server/api/signup.post.ts"
          target="_blank"
          rel="noreferrer"
          class="link"
        >
          action </a
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
