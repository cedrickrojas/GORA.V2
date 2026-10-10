<template>
  <aside class="desktop-side desktop-side--end" aria-label="Friends">
    <p v-if="friendsStore.error" class="desktop-side__empty" role="alert">{{ friendsStore.error }}</p>
    <template v-if="friendsStore.received.length">
      <div class="desktop-side__heading">
        <span>Friend requests</span>
        <router-link to="/profile/friends?tab=requests">See all</router-link>
      </div>
      <div v-for="request in friendsStore.received.slice(0, 2)" :key="request.id" class="desktop-side__request">
        <UserAvatar :user="request.player" :size="44" />
        <div class="desktop-side__request-body">
          <router-link :to="`/profile/${request.player.username}`" class="desktop-side__person">{{
            request.player.displayName
          }}</router-link>
          <span>{{ request.mutualFriends }} mutual {{ request.mutualFriends === 1 ? 'friend' : 'friends' }}</span>
          <div class="desktop-side__request-actions">
            <button
              type="button"
              class="desktop-side__accept"
              :disabled="!!friendsStore.busyId"
              @click="accept(request.id)"
            >
              {{ friendsStore.busyId === request.id ? 'Saving…' : 'Accept' }}
            </button>
            <button
              type="button"
              class="desktop-side__decline"
              :disabled="!!friendsStore.busyId"
              @click="friendsStore.dismiss(request.id)"
            >
              Decline
            </button>
          </div>
        </div>
      </div>
      <div class="desktop-side__divider" />
    </template>

    <div class="desktop-side__heading">
      <span
        >Your friends <small>{{ friendsStore.friends.length }}</small></span
      >
      <router-link to="/profile/friends">See all</router-link>
    </div>
    <p v-if="friendsStore.friends.length === 0" class="desktop-side__empty">Friends you add show up here.</p>
    <router-link
      v-for="contact in contacts"
      :key="contact.friend.id"
      :to="`/profile/${contact.friend.username}`"
      class="desktop-side__row"
    >
      <UserAvatar :user="contact.friend" :size="36" />
      <span class="desktop-side__contact-name">{{ contact.friend.displayName }}</span>
      <span v-if="contact.conversation && contact.conversation.unreadCount > 0" class="desktop-side__unread">
        {{ contact.conversation.unreadCount }}
      </span>
    </router-link>
  </aside>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import UserAvatar from '@/components/common/UserAvatar.vue';
import { useChatStore } from '@/stores/chat';
import { useFriendsStore } from '@/stores/friends';
import { showNotice } from '@/utils/notice';

const friendsStore = useFriendsStore();
const chatStore = useChatStore();

async function accept(id: string): Promise<void> {
  if (await friendsStore.accept(id)) void showNotice('You are now friends. Their posts are available in your feed.');
}

/** Friends with an existing direct conversation open it; the rest open Chat. */
const contacts = computed(() =>
  friendsStore.friends.map((friend) => ({
    friend,
    conversation: chatStore.conversations.find(
      (conversation) => conversation.type === 'DIRECT' && conversation.partner.id === friend.id,
    ),
  })),
);

onMounted(() => {
  void friendsStore.load();
  void chatStore.load();
});
</script>
