<template>
  <ion-page>
    <ion-content>
      <div class="admin-shell">
        <aside class="sidebar">
          <router-link to="/admin" class="brand" aria-label="Admin dashboard"
            >GORA<span>CONTROL CENTER</span></router-link
          >
          <div class="workspace-label">WORKSPACE</div>
          <nav aria-label="Admin navigation">
            <button
              v-for="item in sections"
              :key="item.id"
              type="button"
              :class="{ selected: section === item.id }"
              :aria-current="section === item.id ? 'page' : undefined"
              @click="navigate(item.id)"
            >
              <ion-icon :icon="item.icon" aria-hidden="true" />{{ item.label }}
              <span
                v-if="item.id === 'reports' && overview?.pendingReports"
                class="nav-count"
                >{{ number(overview.pendingReports) }}</span
              >
            </button>
          </nav>
          <div class="sidebar-footer">
            <div class="admin-identity">
              <span class="initials">{{
                auth.currentUser?.firstName.slice(0, 1)
              }}</span>
              <div>
                <strong>@{{ auth.currentUser?.username }}</strong
                ><small>Super administrator</small>
              </div>
            </div>
            <button
              type="button"
              class="logout-button"
              :disabled="isLoggingOut || busy"
              @click="logOut"
            >
              <ion-icon :icon="logOutOutline" aria-hidden="true" />{{
                isLoggingOut ? 'Logging out…' : 'Log out'
              }}
            </button>
          </div>
        </aside>

        <main class="main">
          <header class="topbar">
            <span
              >Administration
              <span class="breadcrumb">/ {{ currentSection.label }}</span></span
            >
            <div class="topbar-account">
              <span class="access-badge"
                ><ion-icon
                  :icon="shieldCheckmarkOutline"
                  aria-hidden="true"
                />SUPER ADMIN</span
              ><button
                type="button"
                class="logout-button mobile-logout"
                :disabled="isLoggingOut || busy"
                @click="logOut"
              >
                <ion-icon :icon="logOutOutline" aria-hidden="true" />Log out
              </button>
            </div>
          </header>
          <div class="page-content">
            <div class="page-heading">
              <div>
                <p class="eyebrow">GORA ADMINISTRATION</p>
                <h1>{{ currentSection.title }}</h1>
                <p>{{ currentSection.description }}</p>
              </div>
              <button
                class="button secondary"
                :disabled="loading || busy"
                @click="load"
              >
                <ion-icon :icon="refreshOutline" aria-hidden="true" />Refresh
              </button>
            </div>
            <p v-if="notice" class="notice" role="status">{{ notice }}</p>
            <div v-if="error" class="error" role="alert">
              {{ error }}
              <button v-if="!accessDenied" @click="load">Try again</button>
            </div>
            <div v-if="accessDenied" class="empty">
              <ion-icon :icon="shieldCheckmarkOutline" aria-hidden="true" />
              <h2>Super admin access required</h2>
              <p>
                Your account does not have permission to open this workspace.
              </p>
              <router-link to="/home" class="button secondary"
                >Back to GORA</router-link
              >
            </div>
            <div v-else :aria-busy="loading">
              <p v-if="loading" class="loading" role="status">
                Loading {{ currentSection.label.toLowerCase() }}…
              </p>

              <template v-if="section === 'overview' && overview">
                <div class="stat-grid">
                  <article
                    v-for="stat in stats"
                    :key="stat.label"
                    class="stat-card"
                  >
                    <div>
                      <span>{{ stat.label }}</span
                      ><ion-icon :icon="stat.icon" aria-hidden="true" />
                    </div>
                    <strong>{{ number(stat.value) }}</strong
                    ><small>{{ stat.note }}</small>
                  </article>
                </div>
                <div class="overview-grid">
                  <section class="panel growth">
                    <div class="panel-heading">
                      <div>
                        <h2>Community growth</h2>
                        <p>New registrations · last 7 days (UTC)</p>
                      </div>
                      <span class="period">7 DAYS</span>
                    </div>
                    <div class="growth-total">
                      <strong>{{ number(registrationTotal) }}</strong
                      ><span>new athletes</span>
                    </div>
                    <div class="bar-chart" role="img" :aria-label="chartLabel">
                      <div
                        v-for="day in overview.dailyRegistrations"
                        :key="day.day"
                        class="bar-column"
                      >
                        <span class="bar-value">{{ number(day.total) }}</span>
                        <div class="bar-track">
                          <div
                            class="bar"
                            :style="{
                              height: `${day.total ? Math.max(3, (day.total / chartMax) * 100) : 0}%`,
                            }"
                          ></div>
                        </div>
                        <span class="bar-label">{{ dayLabel(day.day) }}</span>
                      </div>
                    </div>
                  </section>
                  <section class="panel moderation">
                    <span class="panel-icon"
                      ><ion-icon :icon="flagOutline" aria-hidden="true"
                    /></span>
                    <h2>Moderation queue</h2>
                    <strong class="queue-total">{{
                      number(
                        overview.pendingReports + overview.reviewingReports,
                      )
                    }}</strong>
                    <p>Reports waiting for your team</p>
                    <div class="queue-line">
                      <span><i class="dot orange"></i>Pending</span
                      ><strong>{{ number(overview.pendingReports) }}</strong>
                    </div>
                    <div class="queue-line">
                      <span><i class="dot blue"></i>In review</span
                      ><strong>{{ number(overview.reviewingReports) }}</strong>
                    </div>
                    <button
                      class="button primary full"
                      @click="navigate('reports')"
                    >
                      Open reports<ion-icon
                        :icon="arrowForwardOutline"
                        aria-hidden="true"
                      />
                    </button>
                  </section>
                </div>
                <section class="panel platform">
                  <div>
                    <h2>Across the platform</h2>
                    <p>Published activity and communities</p>
                  </div>
                  <div v-for="item in platformStats" :key="item.label">
                    <strong>{{ number(item.value) }}</strong
                    ><span>{{ item.label }}</span>
                  </div>
                </section>
              </template>

              <template v-if="section === 'users'">
                <form class="filters" @submit.prevent="applyFilters">
                  <label class="search-field"
                    ><ion-icon :icon="searchOutline" aria-hidden="true" /><input
                      v-model="search"
                      type="search"
                      maxlength="100"
                      placeholder="Search name, username, or email"
                      aria-label="Search users" /></label
                  ><select v-model="roleFilter" aria-label="Filter by role">
                    <option value="">All roles</option>
                    <option value="USER">User</option>
                    <option value="ADMIN">Admin</option>
                    <option value="SUPER_ADMIN">Super admin</option></select
                  ><select
                    v-model="userStatus"
                    aria-label="Filter by account status"
                  >
                    <option value="">All statuses</option>
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option></select
                  ><button class="button secondary" :disabled="loading">
                    Apply
                  </button>
                </form>
                <section class="panel table-panel">
                  <div class="panel-heading">
                    <h2>
                      Accounts
                      <span class="count">{{ number(users?.total ?? 0) }}</span>
                    </h2>
                    <span class="muted">20 per page</span>
                  </div>
                  <div class="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>User</th>
                          <th>Role</th>
                          <th>Status</th>
                          <th>Joined</th>
                          <th><span class="sr-only">Actions</span></th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="user in users?.items" :key="user.id">
                          <td>
                            <div class="user-cell">
                              <span class="initials"
                                >{{ user.firstName.slice(0, 1)
                                }}{{ user.lastName.slice(0, 1) }}</span
                              >
                              <div>
                                <strong
                                  >{{ user.firstName }} {{ user.lastName }}
                                  <small v-if="user.id === auth.currentUser?.id"
                                    >(you)</small
                                  ></strong
                                ><span
                                  >@{{ user.username }} · {{ user.email }}</span
                                >
                              </div>
                            </div>
                          </td>
                          <td>
                            <span
                              class="badge"
                              :class="
                                user.role === 'SUPER_ADMIN' ? 'accent' : ''
                              "
                              >{{ humanize(user.role) }}</span
                            >
                          </td>
                          <td>
                            <span
                              class="status"
                              :class="user.isActive ? 'green' : 'red'"
                              ><i class="dot"></i
                              >{{
                                user.isActive ? 'Active' : 'Suspended'
                              }}</span
                            >
                          </td>
                          <td class="muted nowrap">
                            {{ date(user.createdAt) }}
                          </td>
                          <td>
                            <button
                              class="text-button"
                              :disabled="busy || loading"
                              @click="editUser(user)"
                            >
                              Manage<ion-icon
                                :icon="chevronForwardOutline"
                                aria-hidden="true"
                              />
                            </button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p
                    v-if="users && !users.items.length && !loading"
                    class="empty-message"
                  >
                    No accounts match these filters.
                  </p>
                </section>
              </template>

              <template v-if="section === 'reports'">
                <form class="filters" @submit.prevent="applyFilters">
                  <label class="filter-label"
                    >Report status<select v-model="reportStatus">
                      <option value="">All reports</option>
                      <option
                        v-for="status in reportStatuses"
                        :key="status"
                        :value="status"
                      >
                        {{ humanize(status) }}
                      </option>
                    </select></label
                  ><button class="button secondary" :disabled="loading">
                    Apply</button
                  ><span class="muted filter-note"
                    >Resolving a report records the review outcome. Account
                    actions are managed in Users.</span
                  >
                </form>
                <div class="report-list">
                  <article
                    v-for="report in reports?.items"
                    :key="report.id"
                    class="panel report-card"
                  >
                    <div class="report-header">
                      <span
                        class="badge"
                        :class="report.status === 'PENDING' ? 'accent' : ''"
                        >{{ humanize(report.status) }}</span
                      ><span class="muted">{{
                        dateTime(report.createdAt)
                      }}</span>
                    </div>
                    <h2>{{ humanize(report.reason) }}</h2>
                    <p class="report-meta">
                      Reported by
                      <strong>@{{ report.reporter.username }}</strong
                      ><template v-if="report.reportedUser">
                        · About
                        <strong
                          >@{{ report.reportedUser.username }}</strong
                        ></template
                      >
                    </p>
                    <p v-if="report.description" class="report-description">
                      {{ report.description }}
                    </p>
                    <div class="report-evidence">
                      <span>{{ reportTarget(report).label }}</span
                      ><code>{{ reportTarget(report).id }}</code>
                      <p v-if="reportPreview(report)">
                        {{ reportPreview(report) }}
                      </p>
                    </div>
                    <p v-if="report.resolvedBy" class="muted">
                      {{ humanize(report.status) }} by @{{
                        report.resolvedBy.username
                      }}
                      · {{ dateTime(report.resolvedAt!) }}
                    </p>
                    <div class="report-actions">
                      <button
                        v-for="status in reportStatuses.filter(
                          (s) => s !== report.status,
                        )"
                        :key="status"
                        class="button"
                        :class="status === 'RESOLVED' ? 'primary' : 'secondary'"
                        :disabled="busy || loading"
                        @click="confirmReport(report, status)"
                      >
                        {{ reportAction(status) }}
                      </button>
                    </div>
                  </article>
                </div>
                <div
                  v-if="reports && !reports.items.length && !loading"
                  class="panel empty"
                >
                  <ion-icon :icon="checkmarkCircleOutline" aria-hidden="true" />
                  <h2>You're all caught up</h2>
                  <p>No reports match the selected status.</p>
                </div>
              </template>

              <template v-if="section === 'sports'">
                <div class="info-line">
                  <ion-icon
                    :icon="informationCircleOutline"
                    aria-hidden="true"
                  />
                  <p>
                    Retiring a sport removes it from new selections. Existing
                    games, posts, and player history are preserved.
                  </p>
                </div>
                <div class="sports-grid">
                  <article
                    v-for="sport in sports"
                    :key="sport.id"
                    class="panel sport-card"
                  >
                    <div class="sport-top">
                      <span class="sport-symbol">{{
                        sport.name.slice(0, 2).toUpperCase()
                      }}</span
                      ><span
                        class="status"
                        :class="sport.isActive ? 'green' : 'muted'"
                        ><i class="dot"></i
                        >{{ sport.isActive ? 'Active' : 'Retired' }}</span
                      >
                    </div>
                    <h2>{{ sport.name }}</h2>
                    <p>
                      {{
                        sport.description || 'A sport for the GORA community.'
                      }}
                    </p>
                    <div class="sport-counts">
                      <span
                        ><strong>{{ number(sport._count.players) }}</strong>
                        players</span
                      ><span
                        ><strong>{{ number(sport._count.games) }}</strong>
                        games</span
                      >
                    </div>
                    <button
                      class="button secondary full"
                      :disabled="busy || loading"
                      @click="confirmSport(sport)"
                    >
                      {{ sport.isActive ? 'Retire sport' : 'Activate sport' }}
                    </button>
                  </article>
                </div>
                <p
                  v-if="sports && !sports.length && !loading"
                  class="panel empty-message"
                >
                  No sports yet. Run the existing database seed to populate the
                  catalog.
                </p>
              </template>

              <template v-if="section === 'audit'">
                <section class="panel audit-panel">
                  <div class="panel-heading">
                    <h2>
                      Admin activity
                      <span class="count">{{ number(audit?.total ?? 0) }}</span>
                    </h2>
                    <span class="muted">Most recent first</span>
                  </div>
                  <article
                    v-for="entry in audit?.items"
                    :key="entry.id"
                    class="audit-entry"
                  >
                    <span class="audit-icon"
                      ><ion-icon
                        :icon="shieldCheckmarkOutline"
                        aria-hidden="true"
                    /></span>
                    <div>
                      <h3>{{ humanize(entry.action) }}</h3>
                      <p>
                        @{{ entry.actor.username }}
                        <span>· {{ dateTime(entry.createdAt) }}</span>
                      </p>
                      <code>{{ entry.targetId }}</code>
                      <details>
                        <summary>View changes</summary>
                        <pre>{{ JSON.stringify(entry.details, null, 2) }}</pre>
                      </details>
                    </div>
                  </article>
                  <p
                    v-if="audit && !audit.items.length && !loading"
                    class="empty-message"
                  >
                    Admin changes will appear here.
                  </p>
                </section>
              </template>

              <div v-if="pagination" class="pagination">
                <span
                  >{{
                    pagination.total ? (page - 1) * pagination.pageSize + 1 : 0
                  }}–{{
                    Math.min(page * pagination.pageSize, pagination.total)
                  }}
                  of {{ number(pagination.total) }}</span
                >
                <div>
                  <button
                    class="button secondary"
                    :disabled="page <= 1 || loading"
                    @click="page--"
                  >
                    Previous</button
                  ><span>Page {{ page }}</span
                  ><button
                    class="button secondary"
                    :disabled="
                      page * pagination.pageSize >= pagination.total || loading
                    "
                    @click="page++"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
            <footer class="page-footer">
              <span>GORA Control Center</span
              ><span>Build a better sports community.</span>
            </footer>
          </div>
        </main>
      </div>
      <dialog
        ref="dialogEl"
        class="admin-dialog"
        aria-labelledby="admin-action-title"
        aria-describedby="admin-action-description"
        @cancel="onDialogCancel"
        @close="dialog = null"
      >
        <form v-if="dialog" @submit.prevent="submitDialog">
          <p class="eyebrow">SUPER ADMIN ACTION</p>
          <h2 id="admin-action-title">{{ dialog.title }}</h2>
          <p id="admin-action-description">{{ dialog.description }}</p>
          <template v-if="dialog.user"
            ><label
              >Role<select
                v-model="editRole"
                :disabled="dialog.user.id === auth.currentUser?.id || busy"
              >
                <option value="USER">User</option>
                <option value="ADMIN">Admin</option>
                <option value="SUPER_ADMIN">Super admin</option>
              </select></label
            ><label
              >Account status<select
                v-model="editActive"
                :disabled="dialog.user.id === auth.currentUser?.id || busy"
              >
                <option :value="true">Active</option>
                <option :value="false">Suspended</option>
              </select></label
            >
            <p v-if="dialog.user.id === auth.currentUser?.id" class="muted">
              Your own super admin access is protected.
            </p>
            <p v-else-if="editRole === 'SUPER_ADMIN'" class="info-line">
              This grants full control of GORA, including other accounts and
              reports.
            </p></template
          >
          <p v-if="dialogError" class="error" role="alert">{{ dialogError }}</p>
          <div class="dialog-actions">
            <button
              type="button"
              class="button secondary"
              :disabled="busy"
              @click="dialogEl?.close()"
            >
              Cancel</button
            ><button
              class="button primary"
              :disabled="busy || dialog.user?.id === auth.currentUser?.id"
            >
              {{ busy ? 'Saving…' : dialog.user ? 'Save changes' : 'Confirm' }}
            </button>
          </div>
        </form>
      </dialog>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  IonContent,
  IonIcon,
  IonPage,
  onIonViewWillEnter,
  onIonViewWillLeave,
} from '@ionic/vue';
import {
  logOutOutline,
  arrowForwardOutline,
  barChartOutline,
  checkmarkCircleOutline,
  chevronForwardOutline,
  flagOutline,
  footballOutline,
  informationCircleOutline,
  peopleOutline,
  refreshOutline,
  searchOutline,
  shieldCheckmarkOutline,
  timeOutline,
} from 'ionicons/icons';
import { ApiError } from '@/services/api-client';
import {
  adminApi,
  type AdminAudit,
  type AdminOverview,
  type AdminPage,
  type AdminReport,
  type AdminSport,
  type AdminUser,
  type ReportStatus,
} from '@/services/admin.service';
import { useAuthStore } from '@/stores/auth';
import type { UserRole } from '@/types/auth';

