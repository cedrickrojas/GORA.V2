import type { FeedActivity } from '@/types/feed';
import type { Game, GameStatus } from '@/types/game';
import type { PlayerSummary } from '@/types/player';
import type { FeedPost, PostLocation, PostMediaItem } from '@/types/post';
import type { Reel } from '@/types/reel';
import type { SportsLocation } from '@/types/sport';
import { summarizeGameCapacity } from '@/utils/games';
import { DAY_MS, HOUR_MS } from '@/utils/time';
import { mockClubSummaries } from './mock-clubs';
import { mockCurrentUser, mockUsers } from './mock-users';

export const mockPlayers: PlayerSummary[] = [
  { ...mockUsers.john, primarySport: 'Basketball', city: 'Manila', distanceKm: 0.9, followers: 4820, gamesCompleted: 141, featured: true },
  { ...mockUsers.maria, primarySport: 'Volleyball', city: 'Quezon City', distanceKm: 4.2, followers: 9310, gamesCompleted: 208, featured: true },
  { ...mockUsers.alex, primarySport: 'Football', city: 'Taguig', distanceKm: 8.6, followers: 2150, gamesCompleted: 77, featured: false },
  { ...mockUsers.mark, primarySport: 'Tennis', city: 'Makati', distanceKm: 6.1, followers: 1340, gamesCompleted: 54, featured: false },
  { ...mockUsers.sam, primarySport: 'Badminton', city: 'Pasig', distanceKm: 12.4, followers: 760, gamesCompleted: 39, featured: false },
  { ...mockUsers.kim, primarySport: 'Running', city: 'Marikina', distanceKm: 18.3, followers: 6120, gamesCompleted: 96, featured: true },
  { ...mockUsers.paolo, primarySport: 'Pickleball', city: 'Alabang', distanceKm: 31.5, followers: 980, gamesCompleted: 28, featured: false },
  { ...mockUsers.bea, primarySport: 'Swimming', city: 'Antipolo', distanceKm: 72.0, followers: 3470, gamesCompleted: 63, featured: false },
];

export const mockLocations: SportsLocation[] = [
  { id: 'loc-rizal', name: 'Rizal Park Courts', city: 'Manila', sports: ['Basketball', 'Volleyball'], latitude: 14.5831, longitude: 120.9794, distanceKm: 0.8 },
  { id: 'loc-riverside', name: 'Riverside Volleyball Court', city: 'Manila', sports: ['Volleyball'], latitude: 14.5946, longitude: 120.9885, distanceKm: 1.2 },
  { id: 'loc-qmc', name: 'Quezon Memorial Circle', city: 'Quezon City', sports: ['Running', 'Badminton'], latitude: 14.6515, longitude: 121.0493, distanceKm: 4.5 },
  { id: 'loc-bgc', name: 'BGC Turf Field', city: 'Taguig', sports: ['Football'], latitude: 14.5503, longitude: 121.0509, distanceKm: 8.9 },
  { id: 'loc-ultra', name: 'Ultra Sports Complex', city: 'Pasig', sports: ['Volleyball', 'Badminton', 'Tennis'], latitude: 14.5764, longitude: 121.0851, distanceKm: 11.7 },
  { id: 'loc-marikina', name: 'Marikina Sports Center', city: 'Marikina', sports: ['Running', 'Swimming'], latitude: 14.6330, longitude: 121.0990, distanceKm: 19.2 },
  { id: 'loc-alabang', name: 'Alabang Pickleball Hub', city: 'Muntinlupa', sports: ['Pickleball'], latitude: 14.4231, longitude: 121.0415, distanceKm: 32.4 },
  { id: 'loc-tagaytay', name: 'Tagaytay Highlands Courts', city: 'Tagaytay', sports: ['Tennis'], latitude: 14.1153, longitude: 120.9621, distanceKm: 58.0 },
];

function locationById(id: string): SportsLocation {
  const location = mockLocations.find((candidate) => candidate.id === id);

  if (!location) {
    throw new Error(`Missing mock location ${id}`);
  }

  return location;
}

