import { createPinia, setActivePinia } from "pinia";
import { flushPromises } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { useAuthStore } from "@/stores/auth";
import { useNotificationsStore } from "@/stores/notifications";
import type { AppNotification } from "@/types/notification";

const notification = (id = "n-1", read = false): AppNotification => ({
  id,
  read,
  type: "NEW_FOLLOWER",
  actor: null,
  title: "New follower",
  body: "A player followed you.",
  createdAt: "2026-10-25T00:00:00.000Z",
  link: "/profile/followers",
});
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const page = (
  items = [notification()],
  unreadCount = 1,
  hasMore = false,
  nextOffset = items.length,
) => ({ items, unreadCount, hasMore, nextOffset });
function signIn(id = "user-1") {
  const auth = useAuthStore();
  auth.accessToken = "token-" + id;
  auth.currentUser = {
    id,
    username: id,
    email: id + "@example.test",
    firstName: "Test",
    lastName: "Player",
    role: "USER",
    profileImageUrl: null,
    bio: null,
    city: null,
  };
  return auth;
}
beforeEach(() => {
  setActivePinia(createPinia());
  signIn();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("real notification API store", () => {
  test("deduplicates header requests and uses the server unread count beyond the loaded page", async () => {
    const fetcher = vi.fn().mockResolvedValue(json(page([notification()], 83)));
    vi.stubGlobal("fetch", fetcher);
    const store = useNotificationsStore();
    await Promise.all([store.load(), store.load()]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toContain(
      "/api/v1/notifications?limit=40&offset=0",
    );
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe(
      "Bearer token-user-1",
    );
    expect(store.items).toHaveLength(1);
    expect(store.unreadCount).toBe(83);
  });
  test("persists reads through PATCH, while a failed write keeps the item unread", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(json(page()))
      .mockResolvedValueOnce(json({ message: "Try again" }, 500))
      .mockResolvedValueOnce(json({ id: "n-1", read: true, unreadCount: 0 }));
    vi.stubGlobal("fetch", fetcher);
    const store = useNotificationsStore();
    await store.load();
    expect(await store.markRead("n-1")).toBe(false);
    expect(store.items[0].read).toBe(false);
    expect(store.unreadCount).toBe(1);
    expect(store.error).toBeTruthy();
    expect(await store.markRead("n-1")).toBe(true);
    expect(fetcher.mock.calls[2][0]).toContain("/notifications/n-1/read");
    expect(fetcher.mock.calls[2][1].method).toBe("PATCH");
    expect(store.items[0].read).toBe(true);
    expect(store.unreadCount).toBe(0);
  });
  test("marks all on the server including unloaded notifications with one write", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(json(page([notification()], 83)))
      .mockResolvedValueOnce(json({ updated: 83, unreadCount: 0 }));
    vi.stubGlobal("fetch", fetcher);
    const store = useNotificationsStore();
    await store.load();
    expect(await store.markAllRead()).toBe(true);
    expect(fetcher.mock.calls[1][0]).toContain("/notifications/read-all");
    expect(fetcher.mock.calls[1][1].method).toBe("PATCH");
    expect(store.unreadCount).toBe(0);
    expect(store.items[0].read).toBe(true);
  });
  test("loads later pages and deduplicates rows when new activity shifts the page boundary", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(json(page([notification()], 2, true, 40)))
      .mockResolvedValueOnce(
        json(page([notification(), notification("n-2")], 2, false, 42)),
      );
    vi.stubGlobal("fetch", fetcher);
    const store = useNotificationsStore();
    await store.load();
    await store.loadMore();
    expect(fetcher.mock.calls[1][0]).toContain("offset=40");
    expect(store.items.map((item) => item.id)).toEqual(["n-1", "n-2"]);
    expect(store.hasMore).toBe(false);
  });
  test("handles network errors and retries without inventing a badge count", async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(json(page()));
    vi.stubGlobal("fetch", fetcher);
    const store = useNotificationsStore();
    expect(await store.load()).toBe(false);
    expect(store.isLoaded).toBe(false);
    expect(store.unreadCount).toBe(0);
    expect(store.error).toContain("Can't reach GORA");
    expect(await store.load(true)).toBe(true);
    expect(store.error).toBeNull();
  });
  test("clears the badge on logout and ignores an older account response", async () => {
    let resolve!: (response: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise<Response>((done) => {
              resolve = done;
            }),
        )
        .mockResolvedValue(json(page([], 0))),
    );
    const store = useNotificationsStore();
    const first = store.load();
    signIn("user-2");
    resolve(json(page()));
    await first;
    expect(store.items).toEqual([]);
    expect(store.unreadCount).toBe(0);
    await store.load();
    await useAuthStore().logout();
    expect(store.items).toEqual([]);
    expect(store.isLoaded).toBe(false);
  });
  test("an older poll cannot restore unread state after mark-as-read succeeds", async () => {
    let resolve!: (response: Response) => void;
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(json(page()))
      .mockImplementationOnce(
        () =>
          new Promise<Response>((done) => {
            resolve = done;
          }),
      )
      .mockResolvedValueOnce(json({ id: "n-1", read: true, unreadCount: 0 }))
      .mockResolvedValue(json(page([notification("n-1", true)], 0)));
    vi.stubGlobal("fetch", fetcher);
    const store = useNotificationsStore();
    await store.load();
    const poll = store.load(true);
    await store.markRead("n-1");
    resolve(json(page()));
    await poll;
    await flushPromises();
    expect(store.unreadCount).toBe(0);
    expect(store.items[0].read).toBe(true);
  });
  test("expired sessions remove private notifications instead of showing a stale inbox", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(json(page()))
        .mockResolvedValueOnce(json({ message: "Unauthorized" }, 401)),
    );
    const store = useNotificationsStore();
    await store.load();
    await store.load(true);
    expect(useAuthStore().accessToken).toBeNull();
    expect(store.items).toEqual([]);
    expect(store.unreadCount).toBe(0);
  });
});