const sections = [
  {
    id: 'overview',
    label: 'Overview',
    title: 'Platform overview',
    description: 'A clear view of your community, activity, and moderation.',
    icon: barChartOutline,
  },
  {
    id: 'users',
    label: 'Users',
    title: 'People power the game.',
    description:
      'Find accounts, manage access, and keep your community healthy.',
    icon: peopleOutline,
  },
  {
    id: 'reports',
    label: 'Reports',
    title: 'Keep the community safe.',
    description: 'Review reported activity and record moderation decisions.',
    icon: flagOutline,
  },
  {
    id: 'sports',
    label: 'Sports',
    title: 'Every sport. One community.',
    description: 'Manage the sports available across GORA.',
    icon: footballOutline,
  },
  {
    id: 'audit',
    label: 'Audit log',
    title: 'Every change, accounted for.',
    description: 'A record of administrator actions across the platform.',
    icon: timeOutline,
  },
] as const;
type Section = (typeof sections)[number]['id'];
const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const isLoggingOut = ref(false);
const section = computed<Section>(
  () => sections.find((s) => s.id === route.query.section)?.id ?? 'overview',
);
const currentSection = computed(() =>
  sections.find((s) => s.id === section.value)!,
);
const overview = ref<AdminOverview | null>(null);
const users = ref<AdminPage<AdminUser> | null>(null);
const reports = ref<AdminPage<AdminReport> | null>(null);
const sports = ref<AdminSport[] | null>(null);
const audit = ref<AdminPage<AdminAudit> | null>(null);
const page = ref(1);
const search = ref('');
const roleFilter = ref('');
const userStatus = ref('');
const reportStatus = ref('PENDING');
const loading = ref(false);
const busy = ref(false);
const error = ref('');
const notice = ref('');
const accessDenied = ref(false);
let generation = 0;
const reportStatuses: ReportStatus[] = [
  'PENDING',
  'REVIEWING',
  'RESOLVED',
  'DISMISSED',
];
const pagination = computed(() =>
  section.value === 'users'
    ? users.value
    : section.value === 'reports'
      ? reports.value
      : section.value === 'audit'
        ? audit.value
        : null,
);
const stats = computed(() =>
  !overview.value
    ? []
    : [
        {
          label: 'Total athletes',
          value: overview.value.users,
          note: `${number(overview.value.activeUsers)} active accounts`,
          icon: peopleOutline,
        },
        {
          label: 'Games created',
          value: overview.value.games,
          note: 'Across all sports',
          icon: footballOutline,
        },
        {
          label: 'Community clubs',
          value: overview.value.clubs,
          note: 'Places to connect and play',
          icon: shieldCheckmarkOutline,
        },
        {
          label: 'Pending reports',
          value: overview.value.pendingReports,
          note: `${number(overview.value.reviewingReports)} currently in review`,
          icon: flagOutline,
        },
      ],
);
const platformStats = computed(() =>
  !overview.value
    ? []
    : [
        { label: 'Posts', value: overview.value.posts },
        { label: 'Reels', value: overview.value.reels },
        {
          label: 'Suspended accounts',
          value: overview.value.users - overview.value.activeUsers,
        },
      ],
);
const registrationTotal = computed(
  () =>
    overview.value?.dailyRegistrations.reduce((sum, d) => sum + d.total, 0) ??
    0,
);
const chartMax = computed(() =>
  Math.max(
    1,
    ...(overview.value?.dailyRegistrations.map((d) => d.total) ?? []),
  ),
);
const chartLabel = computed(
  () =>
    `Daily registrations (UTC): ${overview.value?.dailyRegistrations.map((d) => `${d.day}: ${d.total}`).join(', ')}`,
);
const number = (value: number) => new Intl.NumberFormat('en').format(value);
const humanize = (value: string) =>
  value
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
const date = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
const dateTime = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
const dayLabel = (value: string) =>
  new Date(`${value}T12:00:00Z`).toLocaleDateString('en', {
    weekday: 'short',
    timeZone: 'UTC',
  });

