import type { AppLanguage } from '@/stores/app-preferences';

const FILIPINO: Record<string, string> = {
  "Profile photo": "Larawan ng profile",
  "Cover photo": "Larawan ng cover",
  "Upload profile photo": "Mag-upload ng larawan ng profile",
  "Upload cover photo": "Mag-upload ng larawan ng cover",
  "Change profile photo": "Palitan ang larawan ng profile",
  "Change cover photo": "Palitan ang larawan ng cover",
  "Choose club profile photo": "Pumili ng larawan ng profile ng club",
  "Choose club cover photo": "Pumili ng larawan ng cover ng club",
  "Preparing photo...": "Inihahanda ang larawan...",
  "Generate description": "Gumawa ng description",
  "Generate about text": "Gumawa ng teksto tungkol sa club",
  "Generated from your club details. You can edit it anytime.": "Ginawa mula sa detalye ng club. Maaari mo itong i-edit anumang oras.",
  "JPEG, PNG or WebP, up to 20 MB. Photos are resized before saving.": "JPEG, PNG o WebP, hanggang 20 MB. Inaayos ang laki ng larawan bago i-save.",
  "Profile photo selected": "Napili na ang larawan ng profile",
  "Cover photo selected": "Napili na ang larawan ng cover",
  'Home': 'Tahanan',
  'Search': 'Maghanap',
  'Discover': 'Tuklasin',
  'Play. Connect. Climb.': 'Maglaro. Makipagkilala. Umangat.',
  'All-time points from active GORA players.': 'Kabuuang puntos ng mga aktibong manlalaro sa GORA.',
  'Your rank': 'Iyong ranggo',
  'Refresh ranking': 'I-refresh ang ranking',
  'Loading rankings...': 'Nilo-load ang ranking...',
  'Ranked players': 'Mga manlalaro sa ranking',
  'Load more players': 'Mag-load pa ng mga manlalaro',
  'No players to rank yet. Earn points and start the leaderboard.': 'Wala pang manlalaro sa ranking. Kumita ng puntos at simulan ang leaderboard.',
  'Earn points by logging in, posting, and playing games. Tied scores share a rank.': 'Kumita ng puntos sa pag-login, pag-post, at paglalaro. Magkapareho ang ranggo kapag tabla ang puntos.',
  'Discoveries': 'Mga Tuklas',
  'Messages': 'Mga Mensahe',
  'Notifications': 'Mga Notipikasyon',
  'Profile': 'Profile',
  'Settings': 'Mga Setting',
  'More Settings': 'Iba Pang Setting',
  'Done': 'Tapos',
  'Cancel': 'Kanselahin',
  'Close': 'Isara',
  'Save': 'I-save',
  'Save changes': 'I-save ang mga pagbabago',
  'Edit': 'I-edit',
  'Delete': 'Burahin',
  'Back': 'Bumalik',
  'Next': 'Susunod',
  'Previous': 'Nakaraan',
  'Refresh': 'I-refresh',
  'Loading…': 'Naglo-load…',
  'Loading...': 'Naglo-load…',
  'Try again': 'Subukan muli',
  'See all': 'Tingnan lahat',
  'View all': 'Tingnan lahat',
  'View profile': 'Tingnan ang profile',
  'Share': 'Ibahagi',
  'Copy link': 'Kopyahin ang link',
  'Report': 'I-report',
  'Block': 'I-block',
  'Unblock': 'I-unblock',
  'Follow': 'I-follow',
  'Following': 'Sinusubaybayan',
  'Unfollow': 'I-unfollow',
  'Friends': 'Mga Kaibigan',
  'Friend request': 'Friend request',
  'Accept': 'Tanggapin',
  'Decline': 'Tanggihan',
  'Create': 'Gumawa',
  'Create Post': 'Gumawa ng Post',
  'Create Game': 'Gumawa ng Laro',
  'Create Club': 'Gumawa ng Club',
  'Create a club': 'Gumawa ng Club',
  'Upload Reel': 'Mag-upload ng Reel',
  'Add Story': 'Magdagdag ng Story',
  'Post': 'I-post',
  'Caption': 'Caption',
  'Write a comment…': 'Magsulat ng komento…',
  'Write a comment...': 'Magsulat ng komento…',
  'Comment': 'Magkomento',
  'Like': 'I-like',
  'Save post': 'I-save ang post',
  'Saved Posts': 'Mga Naka-save na Post',
  'No posts yet.': 'Wala pang mga post.',
  'Stories': 'Mga Story',
  'Your Story': 'Iyong Story',
  'My Stories': 'Mga Story Ko',
  'Archive': 'Archive',
  'Archived': 'Naka-archive',
  'Games': 'Mga Laro',
  'Game': 'Laro',
  'Players': 'Mga Manlalaro',
  'Host': 'Host',
  'Hosted by': 'Pinangungunahan ni',
  'Joined Games': 'Mga Sinalihang Laro',
  'Hosted Games': 'Mga Larong Hinost',
  'Request to Join': 'Humiling na Sumali',
  'Join Game': 'Sumali sa Laro',
  'Joined': 'Sumali na',
  'Registration closes': 'Magsasara ang pagpaparehistro',
  'Registration closed': 'Sarado na ang pagpaparehistro',
  'View Game': 'Tingnan ang Laro',
  'View on Map': 'Tingnan sa Mapa',
  'Open map': 'Buksan ang mapa',
  'Map': 'Mapa',
  'List': 'Listahan',
  'Location': 'Lokasyon',
  'Date': 'Petsa',
  'Today': 'Ngayon',
  'Tomorrow': 'Bukas',
  'This Week': 'Ngayong Linggo',
  'All': 'Lahat',
  'Open': 'Bukas',
  'Full': 'Puno na',
  'Cancelled': 'Kinansela',
  'Completed': 'Tapos na',
  'Successful': 'Matagumpay',
  'Clubs': 'Mga Club',
  'Your clubs': 'Mga Club Mo',
  'Available Clubs': 'Mga Available na Club',
  'People you may know': 'Mga taong maaaring kakilala mo',
  'Sports': 'Mga Isport',
  'Posts': 'Mga Post',
  'Reels': 'Mga Reel',
  'Help': 'Tulong',
  'Contact Help': 'Makipag-ugnayan sa Tulong',
  'My Help Requests': 'Mga Help Request Ko',
  'Send a message to the GORA admin team': 'Magpadala ng mensahe sa admin team ng GORA',
  'Language': 'Wika',
  'Choose your preferred language': 'Piliin ang gusto mong wika',
  'Filipino': 'Filipino',
  'English': 'Ingles',
  'Display': 'Hitsura',
  'Choose light or dark mode': 'Pumili ng maliwanag o madilim na tema',
  'Dark': 'Madilim',
  'Light': 'Maliwanag',
  'These preferences are saved on this device.': 'Naka-save sa device na ito ang mga pinili mo.',
  'Account': 'Account',
  'Change your email, password, and phone number': 'Palitan ang email, password, at numero ng telepono',
  'Privacy': 'Privacy',
  'Location and distance': 'Lokasyon at layo',
  'Who can view your profile': 'Sino ang makakakita ng profile mo',
  'Everyone': 'Lahat',
  'Friends only': 'Mga kaibigan lang',
  'Use device location': 'Gamitin ang lokasyon ng device',
  'Default search distance': 'Default na layo ng paghahanap',
  'Any distance': 'Anumang layo',
  'Log Out': 'Mag-log out',
  'Logging out...': 'Nagla-log out…',
  'Email': 'Email',
  'Email address': 'Email address',
  'Phone number': 'Numero ng telepono',
  'Password': 'Password',
  'Current password': 'Kasalukuyang password',
  'New password': 'Bagong password',
  'Save email': 'I-save ang email',
  'Save phone number': 'I-save ang numero ng telepono',
  'Change password': 'Palitan ang password',
  'Account status': 'Status ng account',
  'Deactivate account': 'I-deactivate ang account',
  'Delete account': 'Burahin ang account',
  'Send': 'Ipadala',
  'Sending…': 'Ipinapadala…',
  'Search GORA': 'Maghanap sa GORA',
  'Search games': 'Maghanap ng mga laro',
  'Search people': 'Maghanap ng mga tao',
  'Search clubs': 'Maghanap ng mga club',
  'No results found.': 'Walang nahanap na resulta.',
  'No upcoming games.': 'Wala pang mga paparating na laro.',
  'No games found.': 'Walang nahanap na laro.',
  'No clubs found.': 'Walang nahanap na club.',
  'No notifications yet.': 'Wala pang mga notipikasyon.',
  'Friend activity': 'Aktibidad ng kaibigan',
  'Game activity': 'Aktibidad sa laro',
  'Posts and activity': 'Mga post at aktibidad',
  'Super Admin Dashboard': 'Dashboard ng Super Admin',
  'Manage GORA, accounts, and reports': 'Pamahalaan ang GORA, mga account, at report',
  'Edit Profile': 'I-edit ang Profile',
  'Start a community for your sport and city': 'Magsimula ng komunidad para sa isport at lungsod mo',
  'Username': 'Username',
  'Bio': 'Bio',
  'Name': 'Pangalan',
  'Title': 'Pamagat',
  'Description': 'Paglalarawan',
  'Required players': 'Bilang ng kailangang manlalaro',
  'Registration closes (optional)': 'Pagsasara ng pagpaparehistro (opsyonal)',
  'Leave blank to accept join requests until the game starts.': 'Iwang blangko para tumanggap ng sasali hanggang magsimula ang laro.',
  'When the game starts': 'Kapag nagsimula na ang laro',
  'Schedule': 'Iskedyul',
  'Choose your sport and give your game a name.': 'Pumili ng isport at pangalan para sa laro mo.',
  'Local time at the venue.': 'Oras batay sa lokasyon ng laro.',
  'Manual Accept': 'Manwal na pagtanggap',
  'Auto Accept': 'Awtomatikong pagtanggap',
  'Players & Approval': 'Mga Manlalaro at Pagtanggap',
  'Game Details': 'Detalye ng Laro',
  'Review': 'Suriin',
  'View Profile': 'Tingnan ang Profile',
  'Send Message': 'Magpadala ng Mensahe',
  'Message': 'Mensahe',
  'Inbox': 'Inbox',
  'Unread': 'Hindi pa nababasa',
  'Mark all read': 'Markahang nabasa lahat',
  'No messages yet.': 'Wala pang mga mensahe.',
  'Your profile': 'Profile mo',
  'Edit game': 'I-edit ang laro',
  'Cancel game': 'Kanselahin ang laro',
  'Remove player': 'Alisin ang manlalaro',
  'Request Pending': 'Naghihintay ng tugon',
  'Request sent': 'Naipadala ang request',
  'People': 'Mga Tao',
  'Show more': 'Ipakita pa',
  'Show less': 'Ipakita nang kaunti',
  'See more': 'Tingnan pa',
  'See less': 'Tingnan nang kaunti',
  'Male': 'Lalaki',
  'Female': 'Babae',
  'Other': 'Iba pa',
  'Notification Settings': 'Mga Setting ng Notipikasyon',
  'Choose what updates you receive': 'Piliin kung anong mga update ang matatanggap mo',
  'Control who can view your profile': 'Piliin kung sino ang makakakita sa profile mo',
  'Location & Distance': 'Lokasyon at Layo',
  'Set your nearby games search preferences': 'Itakda ang paghahanap ng mga larong malapit sa iyo',
  'Language, display, and account options': 'Wika, hitsura, at mga opsyon ng account',
  'Friend requests, accepted requests, and new followers': 'Mga friend request, tinanggap na request, at bagong follower',
  'Join requests, responses, and game updates': 'Mga request sumali, tugon, at update sa laro',
  'New messages and message requests': 'Mga bagong mensahe at request sa mensahe',
  'Likes, comments, story replies, lives, and badges': 'Mga like, komento, tugon sa story, live, at badge',
  'When set to friends only, people who are not your friends cannot open your profile.': 'Kapag mga kaibigan lang ang pinili, hindi mabubuksan ng iba ang profile mo.',
  'Use your current location to find nearby games. Location is only used for search.': 'Gamitin ang kasalukuyang lokasyon para maghanap ng malalapit na laro. Para lang ito sa paghahanap.',
  'You can change the distance any time from the games search filters.': 'Maaari mong palitan ang layo anumang oras sa filters ng paghahanap ng laro.',
  'Check replies and review status from the admin team': 'Tingnan ang mga tugon at status mula sa admin team',
  'Tell us what you need help with. Your message will be sent to the admin inbox.': 'Ikuwento kung anong tulong ang kailangan mo. Ipapadala ang mensahe sa admin inbox.',
  'Your message': 'Mensahe mo',
  'Describe the issue or question...': 'Ilarawan ang problema o tanong…',
  'Send to Admin': 'Ipadala sa Admin',
  'Share a game moment…': 'Ibahagi ang nangyari sa laro…',
  'All updates': 'Lahat ng update',
  'Your circle starts here': 'Dito nagsisimula ang iyong komunidad',
  'You’re all caught up': 'Wala ka nang napalampas',
  'Once a friend request is accepted, their Public and Friends posts appear here.': 'Kapag tinanggap ang friend request, lalabas dito ang mga Public at Friends post nila.',
  'Share a game moment or try another sport to see more updates.': 'Magbahagi ng sandali sa laro o sumubok ng ibang isport para makakita pa ng mga update.',
  'Find friends': 'Maghanap ng mga kaibigan',
  'Create a post': 'Gumawa ng post',
  'Load more posts': 'Mag-load pa ng mga post',
  'Message Requests': 'Mga Request sa Mensahe',
  'Sent': 'Naipadala',
  'Browse all sports': 'Tingnan ang lahat ng isport',
  'GORA players': 'Mga manlalaro sa GORA',
  'No accounts found. Try their username or name.': 'Walang nahanap na account. Subukan ang username o pangalan nila.',
  'Players, sports, games, clubs, places': 'Mga manlalaro, isport, laro, club, lugar',
  'Search in': 'Maghanap sa',
  'My Games': 'Mga Laro Ko',
  'My Clubs': 'Mga Club Ko',
  'Requested': 'Hiniling',
  'Create Games': 'Gumawa ng Laro',
  'Your clubs have nothing that matches your filters.': 'Walang tugma sa mga filter mo sa mga club mo.',
  'Clubs you create or join show up here.': 'Lalabas dito ang mga club na ginawa o sinalihan mo.',
  'No pending requests to private clubs.': 'Wala kang nakabinbing request sa mga pribadong club.',
  'Follow a club to see its posts without joining.': 'I-follow ang club para makita ang mga post nito nang hindi sumasali.',
  'Active': 'Aktibo',
  'Retired': 'Hindi na ginagamit',
  'All sports': 'Lahat ng isport',
  'Your posts': 'Mga post mo',
  'Your friends': 'Mga kaibigan mo',
};

