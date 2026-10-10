import { usePostsStore } from '@/stores/posts';
import type { FeedPost } from '@/types/post';
import { showLaterPhaseNotice, showNotice } from '@/utils/notice';

/** Like works now; comments and sharing open once their screens exist. */
export function usePostActions() {
  const postsStore = usePostsStore();

  async function likePost(post: FeedPost): Promise<void> {
    const error = await postsStore.toggleLike(post.id);
    if (error) void showNotice(error);
  }

  function commentOnPost(): void {
    void showLaterPhaseNotice('Comments');
  }

  function sharePost(): void {
    void showLaterPhaseNotice('Share');
  }

  return { likePost, commentOnPost, sharePost };
}