function reportTarget(report: AdminReport) {
  for (const [key, label] of [
    ['messageId', 'Reported message'],
    ['postCommentId', 'Post comment'],
    ['reelCommentId', 'Reel comment'],
    ['postId', 'Reported post'],
    ['reelId', 'Reported reel'],
    ['gameId', 'Reported game'],
    ['storyId', 'Reported story'],
    ['clubId', 'Reported club'],
  ] as const) {
    if (report[key]) return { label, id: report[key] };
  }
  return {
    label: 'Reported account',
    id: report.reportedUser?.id ?? report.id,
  };
}
function reportPreview(report: AdminReport) {
  if (report.message?.deletedAt) return 'This message has been unsent.';
  return (
    report.message?.content ||
    report.postComment?.content ||
    report.reelComment?.content ||
    report.post?.caption ||
    report.reel?.caption ||
    report.game?.title ||
    report.club?.name ||
    ''
  );
}
const reportAction = (status: ReportStatus) =>
  ({
    PENDING: 'Return to pending',
    REVIEWING: 'Start review',
    RESOLVED: 'Resolve',
    DISMISSED: 'Dismiss',
  })[status];

async function navigate(id: Section) {
  await router.replace({
    path: '/admin',
    query: id === 'overview' ? {} : { section: id },
  });
}
async function logOut() {
  if (isLoggingOut.value || busy.value) return;
  isLoggingOut.value = true;
  try {
    await auth.logout();
    await router.replace('/login');
  } finally {
    isLoggingOut.value = false;
  }
}
function applyFilters() {
  if (page.value !== 1) page.value = 1;
  else void load();
}
function clearData() {
  overview.value = null;
  users.value = null;
  reports.value = null;
  sports.value = null;
  audit.value = null;
}
async function load() {
  const token = auth.accessToken;
  if (!token || auth.currentUser?.role !== 'SUPER_ADMIN') {
    generation++;
    loading.value = false;
    clearData();
    accessDenied.value = true;
    return;
  }
  const request = ++generation;
  loading.value = true;
  error.value = '';
  accessDenied.value = false;
  const selected = section.value;
  const params = new URLSearchParams({ page: String(page.value) });
  if (selected === 'users') {
    if (search.value.trim()) params.set('search', search.value.trim());
    if (roleFilter.value) params.set('role', roleFilter.value);
    if (userStatus.value) params.set('status', userStatus.value);
  }
  if (selected === 'reports' && reportStatus.value)
    params.set('status', reportStatus.value);
  try {
    const [summary, result] = await Promise.all([
      adminApi.overview(token),
      selected === 'users'
        ? adminApi.users(token, params)
        : selected === 'reports'
          ? adminApi.reports(token, params)
          : selected === 'sports'
            ? adminApi.sports(token)
            : selected === 'audit'
              ? adminApi.audit(token, page.value)
              : Promise.resolve(null),
    ]);
    if (request !== generation || token !== auth.accessToken) return;
    if (result && !Array.isArray(result)) {
      const lastPage = Math.max(1, Math.ceil(result.total / result.pageSize));
      if (page.value > lastPage) {
        page.value = lastPage;
        return;
      }
    }
    overview.value = summary;
    if (selected === 'users') users.value = result as AdminPage<AdminUser>;
    if (selected === 'reports')
      reports.value = result as AdminPage<AdminReport>;
    if (selected === 'sports') sports.value = result as AdminSport[];
    if (selected === 'audit') audit.value = result as AdminPage<AdminAudit>;
  } catch (cause) {
    if (request !== generation || token !== auth.accessToken) return;
    clearData();
    error.value =
      cause instanceof Error ? cause.message : 'Unable to load the dashboard.';
    if (cause instanceof ApiError && [401, 403].includes(cause.status)) {
      accessDenied.value = true;
      void auth.loadCurrentUser().catch(() => undefined);
    }
  } finally {
    if (request === generation) loading.value = false;
  }
}
watch(section, () => {
  page.value = 1;
  notice.value = '';
  void load();
});
watch(page, () => {
  void load();
});
watch(
  () => auth.sessionVersion,
  () => {
    generation++;
    loading.value = false;
    clearData();
    dialogEl.value?.close();
  },
);
onIonViewWillEnter(() => {
  void load();
});
onIonViewWillLeave(() => {
  generation++;
  loading.value = false;
  clearData();
  dialogEl.value?.close();
});