const FILIPINO_PATTERNS: [RegExp, string][] = [
  [/^Search in (.+)$/, 'Maghanap sa $1'],
  [/^Search (.+)$/, 'Maghanap ng $1'],
  [/^No (.+) yet\.$/, 'Wala pang $1.'],
  [/^No upcoming (.+) games(?: any distance)?\.$/, 'Wala pang paparating na $1 laro.'],
  [/^Loading (.+)…$/, 'Naglo-load ng $1…'],
  [/^Loading (.+)\.\.\.$/, 'Naglo-load ng $1…'],
  [/^(.+) km$/, '$1 km'],
  [/^Players (\d+)\/(\d+)$/, 'Mga manlalaro: $1/$2'],
  [/^(\d+) slots? left$/, 'May $1 puwesto pa'],
  [/^Hosted by (.+)$/, 'Host: $1'],
  [/^Today, (.+)$/, 'Ngayon, $1'],
  [/^Tomorrow, (.+)$/, 'Bukas, $1'],
  [/^Registration closes: (.+)$/, 'Magsasara ang pagpaparehistro: $1'],
  [/^Posts from your community · (.+) games within (.+) km$/, 'Mga post mula sa komunidad mo · Mga larong $1 sa loob ng $2 km'],
  [/^Posts from you and your mutual friends · Newest first$/, 'Mga post mo at ng magkakaibigan mo · Pinakabago muna'],
  [/^Finding players…$/, 'Naghahanap ng mga manlalaro…'],
  [/^No results(?: for “(.+)”)?? within (.+)\.$/, 'Walang resulta$1 sa loob ng $2.'],
  [/^(.+) ago$/, '$1 ang nakalipas'],
  [/^(.+) views?$/, '$1 na view'],
  [/^(.+) comments?$/, '$1 na komento'],
  [/^(.+) likes?$/, '$1 na like'],
  [/^(.+) wants to join (.+)\.$/, 'Gustong sumali ni $1 sa $2.'],
  [/^(.+) asked to be removed from (.+)\.$/, 'Humiling si $1 na alisin sa $2.'],
];

