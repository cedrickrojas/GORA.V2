<template>
  <ion-page>
    <SubPageHeader title="Saved Posts" back-href="/profile/settings" />
    <ion-content>
      <div class="saved-posts">
        <p v-if="error" class="saved-posts__state" role="alert">{{ error }}</p>
        <p v-else-if="postsStore.savedPosts.length === 0" class="saved-posts__state">No saved posts yet.</p>
        <div v-else class="saved-posts__list">
          <PostCard
            v-for="post in postsStore.savedPosts"
            :key="post.id"
            :post="post"
            :now-ms="now"
            @like="likePost"
            @comment="commentOnPost"
            @share="sharePost"
          />
        </div>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { IonContent, IonPage, onIonViewWillEnter } from '@ionic/vue';
import PostCard from '@/components/feed/PostCard.vue';
import SubPageHeader from '@/components/layout/SubPageHeader.vue';
import { useNow } from '@/composables/useNow';
import { usePostActions } from '@/composables/usePostActions';
import { usePostsStore } from '@/stores/posts';

const postsStore = usePostsStore();
const now = useNow();
const error = ref<string | null>(null);
const { likePost, commentOnPost, sharePost } = usePostActions();

onIonViewWillEnter(async () => {
  error.value = await postsStore.loadSaved();
});
</script>

<style scoped>
.saved-posts {
  max-width: 680px;
  margin: 0 auto;
  padding: 16px;
}
.saved-posts__list {
  display: grid;
  gap: 16px;
}
.saved-posts__state {
  padding: 24px 8px;
  color: var(--gora-muted);
  text-align: center;
}
</style>
