<template>
  <ion-page>
    <ion-content class="auth-shell__content">
      <main class="auth-shell">
        <header class="auth-shell__brand">
          <router-link to="/" class="auth-shell__logo" aria-label="GORA home">{{
            GORA_NAME
          }}</router-link>
          <span class="auth-shell__tagline">{{ GORA_TAGLINE }}</span>
        </header>

        <section class="auth-shell__card" :aria-labelledby="titleId">
          <h1 :id="titleId" class="auth-shell__title">{{ title }}</h1>
          <p v-if="subtitle" class="auth-shell__subtitle">{{ subtitle }}</p>
          <slot />
        </section>

        <footer class="auth-shell__footer">
          <slot name="footer" />
        </footer>
      </main>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonContent, IonPage } from '@ionic/vue';
import { RouterLink } from 'vue-router';
import { GORA_NAME, GORA_TAGLINE } from '@/constants/brand';

defineProps<{ title: string; subtitle?: string; titleId: string }>();
</script>

<style scoped>
.auth-shell__content {
  --background: var(--ion-background-color);
}

.auth-shell {
  display: flex;
  box-sizing: border-box;
  min-height: 100%;
  max-width: 420px;
  flex-direction: column;
  justify-content: center;
  gap: 20px;
  margin: 0 auto;
  padding: 32px 20px calc(32px + env(safe-area-inset-bottom));
}

.auth-shell__brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  text-align: center;
}

.auth-shell__logo {
  color: var(--ion-text-color);
  font-size: 2.8rem;
  font-weight: 900;
  letter-spacing: -0.045em;
  font-style: italic;
  text-decoration: none;
}

.auth-shell__logo::after {
  display: inline-block;
  width: 6px;
  height: 28px;
  margin-left: 10px;
  background: var(--ion-color-primary);
  content: '';
  transform: skew(-14deg);
}

.auth-shell__tagline {
  color: var(--gora-muted);
  font-size: 0.8rem;
  line-height: 1.6;
}

.auth-shell__card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 26px 22px;
  border: 1px solid var(--gora-line);
  border-top: 2px solid var(--ion-color-primary);
  border-radius: var(--gora-radius-card);
  background: var(--gora-surface);
  box-shadow: var(--gora-shadow);
}

.auth-shell__title {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 800;
}

.auth-shell__subtitle {
  margin: -6px 0 4px;
  color: var(--gora-muted);
  font-size: 0.85rem;
}

.auth-shell__footer {
  color: var(--gora-muted);
  font-size: 0.88rem;
  text-align: center;
}

.auth-shell__footer :slotted(a) {
  color: var(--ion-color-primary);
  font-weight: 700;
  text-decoration: none;
}

.auth-shell__card :slotted(.auth-form) {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.auth-shell__card :slotted(.auth-alert) {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid rgba(239, 91, 91, 0.5);
  border-radius: 12px;
  background: rgba(239, 91, 91, 0.12);
  color: #ffb4b4;
  font-size: 0.85rem;
}

.auth-shell__card :slotted(.auth-submit) {
  margin-top: 6px;
  padding: 14px;
  border: 0;
  border-radius: var(--gora-radius-control);
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
  cursor: pointer;
  font: inherit;
  font-weight: 800;
}

.auth-shell__card :slotted(.auth-submit:disabled) {
  background: #1b2a37;
  color: #7d8a93;
  cursor: progress;
}
</style>
