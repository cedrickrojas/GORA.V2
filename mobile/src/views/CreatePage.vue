<template>
  <ion-page>
    <AppHeader />

    <ion-content :fullscreen="true">
      <div class="create">
        <h1 class="create__title">Create</h1>
        <ul class="create__list">
          <li v-for="action in CREATE_ACTIONS" :key="action.id">
            <button type="button" class="create__action" @click="runCreateAction(action)">
              <span class="create__icon">
                <ion-icon :icon="action.icon" aria-hidden="true" />
              </span>
              {{ action.label }}
            </button>
          </li>
        </ul>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonContent, IonIcon, IonPage } from '@ionic/vue';
import AppHeader from '@/components/layout/AppHeader.vue';
import { CREATE_ACTIONS, useCreateMenu } from '@/composables/useCreateMenu';

const { runCreateAction } = useCreateMenu();
</script>

<style scoped>
.create {
  padding: 8px 16px 32px;
}

.create__title {
  margin: 4px 0 12px;
  font-size: 1.4rem;
  font-weight: 800;
}

.create__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.create__action {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 14px;
  padding: 14px;
  border: 0;
  border-radius: 14px;
  background: var(--gora-surface);
  color: var(--ion-text-color);
  cursor: pointer;
  font: inherit;
  font-weight: 600;
  text-align: left;
}

.create__icon {
  display: flex;
  width: 40px;
  height: 40px;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
  font-size: 20px;
}
</style>
