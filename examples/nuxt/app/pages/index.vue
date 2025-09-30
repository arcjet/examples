<template>
  <main class="page">
    <div class="section">
      <h1 class="heading-primary">Arcjet Nuxt example app</h1>
      <p class="typography-primary">
        <a href="https://arcjet.com" target="_blank" class="link">Arcjet</a
        >{{ " " }}
        helps developers protect their apps in just a few lines of code. Bot
        detection. Rate limiting. Email validation. Attack protection. Data
        redaction. A developer-first approach to security.
      </p>
      <p class="typography-secondary">
        This is an example Nuxt application using Arcjet. The code is{{ " " }}
        <a
          href="https://github.com/arcjet/example-nuxt"
          target="_blank"
          rel="noreferrer"
          class="link"
        >
          on GitHub
        </a>
        .
      </p>
    </div>

    <div class="section">
      <h2 class="heading-secondary">Examples</h2>
      <div class="list-actions">
        <NuxtLink href="/signup" class="button-primary">
          Signup form protection
        </NuxtLink>
        <NuxtLink href="/bots" class="button-primary">
          Bot protection
        </NuxtLink>
        <NuxtLink href="/rate-limiting" class="button-primary">
          Rate limiting
        </NuxtLink>
        <NuxtLink href="/attack" class="button-primary">
          Attack protection
        </NuxtLink>
        <NuxtLink href="/sensitive-info" class="button-primary">
          Sensitive info
        </NuxtLink>
      </div>
    </div>

    <hr class="divider" />

    <div class="section">
      <h2 class="heading-secondary">Deploy it now</h2>
      <div class="list-actions">
        <a
          href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Farcjet%2Fexample-nuxt&project-name=arcjet-nuxt-example&repository-name=arcjet-nuxt-example&developer-id=oac_1GEcKBuKBilVnjToj1QUwdb8&demo-title=Arcjet%Nuxt%20Example%20&demo-description=Example%20rate%20limiting%2C%20bot%20protection%2C%20email%20verification%20%26%20form%20protection.&demo-url=https%3A%2F%2Fgithub.com%2Farcjet%2Fexample-nuxt&demo-image=https%3A%2F%2Fapp.arcjet.com%2Fimg%2Fexample-apps%2Fvercel%2Fdemo-image.jpg&integration-ids=oac_1GEcKBuKBilVnjToj1QUwdb8&external-id=arcjet-js-example"
          title="Deploy with Vercel"
          target="_blank"
        >
          <img src="https://vercel.com/button" alt="Deploy with Vercel" />
        </a>
        <a
          href="https://app.netlify.com/start/deploy?repository=https://github.com/arcjet/example-nuxt"
          title="Deploy to Netlify"
          target="_blank"
        >
          <img
            src="https://www.netlify.com/img/deploy/button.svg"
            alt="Deploy to Netlify"
          />
        </a>
      </div>
    </div>
    <WhatNext />
  </main>
</template>