interface ActionDialog {
  title: string;
  description: string;
  user?: AdminUser;
  run?: (token: string) => Promise<unknown>;
}
const dialogEl = ref<HTMLDialogElement | null>(null);
const dialog = ref<ActionDialog | null>(null);
const dialogError = ref('');
const editRole = ref<UserRole>('USER');
const editActive = ref(true);
async function openDialog(value: ActionDialog) {
  dialog.value = value;
  dialogError.value = '';
  await nextTick();
  dialogEl.value?.showModal();
}
function editUser(user: AdminUser) {
  editRole.value = user.role;
  editActive.value = user.isActive;
  void openDialog({
    title: `Manage @${user.username}`,
    description:
      'Changes take effect on the next API request and are recorded in the audit log.',
    user,
  });
}
function confirmReport(report: AdminReport, status: ReportStatus) {
  void openDialog({
    title: `${reportAction(status)}?`,
    description: `Update this report from ${humanize(report.status)} to ${humanize(status)}. This records a review decision; it does not delete content.`,
    run: (token) =>
      adminApi.updateReport(token, report.id, status, report.status),
  });
}
function confirmSport(sport: AdminSport) {
  void openDialog({
    title: `${sport.isActive ? 'Retire' : 'Activate'} ${sport.name}?`,
    description: sport.isActive
      ? 'This sport will no longer be available for new selections. Existing records are preserved.'
      : 'This sport will become available for new selections across GORA.',
    run: (token) => adminApi.updateSport(token, sport.id, !sport.isActive),
  });
}
function onDialogCancel(event: Event) {
  if (busy.value) event.preventDefault();
}
async function submitDialog() {
  const action = dialog.value;
  const token = auth.accessToken;
  if (!action || !token || busy.value) return;
  busy.value = true;
  dialogError.value = '';
  try {
    if (action.user)
      await adminApi.updateUser(token, action.user.id, {
        role: editRole.value,
        isActive: editActive.value,
      });
    else await action.run?.(token);
    if (token !== auth.accessToken) return;
    dialogEl.value?.close();
    notice.value = 'Changes saved. The audit log has been updated.';
    await load();
  } catch (cause) {
    dialogError.value =
      cause instanceof Error ? cause.message : 'Unable to save changes.';
    if (cause instanceof ApiError && [401, 403].includes(cause.status)) {
      dialogEl.value?.close();
      await load();
    }
  } finally {
    busy.value = false;
  }
}
</script>

