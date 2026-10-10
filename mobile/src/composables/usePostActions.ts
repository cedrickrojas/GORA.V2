import { usePostsStore } from '@/stores/posts';
import type { FeedPost } from '@/types/post';
import { showNotice } from '@/utils/notice';
import { useRouter } from 'vue-router';
import { actionSheetController } from '@ionic/vue';
import { copyPostLink } from '@/utils/post-share';
import { useAuthStore } from '@/stores/auth';
import { captureSession } from '@/stores/authorized';

export function usePostActions() {
  const postsStore = usePostsStore();
  const router = useRouter();
  const auth = useAuthStore();
  const sharing = new Set<string>();

  async function likePost(post: FeedPost): Promise<void> {
    const error = await postsStore.toggleLike(post.id);
    if (error) void showNotice(error);
  }

  function commentOnPost(post: FeedPost): void {
    if (!post.fromServer) {
      void showNotice('Open a saved post to join the conversation.');
      return;
    }
    void router.push(`/posts/${encodeURIComponent(post.id)}#comments`);
  }

  async function sharePost(post: FeedPost): Promise<void> {
    if (!post.fromServer) {
      void showNotice('Open a saved post to share it.');
      return;
    }
    const url = new URL(`/posts/${encodeURIComponent(post.id)}`, window.location.origin).href;
    const isCurrent = captureSession(auth);
    async function complete(native: boolean): Promise<void> {
      if (sharing.has(post.id) || !isCurrent()) return;
      sharing.add(post.id);
      try {
        if (native) await navigator.share({ title: `Post by ${post.author.displayName} · GORA`, url });
        else await copyPostLink(url);
        if (!isCurrent()) return;
        const error = await postsStore.share(post.id);
        void showNotice(error ?? (native ? 'Post shared.' : 'Post link copied.'));
      } catch (caught) {
        if (!(caught instanceof DOMException && caught.name === 'AbortError'))
          void showNotice('Could not share this post. Please try again.');
      } finally {
        sharing.delete(post.id);
      }
    }
    const sheet = await actionSheetController.create({
      header: 'Share post',
      subHeader: 'Only people in this post’s audience can open the link.',
      buttons: [
        ...(typeof navigator.share === 'function'
          ? [
              {
                text: 'Share…',
                handler: () => {
                  void complete(true);
                },
              },
            ]
          : []),
        {
          text: 'Copy link',
          handler: () => {
            void complete(false);
          },
        },
        { text: 'Cancel', role: 'cancel' },
      ],
    });
    await sheet.present();
  }

  return { likePost, commentOnPost, sharePost };
}