/** Stands in for the API: currentPlayers and OPEN/FULL come from occupant count. */
function withOccupants(
  game: Omit<Game, 'currentPlayers' | 'status'> & { occupyingPlayers: number; status?: GameStatus },
): Game {
  const { occupyingPlayers, status, ...rest } = game;
  const capacity = summarizeGameCapacity(rest.requiredPlayers, occupyingPlayers);
  const recruiting = status === undefined || status === 'OPEN' || status === 'FULL';

  return {
    ...rest,
    currentPlayers: capacity.currentPlayers,
    status: recruiting ? (capacity.isFull ? 'FULL' : 'OPEN') : status,
  };
}

export function buildMockGames(referenceMs: number): Game[] {
  const at = (daysFromToday: number, hour: number, minute = 0): string => {
    const date = new Date(referenceMs);
    date.setDate(date.getDate() + daysFromToday);
    date.setHours(hour, minute, 0, 0);

    return date.toISOString();
  };
  const posted = (hoursAgo: number): string => new Date(referenceMs - hoursAgo * HOUR_MS).toISOString();

  return [
    withOccupants({
      id: 'game-volley-riverside-evening',
      title: 'Riverside Evening Volleyball',
      description: 'Looking for players tonight!',
      sport: 'Volleyball',
      host: mockUsers.maria,
      location: locationById('loc-riverside'),
      startsAt: at(0, 18),
      createdAt: posted(1.5),
      skillLevel: 'Intermediate',
      occupyingPlayers: 3,
      requiredPlayers: 12,
      participation: 'NONE',
    }),
    withOccupants({
      id: 'game-volley-riverside-late',
      title: 'Late 6v6 Run',
      sport: 'Volleyball',
      host: mockUsers.carlo,
      location: locationById('loc-riverside'),
      startsAt: at(0, 19, 30),
      createdAt: posted(4),
      skillLevel: 'All levels',
      occupyingPlayers: 10,
      requiredPlayers: 12,
      participation: 'NONE',
    }),
    withOccupants({
      id: 'game-volley-ultra-cancelled',
      title: 'Ultra Indoor Scrimmage',
      sport: 'Volleyball',
      host: mockUsers.sam,
      location: locationById('loc-ultra'),
      startsAt: at(0, 20),
      createdAt: posted(30),
      status: 'CANCELLED',
      skillLevel: 'Advanced',
      occupyingPlayers: 6,
      requiredPlayers: 12,
      participation: 'NONE',
    }),
    withOccupants({
      id: 'game-volley-sat',
      title: 'Weekend 6v6 Volleyball',
      sport: 'Volleyball',
      host: mockCurrentUser,
      club: mockClubSummaries.imusVolleyball,
      location: locationById('loc-rizal'),
      startsAt: at(3, 16),
      createdAt: posted(26),
      skillLevel: 'All levels',
      occupyingPlayers: 9,
      requiredPlayers: 12,
      participation: 'HOST',
    }),
    withOccupants({
      id: 'game-hoops-night',
      title: 'Full Court Night Run',
      description: 'Full court, 5v5. Bring a dark and a light shirt.',
      sport: 'Basketball',
      host: mockUsers.john,
      club: mockClubSummaries.caviteBasketball,
      location: locationById('loc-rizal'),
      startsAt: at(1, 19),
      createdAt: posted(7),
      skillLevel: 'Intermediate',
      occupyingPlayers: 8,
      requiredPlayers: 10,
      participation: 'PARTICIPANT',
    }),
    withOccupants({
      id: 'game-badminton-doubles',
      title: 'Doubles Ladder',
      sport: 'Badminton',
      host: mockUsers.sam,
      location: locationById('loc-ultra'),
      startsAt: at(2, 18),
      createdAt: posted(20),
      skillLevel: 'Advanced',
      occupyingPlayers: 5,
      requiredPlayers: 8,
      participation: 'REQUESTED',
    }),
    withOccupants({
      id: 'game-futsal',
      title: '5-a-side Futsal',
      sport: 'Football',
      host: mockUsers.alex,
      location: locationById('loc-bgc'),
      startsAt: at(1, 20),
      createdAt: posted(12),
      skillLevel: 'All levels',
      occupyingPlayers: 7,
      requiredPlayers: 10,
      participation: 'NONE',
    }),
    withOccupants({
      id: 'game-qmc-run',
      title: 'Sunrise 10K Group Run',
      sport: 'Running',
      host: mockUsers.kim,
      location: locationById('loc-qmc'),
      startsAt: at(2, 5, 30),
      createdAt: posted(40),
      skillLevel: 'Beginner friendly',
      occupyingPlayers: 23,
      requiredPlayers: 40,
      participation: 'NONE',
    }),
    withOccupants({
      id: 'game-pickleball',
      title: 'Pickleball Open Play',
      sport: 'Pickleball',
      host: mockUsers.paolo,
      location: locationById('loc-alabang'),
      startsAt: at(4, 9),
      createdAt: posted(50),
      skillLevel: 'All levels',
      occupyingPlayers: 11,
      requiredPlayers: 16,
      participation: 'NONE',
    }),
    withOccupants({
      id: 'game-tennis-full',
      title: 'Morning Tennis Singles',
      sport: 'Tennis',
      host: mockUsers.mark,
      location: locationById('loc-tagaytay'),
      startsAt: at(5, 7),
      createdAt: posted(60),
      skillLevel: 'Intermediate',
      occupyingPlayers: 4,
      requiredPlayers: 4,
      participation: 'NONE',
    }),
    withOccupants({
      id: 'game-volley-last-week',
      title: 'Beach Volleyball Cup',
      sport: 'Volleyball',
      host: mockUsers.maria,
      location: locationById('loc-ultra'),
      startsAt: at(-6, 16),
      createdAt: posted(240),
      status: 'COMPLETED',
      skillLevel: 'Intermediate',
      occupyingPlayers: 12,
      requiredPlayers: 12,
      participation: 'PARTICIPANT',
    }),
  ];
}

