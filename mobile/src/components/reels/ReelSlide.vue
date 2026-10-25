<template>
  <article class="reel-slide" :style="{ background: visual.gradient }" :aria-label="`${reel.author.displayName}: ${reel.caption}`">
    <video
      v-if="reel.videoUrl"
      class="reel-slide__video"
      :src="reel.videoUrl"
      autoplay
      loop
      muted
      playsinline
    />
    <ion-icon v-else :icon="visual.icon" class="reel-slide__placeholder" aria-hidden="true" />

    <div class="reel-slide__rail">
      <button
        type="button"
        class="reel-slide__action"
        :class="{ 'reel-slide__action--active': reel.likedByViewer }"
        :aria-pressed="reel.likedByViewer"
        :aria-label="reel.likedByViewer ? 'Unlike' : 'Like'"
        @click="emit('like', reel)"
      >
        <ion-icon :icon="reel.likedByViewer ? heart : heartOutline" aria-hidden="true" />
        <span>{{ formatCompactNumber(reel.likes) }}</span>
      </button>
      <button type="button" class="reel-slide__action" aria-label="Comments" @click="emit('comment', reel)">
        <ion-icon :icon="chatbubbleOutline" aria-hidden="true" />
        <span>{{ formatCompactNumber(reel.comments) }}</span>
      </button>
      <button type="button" class="reel-slide__action" aria-label="Share" @click="emit('share', reel)">
        <ion-icon :icon="paperPlaneOutline" aria-hidden="true" />
        <span>{{ formatCompactNumber(reel.shares) }}</span>
      </button>
      <ReelOptionsButton v-if="isOwnReel" :reel="reel" />
    </div>

    <div class="reel-slide__info">
      <div class="reel-slide__author">
        <UserAvatar :user="reel.author" :size="36" />
        <strong>{{ reel.author.displayName }}</strong>
        <span class="reel-slide__handle">@{{ reel.author.username }}</span>
        <button
          v-if="canFollow"
          type="button"
          class="reel-slide__follow"
          :class="{ 'reel-slide__follow--active': isFollowing }"
          :aria-pressed="isFollowing"
          @click="emit('follow', reel)"
        >
          {{ isFollowing ? 'Following' : 'Follow' }}
        </button>
      </div>
      <p v-if="reel.caption" class="reel-slide__caption">{{ reel.caption }}</p>
      <div class="reel-slide__context">
        <span v-if="isOwnReel" class="reel-slide__chip">{{ privacy.emoji }} {{ privacy.label }}</span>
        <span v-if="reel.club" class="reel-slide__chip">
          <ion-icon :icon="peopleCircleOutline" aria-hidden="true" />
          {{ reel.club.name }}
        </span>
        <span class="reel-slide__chip">
          <ion-icon :icon="visual.icon" aria-hidden="true" />
          {{ reel.sport }}
        </span>
        <span v-if="reel.locationName" class="reel-slide__chip">
          <ion-icon :icon="locationOutline" aria-hidden="true" />
          {{ reel.locationName }}
        </span>
        <span class="reel-slide__chip">
          <ion-icon :icon="eyeOutline" aria-hidden="true" />
          {{ formatCompactNumber(reel.views) }}
        </span>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { IonIcon } from '@ionic/vue';
import {
  chatbubbleOutline,
  eyeOutline,
  heart,
  heartOutline,
  locationOutline,
  paperPlaneOutline,
  peopleCircleOutline,
} from 'ionicons/icons';
import UserAvatar from '@/components/common/UserAvatar.vue';
import ReelOptionsButton from '@/components/media/ReelOptionsButton.vue';
import { useReelsStore } from '@/stores/reels';
import type { Reel } from '@/types/reel';
import { getPrivacyOption } from '@/utils/post-privacy';
import { getSportVisual } from '@/utils/sports';
import { formatCompactNumber } from '@/utils/time';

const props = withDefaults(defineProps<{ reel: Reel; isFollowing?: boolean; canFollow?: boolean }>(), {
  isFollowing: false,
  canFollow: false,
});
const emit = defineEmits<{
  like: [reel: Reel];
  comment: [reel: Reel];
  share: [reel: Reel];
  follow: [reel: Reel];
}>();

const reelsStore = useReelsStore();
const visual = computed(() => getSportVisual(props.reel.sport));
/** Only your own stored reels get the "⋯" menu and the privacy chip. */
const isOwnReel = computed(() => reelsStore.myReels.some((reel) => reel.id === props.reel.id));
const privacy = computed(() => getPrivacyOption(props.reel.visibility ?? 'PUBLIC'));
</script>

<style scoped>
.reel-slide {
  position: relative;
  display: flex;
  height: 100%;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  scroll-snap-align: start;
  scroll-snap-stop: always;
}

.reel-slide__video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.reel-slide__placeholder {
  color: rgba(255, 255, 255, 0.16);
  font-size: 160px;
}

.reel-slide__rail {
  position: absolute;
  z-index: 1;
  right: 10px;
  bottom: 120px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.reel-slide__action {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 0;
  border: 0;
  background: none;
  color: #fff;
  cursor: pointer;
  font: inherit;
  font-size: 0.72rem;
  font-weight: 700;
}

.reel-slide__action ion-icon {
  font-size: 30px;
  filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.5));
}

.reel-slide__action--active ion-icon {
  color: #ff5a5f;
}

.reel-slide__info {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  padding: 48px 72px 20px 16px;
  background: linear-gradient(0deg, rgba(0, 0, 0, 0.7), transparent);
}

.reel-slide__author {
  display: flex;
  align-items: center;
  gap: 8px;
}

.reel-slide__handle {
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.78rem;
}

.reel-slide__follow {
  margin-left: 4px;
  padding: 4px 12px;
  border: 1px solid #fff;
  border-radius: 999px;
  background: transparent;
  color: #fff;
  cursor: pointer;
  font: inherit;
  font-size: 0.72rem;
  font-weight: 700;
}

.reel-slide__follow--active {
  border-color: rgba(255, 255, 255, 0.4);
  color: rgba(255, 255, 255, 0.75);
}

.reel-slide__caption {
  margin: 10px 0;
  font-size: 0.9rem;
  line-height: 1.35;
}

.reel-slide__context {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.reel-slide__chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.4);
  font-size: 0.72rem;
  font-weight: 600;
}
</style>
