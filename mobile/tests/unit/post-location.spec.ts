import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, test } from 'vitest';
import { routerKey } from 'vue-router';
import PostCard from '@/components/feed/PostCard.vue';
import { buildMockPosts, mockLocations } from '@/services/mock/mock-catalog';
import { mockCurrentUser, mockUsers } from '@/services/mock/mock-users';
import { useFriendsStore } from '@/stores/friends';
import { usePostsStore } from '@/stores/posts';
import { useSessionStore } from '@/stores/session';
import type { PostDraft } from '@/types/post';
import { canPublishPost } from '@/utils/feed';
import {
  NEARBY_ACTIVITY_RADIUS_KM,
  distanceBetweenKm,
  gamePoint,
  groupGamesByPlace,
  locationMapPath,
  parseLocationMapRoute,
  placeMarkers,
  projectToPreview,
} from '@/utils/location-map';
import {
  POST_TAGS_MAX,
  summarizeTags,
  validatePostLocation,
  validatePostTags,
  visibleTags,
} from '@/utils/post-details';

const NOW = Date.parse('2026-09-30T04:00:00.000Z');
const venue = (id: string) => {
  const place = mockLocations.find((candidate) => candidate.id === id)!;

  return { name: place.name, latitude: place.latitude, longitude: place.longitude };
};
const RIVERSIDE = venue('loc-riverside');
const RIZAL = venue('loc-rizal');

function draft(fields: Partial<PostDraft> = {}): PostDraft {
  return {
    body: 'Great game today!',
    sport: 'Volleyball',
    visibility: 'PUBLIC',
    customViewerIds: [],
    taggedUserIds: [],
    location: null,
    photoUrls: [],
    ...fields,
  };
}

describe('post tags', () => {
  test('each person once, never yourself, at most the limit', () => {
    expect(validatePostTags(['a', 'b'], 'me')).toBeNull();
    expect(validatePostTags(['a', 'a'], 'me')).toMatch(/only once/);
    expect(validatePostTags(['me'], 'me')).toMatch(/yourself/);
    expect(validatePostTags(Array.from({ length: POST_TAGS_MAX + 1 }, (_, i) => `u${i}`), 'me')).toMatch(/up to/);
  });

  test('a draft with bad tags cannot be published', () => {
    expect(canPublishPost(draft({ taggedUserIds: ['john'] }), 'me')).toBe(true);
    expect(canPublishPost(draft({ taggedUserIds: ['me'] }), 'me')).toBe(false);
  });

  test('cards show two names, or all three, before "and N others"', () => {
    const people = [mockUsers.john, mockUsers.maria, mockUsers.alex, mockUsers.mark];

    expect(summarizeTags(people.slice(0, 2))).toEqual({ shown: people.slice(0, 2), othersCount: 0 });
    expect(summarizeTags(people.slice(0, 3))).toEqual({ shown: people.slice(0, 3), othersCount: 0 });
    expect(summarizeTags(people)).toEqual({ shown: people.slice(0, 2), othersCount: 2 });
  });

  test('tagged people with a block are left out', () => {
    expect(visibleTags([mockUsers.john, mockUsers.maria], new Set([mockUsers.john.id]))).toEqual([mockUsers.maria]);
    expect(visibleTags(undefined, new Set())).toEqual([]);
  });
});

describe('post location', () => {
  test('a location is a named place with valid coordinates, or nothing', () => {
    expect(validatePostLocation(null)).toBeNull();
    expect(validatePostLocation(RIVERSIDE)).toBeNull();
    expect(validatePostLocation({ ...RIVERSIDE, name: '  ' })).toMatch(/name/);
    expect(validatePostLocation({ ...RIVERSIDE, latitude: 91 })).toMatch(/coordinates/);
    expect(validatePostLocation({ ...RIVERSIDE, longitude: Number.NaN })).toMatch(/coordinates/);
    expect(canPublishPost(draft({ location: { ...RIVERSIDE, name: '' } }), 'me')).toBe(false);
    expect(canPublishPost(draft({ location: RIVERSIDE }), 'me')).toBe(true);
  });
});

