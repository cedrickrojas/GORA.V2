<template>
  <li class="player-row">
    <router-link :to="profilePath" class="player-row__link">
      <UserAvatar :user="player" :size="44" />
      <span class="player-row__text">
        <strong>{{ player.displayName }}</strong>
        <span v-if="isServerId(player.id)">@{{ player.username }}{{ player.city ? ` · ${player.city}` : '' }}</span>
        <span v-else>{{ player.primarySport }} · {{ player.city }} · {{ formatDistanceKm(player.distanceKm) }}</span>
      </span>
      <span v-if="!isServerId(player.id)" class="player-row__meta"
        >{{ formatCompactNumber(player.followers) }} followers</span
      >
    </router-link>
  </li>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import UserAvatar from '@/components/common/UserAvatar.vue';
import { useSessionStore } from '@/stores/session';
import type { PlayerSummary } from '@/types/player';
import { userProfilePath } from '@/utils/profile-links';
import { formatCompactNumber, formatDistanceKm } from '@/utils/time';
import { isServerId } from '@/utils/post-api';

const props = defineProps<{ player: PlayerSummary }>();

const session = useSessionStore();
const profilePath = computed(() => userProfilePath(props.player.username, session.me?.username));
</script>

<style scoped>
.player-row__link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  color: inherit;
  text-decoration: none;
}

.player-row__text {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 2px;
}

.player-row__text strong {
  font-size: 0.92rem;
}

.player-row__text span,
.player-row__meta {
  overflow: hidden;
  color: var(--gora-muted);
  font-size: 0.75rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.player-row__meta {
  flex-shrink: 0;
  color: var(--ion-color-primary);
  font-weight: 600;
}
</style>