type TextTranslation = { original: string; translated: string };
type AttributeTranslation = { element: Element; name: string; original: string; translated: string };
const textTranslations = new WeakMap<Text, TextTranslation>();
const textNodes = new Set<Text>();
const attributeTranslations = new WeakMap<Element, Map<string, TextTranslation>>();
const attributeNodes = new Set<AttributeTranslation>();
let currentLanguage: AppLanguage = 'en';
let activeRoot: Node | null = null;
let observer: MutationObserver | null = null;

function translateEnglish(value: string): string {
  const trimmed = value.trim();
  const direct = FILIPINO[trimmed];
  if (direct) return preserveWhitespace(value, direct);
  for (const [pattern, replacement] of FILIPINO_PATTERNS) {
    if (pattern.test(trimmed)) return preserveWhitespace(value, trimmed.replace(pattern, replacement));
  }
  return value;
}

function preserveWhitespace(original: string, translated: string): string {
  const leading = original.match(/^\s*/)?.[0] ?? '';
  const trailing = original.match(/\s*$/)?.[0] ?? '';
  return `${leading}${translated}${trailing}`;
}

function localizeTextNode(node: Text): void {
  const value = node.nodeValue ?? '';
  const existing = textTranslations.get(node);
  if (existing && value === existing.translated) return;
  if (currentLanguage === 'en') {
    if (existing && value === existing.translated) node.nodeValue = existing.original;
    textTranslations.delete(node);
    textNodes.delete(node);
    return;
  }
  const original = value;
  const translated = translateEnglish(original);
  if (translated === original) return;
  textTranslations.set(node, { original, translated });
  textNodes.add(node);
  node.nodeValue = translated;
}

