<template>
  <li class="club-row">
    <router-link :to="`/clubs/${club.id}`" class="club-row__link">
      <ClubAvatar :club="club" :image-url="club.profileImageUrl" :size="48" />
      <span class="club-row__text">
        <strong>
          {{ club.name }}
          <ion-icon v-if="!club.isPublic" :icon="lockClosed" aria-label="Private club" />
        </strong>
        <span>{{ [club.sport ?? 'Multi-sport', club.city].filter(Boolean).join(' · ') }}</span>
        <span class="club-row__members">
          {{ formatClubCapacity(club) }}
          <span v-if="isClubFull(club)" class="club-row__full">FULL</span>
        </span>
      </span>
      <span v-if="badge" class="club-row__badge" :class="`club-row__badge--${badge.tone}`">{{ badge.label }}</span>
    </router-link>
  </li>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { IonIcon } from '@ionic/vue';
import { lockClosed } from 'ionicons/icons';
import ClubAvatar from './ClubAvatar.vue';
import type { Club } from '@/types/club';
import { CLUB_ROLE_LABELS, formatClubCapacity, isClubFull } from '@/utils/clubs';

const props = defineProps<{ club: Club }>();

const badge = computed((): { label: string; tone: 'staff' | 'member' | 'muted' } | null => {
  const membership = props.club.viewerMembership;

  if (membership?.status === 'ACTIVE') {
    return { label: CLUB_ROLE_LABELS[membership.role], tone: membership.role === 'MEMBER' ? 'member' : 'staff' };
  }

  if (membership?.status === 'PENDING') {
    return { label: 'Requested', tone: 'muted' };
  }

  return props.club.viewerFollows ? { label: 'Following', tone: 'muted' } : null;
});
</script>

<style scoped>
.club-row {
  list-style: none;
}

.club-row__link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: var(--gora-radius-card);
  background: var(--gora-surface);
  color: var(--ion-text-color);
  text-decoration: none;
}

.club-row__text {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 2px;
}

.club-row__text strong {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  font-size: 0.92rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.club-row__text strong ion-icon {
  flex-shrink: 0;
  color: var(--gora-muted);
  font-size: 13px;
}

.club-row__text span {
  color: var(--gora-muted);
  font-size: 0.74rem;
}

.club-row__text .club-row__members {
  color: var(--ion-color-primary);
  font-weight: 600;
}

.club-row__text .club-row__full {
  margin-left: 4px;
  color: #ef5b5b;
  font-weight: 800;
}

.club-row__badge {
  flex-shrink: 0;
  padding: 4px 10px;
  border-radius: var(--gora-radius-control);
  font-size: 0.68rem;
  font-weight: 700;
}

.club-row__badge--staff {
  background: var(--ion-color-primary);
  color: var(--ion-color-primary-contrast);
}

.club-row__badge--member {
  border: 1px solid rgba(var(--ion-color-primary-rgb), 0.4);
  color: var(--ion-color-primary);
}

.club-row__badge--muted {
  border: 1px solid var(--gora-line-strong);
  color: var(--gora-muted);
}
</style>