<style scoped>
ion-content {
  --padding-start: 0;
  --padding-end: 0;
}
.admin-shell {
  --admin-bg: #111315;
  --admin-panel: #191c1f;
  --admin-border: #2b2e32;
  --admin-muted: #929aa5;
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  min-height: 100%;
  background: var(--admin-bg);
  color: #f3f4f5;
  font-size: 14px;
}
.sidebar {
  display: flex;
  flex-direction: column;
  padding: 34px 20px 24px;
  border-right: 1px solid var(--admin-border);
  background: #151719;
}
.brand {
  color: #ff642e;
  font-family: 'Gora Condensed', sans-serif;
  font-weight: 800;
  font-style: italic;
  font-size: 45px;
  letter-spacing: -2px;
  text-decoration: none;
  line-height: 1;
  padding-left: 14px;
}
.brand span {
  display: block;
  color: #a3a9b1;
  font:
    600 9px 'Segoe UI',
    sans-serif;
  letter-spacing: 2.5px;
  margin-top: 10px;
}
.workspace-label {
  color: #737d89;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1.8px;
  margin: 48px 14px 14px;
}
nav {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
nav button {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #a6aeb9;
  padding: 14px;
  background: transparent;
  text-align: left;
  border: 1px solid transparent;
  border-radius: 8px;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
nav button.selected {
  color: #ff8257;
  background: #ff642e14;
  border-color: #ff642e28;
}
nav button:hover {
  background: #ffffff08;
}
ion-icon {
  font-size: 19px;
  flex-shrink: 0;
}
.nav-count {
  font-size: 11px;
  background: #ff642e25;
  color: #ff8257;
  border-radius: 5px;
  padding: 2px 6px;
  margin-left: auto;
}
.sidebar-footer {
  margin-top: auto;
  padding: 70px 10px 0;
}
.admin-identity {
  display: flex;
  align-items: center;
  gap: 9px;
  padding-bottom: 24px;
  margin-bottom: 22px;
  border-bottom: 1px solid var(--admin-border);
}
.admin-identity strong {
  font-size: 12px;
  overflow-wrap: anywhere;
}
.admin-identity small {
  display: block;
  color: var(--admin-muted);
  font-size: 10px;
  margin-top: 5px;
}
.logout-button {
  display: flex;
  gap: 10px;
  align-items: center;
  color: #a6aeb9;
  text-decoration: none;
  font-size: 12px;
  background: transparent;
  border: 0;
  padding: 4px 0;
  cursor: pointer;
}
.topbar-account {
  display: flex;
  align-items: center;
  gap: 14px;
}
.mobile-logout {
  display: none;
}
.initials {
  display: inline-flex;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  align-items: center;
  justify-content: center;
  background: #34302d;
  color: #ffb399;
  font-weight: 700;
  flex-shrink: 0;
  font-size: 12px;
}
.main {
  min-width: 0;
}
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 76px;
  padding: 18px 40px;
  border-bottom: 1px solid var(--admin-border);
  font-size: 12px;
  color: var(--admin-muted);
}
.breadcrumb {
  color: #e6e7e9;
  margin-left: 10px;
}
.access-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 9px;
  letter-spacing: 1.2px;
  font-weight: 700;
  border: 1px solid #ff642e38;
  color: #ff956f;
  padding: 8px 10px;
  border-radius: 5px;
}
.access-badge ion-icon {
  font-size: 14px;
}
.page-content {
  padding: 36px 40px 20px;
  max-width: 1530px;
  margin: auto;
}
.page-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 30px;
}
.eyebrow {
  color: #fc8359;
  font-size: 9px;
  letter-spacing: 2px;
  font-weight: 700;
  margin: 0 0 12px;
}
h1 {
  font-size: clamp(25px, 2.5vw, 34px);
  font-weight: 700;
  letter-spacing: -1px;
  margin: 0 0 10px;
}
.page-heading p:not(.eyebrow),
.panel-heading p,
.platform p {
  color: var(--admin-muted);
  font-size: 12px;
  line-height: 1.6;
  margin: 0;
}
h2 {
  font-size: 15px;
  font-weight: 650;
  margin: 0 0 8px;
}
.button {
  display: inline-flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 10px 15px;
  min-height: 38px;
  font: inherit;
  font-size: 12px;
  font-weight: 650;
  cursor: pointer;
  text-decoration: none;
  white-space: nowrap;
}
.button ion-icon {
  font-size: 15px;
}
.secondary {
  background: #202327;
  border-color: #35393f;
  color: #dfe3e8;
}
.secondary:hover {
  background: #2a2e33;
}
.primary {
  background: #ff642e;
  color: #171412;
}
.primary:hover {
  background: #ff8257;
}
button:disabled {
  opacity: 0.45;
  cursor: default;
}
.full {
  width: 100%;
}
.stat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}
.stat-card,
.panel {
  background: var(--admin-panel);
  border: 1px solid var(--admin-border);
  border-radius: 10px;
}
.stat-card {
  padding: 21px;
}
.stat-card > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: #b0b6bf;
  font-size: 11px;
}
.stat-card ion-icon {
  color: #9aa2ac;
  font-size: 18px;
}
.stat-card > strong {
  display: block;
  font-size: 33px;
  letter-spacing: -1px;
  line-height: 1.4;
  margin-top: 12px;
}
.stat-card small {
  color: var(--admin-muted);
  font-size: 10px;
  display: block;
  margin-top: 6px;
}
.overview-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 290px;
  gap: 24px;
}
.growth {
  padding: 25px;
}
.panel-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}
.panel-heading h2 {
  margin-bottom: 4px;
}
.period {
  color: #9ea6b1;
  border: 1px solid var(--admin-border);
  border-radius: 5px;
  padding: 6px 8px;
  font-size: 9px;
  letter-spacing: 1px;
}
.growth-total {
  display: flex;
  gap: 10px;
  align-items: baseline;
  margin-top: 20px;
}
.growth-total strong {
  font-size: 30px;
  letter-spacing: -1px;
}
.growth-total span {
  color: var(--admin-muted);
  font-size: 11px;
}
.bar-chart {
  display: flex;
  gap: 20px;
  height: 185px;
  padding-top: 16px;
  margin-top: 8px;
}
.bar-column {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  min-width: 0;
}
.bar-value {
  font-size: 10px;
  color: #b8c0c9;
  margin-bottom: 6px;
}
.bar-track {
  display: flex;
  align-items: flex-end;
  height: 125px;
  width: 100%;
  max-width: 42px;
  border-bottom: 1px solid #48413a;
  background: repeating-linear-gradient(
    to top,
    transparent,
    transparent 40px,
    #ffffff06 40px,
    #ffffff06 41px
  );
}
.bar {
  width: 100%;
  background: linear-gradient(0deg, #ff642e99, #ff8c61);
  border-radius: 4px 4px 0 0;
}
.bar-label {
  font-size: 10px;
  color: #949da9;
  margin-top: 12px;
}
.moderation {
  padding: 23px;
}
.panel-icon,
.audit-icon {
  width: 34px;
  height: 34px;
  background: #ff642e18;
  color: #ff8b62;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.moderation h2 {
  margin-top: 14px;
}
.queue-total {
  display: block;
  font-size: 44px;
  line-height: 1.2;
  letter-spacing: -1px;
  margin-top: 12px;
}
.moderation > p {
  color: var(--admin-muted);
  font-size: 11px;
  margin: 8px 0 23px;
}
.queue-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 14px 0;
  font-size: 11px;
}
.queue-line > span {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #a9b0ba;
}
.moderation .button {
  margin-top: 10px;
  justify-content: space-between;
}
.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  display: inline-block;
  flex-shrink: 0;
}
.orange {
  color: #ff8c61;
}
.blue {
  color: #8fafff;
}
.green {
  color: #7dd4ae;
}
.red {
  color: #ff9292;
}
.platform {
  display: grid;
  grid-template-columns: 1.6fr 1fr 1fr 1fr;
  align-items: center;
  gap: 20px;
  padding: 25px;
  margin-top: 24px;
}
.platform > div:not(:first-child) {
  padding-left: 24px;
  border-left: 1px solid var(--admin-border);
}
.platform strong {
  font-size: 25px;
  display: block;
}
.platform span {
  color: #949da9;
  font-size: 11px;
  display: block;
  margin-top: 6px;
}
.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
}
input,
select {
  background: #1b1e22;
  color: #f0f2f5;
  border: 1px solid #35393f;
  border-radius: 6px;
  min-height: 40px;
  padding: 9px 12px;
  font: inherit;
  font-size: 12px;
  max-width: 100%;
}
.search-field {
  display: flex;
  align-items: center;
  background: #1b1e22;
  border: 1px solid #35393f;
  border-radius: 6px;
  padding-left: 12px;
  flex: 1;
  min-width: 220px;
  color: #949da9;
}
.search-field input {
  width: 100%;
  border: 0;
  background: transparent;
}
.filter-label {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #b8c0c9;
  font-size: 12px;
}
.filter-note {
  flex: 1;
  min-width: 220px;
  line-height: 1.6;
  margin-left: 10px;
}
.table-panel {
  overflow: hidden;
}
.table-panel .panel-heading,
.audit-panel .panel-heading {
  padding: 20px 24px;
  border-bottom: 1px solid var(--admin-border);
}
.count {
  font-size: 10px;
  font-weight: 500;
  margin-left: 5px;
  background: #ffffff0b;
  color: #aeb5bf;
  border-radius: 5px;
  padding: 3px 7px;
}
.table-scroll {
  overflow-x: auto;
}
table {
  border-collapse: collapse;
  width: 100%;
  text-align: left;
}
th {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.9px;
  color: #909aa6;
  padding: 14px 24px;
  background: #ffffff02;
}
td {
  padding: 17px 24px;
  border-top: 1px solid #ffffff07;
  font-size: 12px;
}
.user-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}
.user-cell strong {
  display: block;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}
