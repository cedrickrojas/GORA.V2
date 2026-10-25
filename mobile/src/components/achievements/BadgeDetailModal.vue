<template>
  <ion-modal
    :is-open="badge !== null"
    :initial-breakpoint="0.62"
    :breakpoints="[0, 0.62, 0.9]"
    class="badge-detail-modal"
    @did-dismiss="emit('close')"
  >
    <ion-content class="badge-detail-content">
      <div v-if="shownBadge" class="badge-detail" :class="{ 'badge-detail--locked': !unlocked }">
        <span class="badge-detail__medal">
          <ion-icon :icon="BADGE_ICONS[shownBadge.icon]" aria-hidden="true" />
        </span>

        <span class="badge-detail__category">{{ BADGE_CATEGORY_LABELS[shownBadge.category] }}</span>
        <h2 class="badge-detail__name">{{ shownBadge.name }}</h2>
        <p class="badge-detail__description">{{ shownBadge.description }}</p>

        <span class="badge-detail__status">
          <ion-icon :icon="unlocked ? checkmarkCircle : lockClosed" aria-hidden="true" />
          {{ unlocked ? 'Unlocked' : 'Locked' }}
        </span>

        <div class="badge-detail__progress">
          <AchievementProgress :current="shownBadge.progress" :target="shownBadge.target" label="Progress" />
          <p class="badge-detail__remaining">
            {{ unlocked ? 'Badge earned. Nice work.' : getBadgeRemainingText(shownBadge) }}
          </p>
        </div>

        <dl class="badge-detail__requirement">
          <dt>Requirement</dt>
          <dd>{{ shownBadge.requirement.text }}</dd>
        </dl>
      </div>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { IonContent, IonIcon, IonModal } from '@ionic/vue';
import { checkmarkCircle, lockClosed } from 'ionicons/icons';
import type { Badge } from '@/types/achievement';
import {
  BADGE_CATEGORY_LABELS,
  BADGE_ICONS,
  getBadgeRemainingText,
  isBadgeUnlocked,
} from '@/utils/badges';
import AchievementProgress from './AchievementProgress.vue';

const props = defineProps<{ badge: Badge | null }>();
const emit = defineEmits<{ close: [] }>();

/** Keeps the content rendered while the sheet animates closed. */
const shownBadge = ref<Badge | null>(props.badge);

watch(
  () => props.badge,
  (badge) => {
    if (badge) {
      shownBadge.value = badge;
    }
  },
);

const unlocked = computed(() => (shownBadge.value ? isBadgeUnlocked(shownBadge.value) : false));
</script>

<style scoped>
.badge-detail-modal {
  --background: var(--gora-surface);
  --border-radius: 24px;
}

.badge-detail-content {
  --background: var(--gora-surface);
}

.badge-detail {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 24px calc(24px + env(safe-area-inset-bottom));
  text-align: center;
}

.badge-detail__medal {
  display: flex;
  width: 84px;
  height: 84px;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--ion-color-primary);
  box-shadow: 0 0 0 8px rgba(var(--ion-color-primary-rgb), 0.14);
  color: var(--ion-color-primary-contrast);
  font-size: 40px;
}

.badge-detail__category {
  margin-top: 20px;
  color: var(--gora-muted);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.badge-detail__name {
  margin: 6px 0 0;
  font-size: 1.6rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.badge-detail__description {
  margin: 8px 0 0;
  color: var(--gora-muted);
  font-size: 0.95rem;
}

.badge-detail__status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 16px;
  padding: 6px 12px;
  border-radius: 999px;
  background: rgba(var(--ion-color-primary-rgb), 0.16);
  color: var(--ion-color-primary);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.badge-detail__progress {
  width: 100%;
  margin-top: 24px;
  text-align: left;
}

.badge-detail__remaining {
  margin: 10px 0 0;
  color: var(--gora-muted);
  font-size: 0.85rem;
}

.badge-detail__requirement {
  display: flex;
  width: 100%;
  justify-content: space-between;
  gap: 12px;
  margin: 20px 0 0;
  padding-top: 16px;
  border-top: 1px solid var(--gora-line);
  font-size: 0.85rem;
  text-align: left;
}

.badge-detail__requirement dt {
  color: var(--gora-muted);
}

.badge-detail__requirement dd {
  margin: 0;
  font-weight: 600;
}

.badge-detail--locked .badge-detail__medal {
  background: #1b2a37;
  box-shadow: none;
  color: #6d7b86;
}

.badge-detail--locked .badge-detail__status {
  background: var(--gora-line);
  color: var(--gora-muted);
}
</style>
