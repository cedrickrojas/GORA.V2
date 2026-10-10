<template>
  <nav class="profile-dropdown" aria-label="Your account">
    <div v-if="user" class="profile-dropdown__user">
      <UserAvatar :user="user" :size="40" />
      <span>
        <strong>{{ user.displayName }}</strong>
        <span>@{{ user.username }}</span>
      </span>
    </div>
    <router-link
      v-for="link in PROFILE_DROPDOWN_LINKS"
      :key="link.to"
      :to="link.to"
      class="profile-dropdown__link"
      @click="emit('navigate')"
    >
      <ion-icon :icon="link.icon" aria-hidden="true" />
      {{ link.label }}
    </router-link>
  </nav>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import UserAvatar from '@/components/common/UserAvatar.vue';
import type { UserSummary } from '@/types/user';
import { PROFILE_DROPDOWN_LINKS } from '@/utils/navigation';

defineProps<{ user: UserSummary | null }>();
const emit = defineEmits<{ navigate: [] }>();
</script>

<style scoped>
.profile-dropdown {
  display: flex;
  flex-direction: column;
  padding: 8px 0;
}

.profile-dropdown__user {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
  padding: 8px 16px 12px;
  border-bottom: 1px solid var(--gora-line);
}

.profile-dropdown__user > span {
  display: flex;
  flex-direction: column;
  font-size: 0.9rem;
}

.profile-dropdown__user > span span {
  color: var(--gora-muted);
  font-size: 0.75rem;
}

.profile-dropdown__link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 16px;
  color: var(--ion-text-color);
  font-size: 0.9rem;
  font-weight: 600;
  text-decoration: none;
}

.profile-dropdown__link ion-icon {
  color: var(--ion-color-primary);
  font-size: 20px;
}

.profile-dropdown__link:hover,
.profile-dropdown__link.router-link-exact-active {
  background: rgba(var(--ion-color-primary-rgb), 0.08);
}
</style>