.user-cell span:not(.initials) {
  display: block;
  color: #969fab;
  font-size: 10px;
  margin-top: 6px;
  white-space: nowrap;
}
.user-cell small {
  color: #ff9a77;
  font-size: 10px;
}
.badge {
  display: inline-flex;
  align-items: center;
  padding: 5px 8px;
  border: 1px solid #444b53;
  color: #b8c1ce;
  border-radius: 5px;
  font-size: 9px;
  white-space: nowrap;
}
.badge.accent {
  color: #ffa17e;
  border-color: #ff642e36;
  background: #ff642e0c;
}
.status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  white-space: nowrap;
}
.text-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #ff9a77;
  background: transparent;
  padding: 8px 0;
  font-size: 11px;
  cursor: pointer;
}
.text-button ion-icon {
  font-size: 12px;
}
.muted {
  color: #a0a9b5;
  font-size: 11px;
}
.nowrap {
  white-space: nowrap;
}
.report-list {
  display: grid;
  gap: 16px;
}
.report-card {
  padding: 24px;
}
.report-header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  margin-bottom: 18px;
}
.report-card h2 {
  font-size: 18px;
}
.report-meta {
  font-size: 11px;
  color: #98a3b0;
  line-height: 1.8;
}
.report-meta strong {
  color: #cbd2db;
  font-weight: 500;
}
.report-description {
  color: #d5d9df;
  font-size: 13px;
  line-height: 1.7;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.report-evidence {
  background: #111315;
  border: 1px solid var(--admin-border);
  border-radius: 6px;
  padding: 14px;
  margin: 16px 0;
}
.report-evidence > span {
  display: block;
  font-size: 10px;
  color: #a0a9b5;
  margin-bottom: 6px;
}
code {
  font-family: Consolas, monospace;
  color: #b7bfc9;
  font-size: 10px;
  overflow-wrap: anywhere;
}
.report-evidence p {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  max-height: 200px;
  overflow: auto;
  color: #d7dde6;
  font-size: 13px;
  line-height: 1.6;
}
.report-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 20px;
}
.info-line {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid #343d49;
  background: #1a222c;
  color: #bac7d9;
  border-radius: 6px;
  padding: 10px 14px;
  font-size: 12px;
  line-height: 1.6;
  margin-bottom: 20px;
}
.info-line p {
  margin: 0;
}
.sports-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
}
.sport-card {
  padding: 22px;
}
.sport-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 18px;
}
.sport-symbol {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: #ff642e14;
  border-radius: 10px;
  color: #ffa17e;
  font-size: 12px;
  font-weight: 700;
}
.sport-card > p {
  color: #a0a9b5;
  font-size: 12px;
  min-height: 40px;
  line-height: 1.7;
}
.sport-counts {
  display: flex;
  gap: 22px;
  padding: 14px 0 20px;
  font-size: 11px;
  color: #949da9;
}
.sport-counts strong {
  color: #e0e5eb;
  margin-right: 3px;
}
.audit-entry {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 22px 24px;
  border-bottom: 1px solid var(--admin-border);
}
.audit-entry:last-child {
  border-bottom: 0;
}
.audit-entry h3 {
  font-size: 13px;
  margin: 0;
}
.audit-entry p {
  font-size: 11px;
  color: #c4cbd4;
  margin: 8px 0;
}
.audit-entry p span {
  color: #929dab;
}
.audit-icon {
  flex-shrink: 0;
  width: 30px;
  height: 30px;
}
.audit-icon ion-icon {
  font-size: 15px;
}
.audit-entry details {
  color: #aab5c3;
  font-size: 11px;
  margin-top: 12px;
}
summary {
  cursor: pointer;
}
pre {
  background: #111315;
  padding: 12px;
  border-radius: 6px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.7;
  font-size: 11px;
}
.pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-top: 20px;
  font-size: 11px;
  color: #a0a9b5;
}
.pagination > div {
  display: flex;
  align-items: center;
  gap: 12px;
}
.pagination .button {
  font-size: 11px;
  min-height: 33px;
  padding: 7px 12px;
}
.empty {
  padding: 50px 24px;
  text-align: center;
  color: #a0a9b5;
}
.empty > ion-icon {
  color: #ff976f;
  font-size: 32px;
  margin-bottom: 16px;
}
.empty p {
  font-size: 12px;
  line-height: 1.6;
}
.empty h2 {
  color: #eef1f5;
}
.empty-message {
  padding: 35px 24px;
  text-align: center;
  color: #a0a9b5;
  font-size: 12px;
}
.loading {
  color: #b3becb;
  font-size: 12px;
  padding: 12px 0;
}
.notice,
.error {
  border-radius: 6px;
  padding: 13px 16px;
  font-size: 12px;
  line-height: 1.7;
  margin-bottom: 20px;
}
.notice {
  color: #ace2ca;
  background: #4fbe8c15;
  border: 1px solid #4fbe8c40;
}
.error {
  color: #ffbbbb;
  background: #ee5d5d15;
  border: 1px solid #ee5d5d40;
}
.error button {
  background: transparent;
  color: inherit;
  text-decoration: underline;
  cursor: pointer;
}
.page-footer {
  display: flex;
  justify-content: space-between;
  gap: 15px;
  border-top: 1px solid #ffffff09;
  padding-top: 20px;
  margin-top: 38px;
  color: #7f8995;
  font-size: 10px;
}
.admin-dialog {
  color: #f3f4f5;
  background: #191c1f;
  border: 1px solid #444b53;
  border-radius: 12px;
  padding: 28px;
  width: min(460px, calc(100vw - 32px));
  max-height: calc(100dvh - 48px);
  overflow: auto;
}
.admin-dialog::backdrop {
  background: #000a;
  backdrop-filter: blur(3px);
}
.admin-dialog h2 {
  font-size: 22px;
  margin-bottom: 14px;
}
.admin-dialog p:not(.eyebrow) {
  color: #aeb8c4;
  font-size: 12px;
  line-height: 1.8;
}
.admin-dialog label {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 20px 0;
  font-size: 12px;
  color: #d5dae1;
}
.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 26px;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
@media (min-width: 1100px) {
  .sidebar {
    position: sticky;
    top: 0;
    height: 100dvh;
    align-self: start;
  }
}
@media (max-width: 1200px) {
  .admin-shell {
    grid-template-columns: 210px minmax(0, 1fr);
  }
  .page-content {
    padding: 28px 24px 20px;
  }
  .topbar {
    padding: 18px 24px;
  }
  .stat-grid {
    gap: 12px;
  }
  .stat-card {
    padding: 16px;
  }
  .overview-grid {
    grid-template-columns: minmax(0, 1fr) 260px;
    gap: 18px;
  }
  .sports-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (max-width: 900px) {
  .mobile-logout {
    display: inline-flex;
  }
  .admin-shell {
    display: block;
  }
  .sidebar {
    padding: 20px 24px 12px;
    border-right: 0;
    border-bottom: 1px solid var(--admin-border);
  }
  .brand {
    padding-left: 0;
    font-size: 35px;
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .brand span {
    margin-top: 2px;
    font-size: 8px;
  }
  .workspace-label,
  .sidebar-footer {
    display: none;
  }
  nav {
    flex-direction: row;
    overflow-x: auto;
    margin-top: 22px;
    gap: 6px;
  }
  nav button {
    padding: 10px 14px;
    font-size: 12px;
    white-space: nowrap;
    gap: 7px;
  }
  nav ion-icon {
    font-size: 16px;
  }
  .stat-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .topbar {
    min-height: 58px;
  }
  .overview-grid {
    grid-template-columns: minmax(0, 1fr) 260px;
  }
  .platform {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .platform > div:first-child {
    grid-column: 1/-1;
  }
  .platform > div:nth-child(2) {
    padding-left: 0;
    border-left: 0;
  }
}
@media (max-width: 620px) {
  .sidebar {
    padding: max(20px, env(safe-area-inset-top)) 16px 10px;
  }
  .page-content {
    padding: 26px 16px 20px;
  }
  .topbar {
    padding: 12px 16px;
    font-size: 10px;
  }
  .access-badge {
    font-size: 8px;
    padding: 6px;
    letter-spacing: 0.6px;
  }
  .breadcrumb {
    margin-left: 5px;
  }
  .page-heading {
    align-items: flex-start;
    gap: 10px;
    margin-bottom: 24px;
  }
  .page-heading > .button {
    font-size: 0;
    padding: 10px;
  }
  .page-heading > .button ion-icon {
    font-size: 17px;
  }
  .page-heading p:not(.eyebrow) {
    font-size: 11px;
  }
  .stat-card > strong {
    font-size: 30px;
  }
  .stat-card {
    padding: 16px 14px;
  }
  .stat-card > div {
    font-size: 10px;
  }
  .stat-card small {
    font-size: 9px;
  }
  .overview-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .growth {
    padding: 20px;
  }
  .bar-chart {
    gap: 14px;
  }
  .moderation {
    padding: 20px;
  }
  .platform {
    padding: 20px;
    gap: 16px;
  }
  .platform > div:not(:first-child) {
    padding-left: 14px;
  }
  .platform > div:nth-child(2) {
    padding-left: 0;
  }
  .platform strong {
    font-size: 22px;
  }
  .platform span {
    font-size: 9px;
    line-height: 1.6;
  }
  .sports-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .table-panel .panel-heading,
  .audit-panel .panel-heading {
    padding: 18px;
  }
  td,
  th {
    padding-left: 18px;
    padding-right: 18px;
  }
  .report-card {
    padding: 20px;
  }
  .report-actions {
    gap: 7px;
  }
  .report-actions .button {
    padding: 9px 10px;
    font-size: 10px;
  }
  .filter-note {
    margin: 0;
  }
  .pagination {
    flex-wrap: wrap;
  }
  .page-footer {
    font-size: 9px;
    padding-bottom: env(safe-area-inset-bottom);
  }
  .audit-entry {
    padding: 20px 18px;
  }
}
</style>