const LOCALIZED_ATTRIBUTES = ['aria-label', 'placeholder', 'title', 'alt'] as const;

function localizeElement(element: Element): void {
  for (const name of LOCALIZED_ATTRIBUTES) {
    if (!element.hasAttribute(name)) continue;
    const value = element.getAttribute(name) ?? '';
    let values = attributeTranslations.get(element);
    const existing = values?.get(name);
    if (existing && value === existing.translated) continue;
    if (currentLanguage === 'en') {
      if (existing && value === existing.translated) element.setAttribute(name, existing.original);
      values?.delete(name);
      continue;
    }
    const translated = translateEnglish(value);
    if (translated === value) continue;
    if (!values) {
      values = new Map();
      attributeTranslations.set(element, values);
    }
    values.set(name, { original: value, translated });
    attributeNodes.add({ element, name, original: value, translated });
    element.setAttribute(name, translated);
  }
}

function localizeTree(node: Node): void {
  if (node.nodeType === Node.TEXT_NODE) {
    localizeTextNode(node as Text);
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE && node !== activeRoot) return;
  const element = node as Element;
  localizeElement(element);
  for (const child of Array.from(node.childNodes)) localizeTree(child);
}

function restoreEnglish(): void {
  for (const node of textNodes) {
    const saved = textTranslations.get(node);
    if (saved && node.nodeValue === saved.translated) node.nodeValue = saved.original;
    textTranslations.delete(node);
  }
  textNodes.clear();
  for (const entry of attributeNodes) {
    if (entry.element.getAttribute(entry.name) === entry.translated) {
      entry.element.setAttribute(entry.name, entry.original);
    }
  }
  attributeNodes.clear();
}

export function setAppLanguage(language: AppLanguage): void {
  currentLanguage = language;
  document.documentElement.lang = language;
  if (!activeRoot) return;
  if (language === 'en') restoreEnglish();
  else localizeTree(activeRoot);
}

export function installFilipinoLocalization(root: Node): () => void {
  observer?.disconnect();
  activeRoot = root;
  localizeTree(root);
  observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'characterData') localizeTextNode(record.target as Text);
      if (record.type === 'attributes') localizeElement(record.target as Element);
      for (const node of Array.from(record.addedNodes)) localizeTree(node);
    }
  });
  observer.observe(root, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: [...LOCALIZED_ATTRIBUTES],
  });
  return () => {
    observer?.disconnect();
    observer = null;
    activeRoot = null;
    restoreEnglish();
  };
}