describe('publishing and managing tags', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  test('a published post carries its tags and location', async () => {
    const store = usePostsStore();
    await store.load();

    const post = await store.publish(
      mockCurrentUser,
      draft({ taggedUserIds: [mockUsers.john.id, mockUsers.maria.id], location: RIVERSIDE }),
    );

    expect(post?.tags?.map((person) => person.id)).toEqual([mockUsers.john.id, mockUsers.maria.id]);
    expect(post?.location).toEqual(RIVERSIDE);
    expect(store.visiblePosts[0]?.id).toBe(post?.id);
  });

  test('only the author manages tags, and the new list replaces the old one', async () => {
    const store = usePostsStore();
    await store.load();
    const tagsOf = (id: string) => store.posts.find((candidate) => candidate.id === id)?.tags?.map((p) => p.id);

    expect(await store.updateTags('feed-post-4', [])).toMatch(/Only the author/);
    expect(await store.updateTags('post-7', [mockCurrentUser.id])).toMatch(/yourself/);

    expect(await store.updateTags('post-7', [mockUsers.maria.id])).toBeNull();
    expect(tagsOf('post-7')).toEqual([mockUsers.maria.id]);

    expect(await store.updateTags('post-7', [])).toBeNull();
    expect(tagsOf('post-7')).toEqual([]);
  });

  test('the card shows "with ..." and a location link to the map', async () => {
    await useSessionStore().load();
    await useFriendsStore().load();
    const post = buildMockPosts(NOW).find((candidate) => candidate.id === 'post-7')!;

    const wrapper = mount(PostCard, {
      props: { post, nowMs: NOW },
      global: {
        provide: { [routerKey as symbol]: { replace: () => undefined, push: () => undefined } },
        stubs: {
          RouterLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
          EditPostPrivacyModal: true,
          TagPeopleModal: true,
        },
      },
    });

    expect(wrapper.find('.post-card__with').text()).toBe('with John Reyes, Maria Santos');
    const location = wrapper.find('.post-card__location');
    expect(location.text()).toContain('Riverside Volleyball Court');
    expect(location.attributes('href')).toBe(locationMapPath(RIVERSIDE));

    await wrapper.setProps({
      post: { ...post, tags: [mockUsers.john, mockUsers.maria, mockUsers.alex, mockUsers.mark] },
    });
    expect(wrapper.find('.post-card__with').text()).toBe('with John Reyes, Maria Santos and 2 others');
  });
});

describe('location map', () => {
  const at = (id: string, sport: string, point: { latitude: number; longitude: number } | null, startTime = '18:00') => ({
    id,
    sport: { name: sport },
    gameDate: '2026-10-02',
    startTime,
    locationName: point ? `Place ${id}` : 'Somewhere',
    latitude: point?.latitude ?? null,
    longitude: point?.longitude ?? null,
  });

  test('the route keeps coordinates in the path and reads back the same place', () => {
    const path = locationMapPath(RIVERSIDE, 'game-1');
    const [pathname, search] = path.split('?');
    const [, , lat, lng] = pathname.split('/');
    const query = Object.fromEntries(new URLSearchParams(search));

    expect(pathname).toBe('/map/14.59460/120.98850');
    expect(parseLocationMapRoute({ lat, lng }, query)).toEqual({ center: RIVERSIDE, selectedGameId: 'game-1' });
    expect(parseLocationMapRoute({ lat: '95', lng: '120' }, {})).toBeNull();
    expect(parseLocationMapRoute({ lat: 'abc', lng: '120' }, {})).toBeNull();
    expect(parseLocationMapRoute({ lat: '14.5', lng: '121' }, {})?.center.name).toBe('Selected location');
  });

  test('distances use the great-circle formula', () => {
    expect(distanceBetweenKm(RIVERSIDE, RIVERSIDE)).toBe(0);
    expect(distanceBetweenKm(RIVERSIDE, RIZAL)).toBeGreaterThan(1.4);
    expect(distanceBetweenKm(RIVERSIDE, RIZAL)).toBeLessThan(NEARBY_ACTIVITY_RADIUS_KM);
  });

  test('games at one venue share a place; several sports show several markers', () => {
    const places = groupGamesByPlace([
      at('late', 'Volleyball', RIVERSIDE, '20:00'),
      at('rizal-b', 'Basketball', RIZAL),
      at('early', 'Volleyball', RIVERSIDE, '17:00'),
      at('rizal-v', 'Volleyball', { latitude: RIZAL.latitude + 0.0002, longitude: RIZAL.longitude }, '19:00'),
    ]);

    expect(places.map((place) => place.name)).toEqual(['Place late', 'Place rizal-b']);
    expect(places[0].games.map((game) => game.id)).toEqual(['early', 'late']);
    expect(placeMarkers(places[0])).toEqual(['🏐']);
    expect(placeMarkers(places[1])).toEqual(['🏀', '🏐']);
  });

  test('games without coordinates get no marker and never fall back to 0,0', () => {
    const noPoint = at('none', 'Tennis', null);

    expect(gamePoint(noPoint)).toBeNull();
    expect(gamePoint({ ...noPoint, latitude: 95, longitude: 10 })).toBeNull();
    expect(groupGamesByPlace([noPoint])).toEqual([]);
  });

  test('the selected location sits in the middle of the preview', () => {
    expect(projectToPreview(RIVERSIDE, RIVERSIDE, 2)).toEqual({ left: 50, top: 50 });

    const rizal = projectToPreview(RIZAL, RIVERSIDE, 2);
    expect(rizal.left).toBeLessThan(50);
    expect(rizal.top).toBeGreaterThan(50);
  });
});
