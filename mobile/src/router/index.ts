import { createRouter, createWebHistory } from '@ionic/vue-router';
import type { RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { resolveAuthNavigation } from '../utils/auth';

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean;
    guestOnly?: boolean;
    superAdminOnly?: boolean;
  }
}

export const routes: RouteRecordRaw[] = [
  {
    path: '/admin',
    name: 'super-admin',
    component: () => import('../views/admin/AdminDashboardPage.vue'),
    meta: { requiresAuth: true, superAdminOnly: true },
  },
  {
    path: '/',
    name: 'landing',
    component: () => import('../views/LandingPage.vue'),
    meta: { guestOnly: true },
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/auth/LoginPage.vue'),
    meta: { guestOnly: true },
  },
  {
    path: '/register',
    name: 'register',
    component: () => import('../views/auth/RegisterPage.vue'),
    meta: { guestOnly: true },
  },
  {
    path: '/',
    component: () => import('../layouts/TabsLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: 'posts/:postId',
        name: 'post-details',
        component: () => import('../views/PostDetailsPage.vue'),
      },
      {
        path: 'home',
        name: 'home',
        component: () => import('../views/HomePage.vue'),
      },
      {
        path: 'search',
        name: 'search',
        component: () => import('../views/SearchPage.vue'),
      },
      {
        path: 'search/:sport',
        name: 'sport',
        component: () => import('../views/SportPage.vue'),
      },
      {
        path: 'discover',
        name: 'discover',
        component: () => import('../views/DiscoverPage.vue'),
      },
      {
        path: 'create',
        name: 'create',
        component: () => import('../views/CreatePage.vue'),
      },
      {
        path: 'create/post',
        name: 'create-post',
        component: () => import('../views/CreatePostPage.vue'),
      },
      {
        path: 'create/game',
        name: 'create-game',
        component: () => import('../views/CreateGamePage.vue'),
      },
      {
        path: 'create/story',
        name: 'create-story',
        component: () => import('../views/CreateStoryPage.vue'),
      },
      {
        path: 'create/reel',
        name: 'create-reel',
        component: () => import('../views/CreateReelPage.vue'),
      },
      {
        path: 'create/live',
        name: 'create-live',
        component: () => import('../views/LivePage.vue'),
      },
      {
        path: 'live',
        name: 'live-broadcasts',
        component: () => import('../views/LiveDirectoryPage.vue'),
      },
      {
        path: 'live/:liveId',
        name: 'watch-live',
        component: () => import('../views/LivePage.vue'),
      },
      {
        path: 'games/:gameId',
        name: 'game-details',
        component: () => import('../views/GameDetailsPage.vue'),
      },
      {
        // Host only; the page shows why when the viewer cannot edit.
        path: 'games/:gameId/edit',
        name: 'edit-game',
        component: () => import('../views/CreateGamePage.vue'),
      },
      {
        // Opened by tapping a post or game location; not a tab. ?name= labels the place, ?game= marks the game.
        path: 'map/:lat/:lng',
        name: 'location-map',
        component: () => import('../views/LocationMapPage.vue'),
      },
      {
        path: 'reels',
        name: 'reels',
        component: () => import('../views/ReelsPage.vue'),
      },
      {
        path: 'chat',
        name: 'chat',
        component: () => import('../views/ChatPage.vue'),
      },
      {
        // A club's official group chat; ACTIVE members only. Users never create group chats.
        path: 'chat/clubs/:clubId',
        name: 'club-chat',
        component: () => import('../views/ClubChatPage.vue'),
      },
      {
        // Messaging someone who isn't a friend: the same chat screen; the first message is a message request.
        path: 'chat/request/:userId',
        name: 'chat-request',
        component: () => import('../views/ChatThreadPage.vue'),
      },
      {
        path: 'chat/:conversationId',
        name: 'chat-thread',
        component: () => import('../views/ChatThreadPage.vue'),
      },
      {
        path: 'notifications',
        name: 'notifications',
        component: () => import('../views/NotificationsPage.vue'),
      },
      {
        path: 'profile',
        name: 'profile',
        component: () => import('../views/ProfilePage.vue'),
      },
      {
        path: 'profile/games',
        name: 'my-games',
        component: () => import('../views/profile/MyGamesPage.vue'),
      },
      {
        path: 'profile/reels',
        name: 'my-reels',
        component: () => import('../views/profile/MyReelsPage.vue'),
      },
      {
        path: 'profile/stories',
        name: 'my-stories',
        component: () => import('../views/profile/MyStoriesPage.vue'),
      },
      {
        path: 'profile/friends',
        name: 'friends',
        component: () => import('../views/profile/FriendsPage.vue'),
      },
      {
        path: 'profile/help',
        name: 'my-help-requests',
        component: () => import('../views/profile/HelpRequestsPage.vue'),
      },
      {
        path: 'profile/clubs',
        name: 'my-clubs',
        component: () => import('../views/profile/MyClubsPage.vue'),
      },
      {
        path: 'profile/clubs/new',
        name: 'create-club',
        component: () => import('../views/profile/CreateClubPage.vue'),
      },
      {
        path: 'clubs/:clubId',
        name: 'club',
        component: () => import('../views/ClubPage.vue'),
      },
      {
        path: 'clubs/:clubId/manage',
        name: 'manage-club',
        component: () => import('../views/ManageClubPage.vue'),
      },
      {
        path: 'profile/edit',
        name: 'edit-profile',
        component: () => import('../views/profile/EditProfilePage.vue'),
      },
      {
        path: 'profile/followers',
        name: 'followers',
        component: () => import('../views/profile/FollowListPage.vue'),
      },
      {
        path: 'profile/following',
        name: 'following',
        component: () => import('../views/profile/FollowListPage.vue'),
      },
      {
        path: 'profile/badges',
        name: 'badges',
        component: () => import('../views/BadgesPage.vue'),
      },
      {
        path: 'profile/activity',
        name: 'activity',
        component: () => import('../views/profile/ActivityPage.vue'),
      },
      {
        path: 'profile/archive',
        name: 'profile-archive',
        component: () => import('../views/profile/ArchivePage.vue'),
      },
      {
        path: 'profile/saved',
        name: 'saved-posts',
        component: () => import('../views/profile/SavedPostsPage.vue'),
      },
      {
        path: 'profile/settings',
        name: 'settings',
        component: () => import('../views/profile/SettingsPage.vue'),
      },
      {
        // Another user's profile; the static /profile/* routes above always win, and those
        // names are reserved at registration. Reached from posts, players, friends, and chat.
        path: 'profile/:username',
        name: 'user-profile',
        component: () => import('../views/UserProfilePage.vue'),
      },
      {
        path: 'users/:username',
        redirect: (to) => `/profile/${encodeURIComponent(String(to.params.username))}`,
      },
    ],
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/home',
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  await auth.initialize();

  return resolveAuthNavigation(
    {
      fullPath: to.fullPath,
      requiresAuth: to.matched.some((record) => record.meta.requiresAuth),
      guestOnly: to.matched.some((record) => record.meta.guestOnly),
      superAdminOnly: to.matched.some((record) => record.meta.superAdminOnly),
    },
    auth.isAuthenticated,
    auth.currentUser?.role,
  );
});

export default router;