export function buildMockReels(referenceMs: number): Reel[] {
  const ago = (offsetMs: number): string => new Date(referenceMs - offsetMs).toISOString();

  return [
    { id: 'reel-1', author: mockUsers.maria, club: mockClubSummaries.imusVolleyball, sport: 'Volleyball', caption: 'Pancake save into a kill. Team effort.', locationName: 'Ultra Sports Complex', videoUrl: null, durationSeconds: 18, views: 48200, likes: 5120, comments: 214, shares: 380, likedByViewer: false, createdAt: ago(3 * HOUR_MS) },
    { id: 'reel-2', author: mockUsers.john, club: mockClubSummaries.caviteBasketball, sport: 'Basketball', caption: 'Crossover, step-back, splash.', locationName: 'Rizal Park Courts', videoUrl: null, durationSeconds: 12, views: 73900, likes: 8840, comments: 502, shares: 1240, likedByViewer: true, createdAt: ago(7 * HOUR_MS) },
    { id: 'reel-3', author: mockUsers.paolo, sport: 'Pickleball', caption: 'Third-shot drop practice pays off.', locationName: 'Alabang Pickleball Hub', videoUrl: null, durationSeconds: 21, views: 15600, likes: 1320, comments: 88, shares: 64, likedByViewer: false, createdAt: ago(DAY_MS) },
    { id: 'reel-4', author: mockUsers.alex, sport: 'Football', caption: 'Top bins from outside the box.', locationName: 'BGC Turf Field', videoUrl: null, durationSeconds: 9, views: 32400, likes: 2980, comments: 176, shares: 290, likedByViewer: false, createdAt: ago(2 * DAY_MS) },
    { id: 'reel-5', author: mockUsers.kim, sport: 'Running', caption: 'Last kilometer sprint. New PR.', locationName: 'Marikina Sports Center', videoUrl: null, durationSeconds: 15, views: 9800, likes: 870, comments: 41, shares: 22, likedByViewer: false, createdAt: ago(3 * DAY_MS) },
  ];
}

function photos(postId: string, count: number): PostMediaItem[] {
  return Array.from({ length: count }, (_, index) => ({ id: `${postId}-media-${index + 1}`, type: 'image', url: null }));
}

/** Everyone's posts, including the current user's; Profile shows the author's own. */
export function buildMockPosts(referenceMs: number): FeedPost[] {
  const ago = (offsetMs: number): string => new Date(referenceMs - offsetMs).toISOString();
  const post = (
    fields: Pick<FeedPost, 'id' | 'author' | 'body' | 'sport' | 'createdAt' | 'likes' | 'comments'> &
      Partial<
        Pick<FeedPost, 'media' | 'shares' | 'visibility' | 'customViewerIds' | 'club' | 'isAnnouncement' | 'tags' | 'location'>
      >,
  ): FeedPost => ({ media: [], shares: 0, visibility: 'PUBLIC', likedByViewer: false, tags: [], location: null, ...fields });
  /** A post location the author picked from GORA venues. */
  const at = (locationId: string): PostLocation => {
    const { name, latitude, longitude } = locationById(locationId);

    return { name, latitude, longitude };
  };

  return [
    post({ id: 'post-7', author: mockCurrentUser, body: 'Great game today!', sport: 'Volleyball', createdAt: ago(0.75 * HOUR_MS), likes: 23, comments: 4, media: photos('post-7', 1), tags: [mockUsers.john, mockUsers.maria], location: at('loc-riverside') }),
    post({ id: 'feed-post-1', author: mockUsers.john, body: 'Need 2 more for a full court run tonight at Rizal Park.', sport: 'Basketball', createdAt: ago(HOUR_MS), likes: 64, comments: 18, shares: 3, location: at('loc-rizal') }),
    post({ id: 'feed-post-2', author: mockUsers.maria, body: 'Beach volleyball clinic for beginners next Sunday.', sport: 'Volleyball', createdAt: ago(5 * HOUR_MS), likes: 212, comments: 40, shares: 17, media: photos('feed-post-2', 1) }),
    post({ id: 'feed-post-3', author: mockUsers.paolo, body: 'Pickleball paddles available to borrow at open play.', sport: 'Pickleball', createdAt: ago(DAY_MS), likes: 37, comments: 9 }),
    post({ id: 'feed-post-4', author: mockUsers.kim, body: 'Group run pace is 6:30 per km, everyone welcome.', sport: 'Running', createdAt: ago(2 * DAY_MS), likes: 91, comments: 12, media: photos('feed-post-4', 3), tags: [mockUsers.sam, mockUsers.mark, mockUsers.alex], location: at('loc-qmc') }),
    post({ id: 'post-1', author: mockCurrentUser, body: 'Hosting a 6v6 volleyball game this Saturday at 4 PM. All levels welcome.', sport: 'Volleyball', createdAt: ago(3 * HOUR_MS), likes: 42, comments: 11, shares: 5 }),
    post({ id: 'post-2', author: mockCurrentUser, body: 'Uploaded a new highlight: cross-court kill from last night. Check My Reels.', sport: 'Volleyball', createdAt: ago(20 * HOUR_MS), likes: 87, comments: 14, media: photos('post-2', 2) }),
    post({ id: 'post-3', author: mockCurrentUser, body: '32 games completed this season. Thanks to everyone who showed up.', sport: 'Volleyball', createdAt: ago(2 * DAY_MS), likes: 118, comments: 23, visibility: 'FRIENDS' }),
    post({ id: 'club-post-imus-practice', author: mockCurrentUser, club: mockClubSummaries.imusVolleyball, isAnnouncement: true, body: 'Thursday practice moves to 6 PM at Imus Sports Complex. Bring a light and a dark jersey.', sport: 'Volleyball', createdAt: ago(2.5 * HOUR_MS), likes: 31, comments: 7, shares: 2 }),
    post({ id: 'club-post-cavite-fees', author: mockUsers.mark, club: mockClubSummaries.caviteBasketball, body: 'October court booking is confirmed for Saturdays. Photos from last week’s league night below.', sport: 'Basketball', createdAt: ago(10 * HOUR_MS), likes: 58, comments: 12, media: photos('club-post-cavite-fees', 2) }),
    post({ id: 'club-post-running-sunday', author: mockUsers.kim, club: mockClubSummaries.imusRunning, isAnnouncement: true, body: 'Sunday long run: 15K at easy pace from Imus Plaza, 5:30 AM. Water stop at 8K.', sport: 'Running', createdAt: ago(DAY_MS + 3 * HOUR_MS), likes: 44, comments: 5 }),
    post({ id: 'post-4', author: mockCurrentUser, body: 'First pickup basketball run in months. Point guard duties again, legs are gone.', sport: 'Basketball', createdAt: ago(4 * DAY_MS), likes: 56, comments: 9 }),
    // One post per privacy rule, as the server would store them. The viewer (Louis) sees only
    // the ones the server would send him: Maria is a friend, Bea chose him, Paolo is not a friend.
    post({ id: 'post-5', author: mockCurrentUser, body: 'Planning a surprise birthday run for Coach Ben. Keep it quiet!', sport: 'Running', createdAt: ago(6 * HOUR_MS), likes: 4, comments: 2, visibility: 'CUSTOM', customViewerIds: [mockUsers.john.id, mockUsers.maria.id] }),
    post({ id: 'post-6', author: mockCurrentUser, body: 'Training log: 3x10 box jumps, 20 min footwork. Knee feels better.', sport: 'Volleyball', createdAt: ago(3 * DAY_MS), likes: 0, comments: 0, visibility: 'ONLY_ME' }),
    post({ id: 'feed-post-5', author: mockUsers.maria, body: 'Team dinner after Sunday practice, friends only this time.', sport: 'Volleyball', createdAt: ago(8 * HOUR_MS), likes: 26, comments: 6, visibility: 'FRIENDS' }),
    post({ id: 'feed-post-6', author: mockUsers.paolo, body: 'Friends-only pickleball ladder results are up.', sport: 'Pickleball', createdAt: ago(9 * HOUR_MS), likes: 12, comments: 3, visibility: 'FRIENDS' }),
    post({ id: 'feed-post-7', author: mockUsers.bea, body: 'Louis, the lap swim group has one open lane on Tuesdays.', sport: 'Swimming', createdAt: ago(11 * HOUR_MS), likes: 3, comments: 1, visibility: 'CUSTOM', customViewerIds: [mockCurrentUser.id] }),
    post({ id: 'feed-post-8', author: mockUsers.carlo, body: 'Private note: ask about the league fee.', sport: 'Basketball', createdAt: ago(12 * HOUR_MS), likes: 0, comments: 0, visibility: 'ONLY_ME' }),
  ];
}

export function buildMockActivities(referenceMs: number): FeedActivity[] {
  const ago = (offsetMs: number): string => new Date(referenceMs - offsetMs).toISOString();

  return [
    { id: 'activity-maria-badge', actor: mockUsers.maria, kind: 'BADGE_UNLOCKED', summary: 'unlocked the Social Player badge', sport: 'Volleyball', createdAt: ago(2 * HOUR_MS) },
    { id: 'activity-kim-joined', actor: mockUsers.kim, kind: 'GAME_JOINED', summary: 'joined Sunrise 10K Group Run', sport: 'Running', createdAt: ago(9 * HOUR_MS) },
    { id: 'activity-john-completed', actor: mockUsers.john, kind: 'GAME_COMPLETED', summary: 'completed Beach Volleyball Cup', sport: 'Volleyball', createdAt: ago(6 * DAY_MS) },
  ];
}

export const mockFriends: PlayerSummary[] = mockPlayers.slice(0, 6);
