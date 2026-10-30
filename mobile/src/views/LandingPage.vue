<template>
  <ion-page>
    <ion-content class="landing-content">
      <div class="landing">
        <a class="skip-link" href="#main">Skip to content</a>
        <header class="site-header">
          <div class="container header-inner">
            <router-link to="/" class="wordmark" aria-label="GORA home">
              <span class="brand-mark" aria-hidden="true"
                ><span /><span /><span
              /></span>
              {{ GORA_NAME }}<span class="brand-dot">.</span>
            </router-link>
            <nav class="desktop-nav" aria-label="Main navigation">
              <button @click="scrollTo('how-it-works')">How it works</button>
              <button @click="scrollTo('find-a-game')">Find a game</button>
              <button @click="scrollTo('communities')">Communities</button>
            </nav>
            <div class="header-actions">
              <router-link to="/login" class="login-link">Sign in</router-link>
              <router-link to="/register" class="button button-small"
                >Join GORA
                <ion-icon :icon="arrowForwardOutline" aria-hidden="true"
              /></router-link>
            </div>
          </div>
        </header>

        <main id="main" tabindex="-1">
          <section class="hero" aria-labelledby="hero-heading">
            <picture class="hero-backdrop" aria-hidden="true">
              <source
                media="(max-width: 760px)"
                srcset="/images/gora-hoop-small.webp"
              />
              <img
                src="/images/gora-hoop.webp"
                width="1672"
                height="941"
                fetchpriority="high"
                alt=""
              />
            </picture>
            <div class="hero-shade" aria-hidden="true" />
            <div class="container hero-inner">
              <div class="hero-copy">
                <p class="eyebrow">
                  <span class="eyebrow-line" /> LESS SCROLLING. MORE SHOWING UP.
                </p>
                <h1 id="hero-heading">
                  <span class="hero-line">Find your game.</span
                  ><span class="hero-line">Find your <em>people.</em></span>
                </h1>
                <p class="hero-description">
                  Your next pickup game. Your game-day crew. Your kind of
                  people. Bring your love of sport. We?ll help you find the
                  rest.
                </p>
                <div class="hero-actions">
                  <router-link to="/register" class="button"
                    >Find my crew</router-link
                  >
                  <router-link
                    to="/register?redirect=/discover"
                    class="button button-secondary"
                    >Explore games</router-link
                  >
                </div>
                <p class="hero-note">On the court. In the stands. Together.</p>
              </div>
              <div class="hero-caption">
                <span>THE GAME IS BETTER</span
                ><strong>WHEN YOU SHOW UP<br /> TOGETHER.</strong>
              </div>
              <div class="hero-footer">
                <span>PLAY. WATCH. CONNECT.</span
                ><router-link to="/register"
                  >GET IN THE GAME
                  <ion-icon :icon="arrowForwardOutline" aria-hidden="true"
                /></router-link>
              </div>
            </div>
          </section>

          <section
            id="find-a-game"
            class="sports-section"
            aria-label="Explore sports"
          >
            <div class="container sports-inner">
              <p>ONE COMMUNITY.<br /><strong>SO MANY WAYS TO PLAY.</strong></p>
              <div class="sport-options">
                <button
                  v-for="sport in sports"
                  :key="sport.name"
                  :aria-pressed="selectedSport === sport.name"
                  :class="{ selected: selectedSport === sport.name }"
                  @click="selectedSport = sport.name"
                >
                  <ion-icon :icon="sport.icon" aria-hidden="true" />{{
                    sport.name
                  }}
                </button>
              </div>
            </div>
            <div class="container sport-preview" aria-live="polite">
              <div>
                <span class="preview-kicker">ILLUSTRATIVE GAME PREVIEW</span
                ><strong>{{ activeGame.title }}</strong
                ><span
                  >{{ activeGame.place }} ? {{ activeGame.time }} ?
                  {{ activeGame.spots }}</span
                >
              </div>
              <router-link to="/register?redirect=/discover" class="text-link"
                >Explore {{ activeGame.name.toLowerCase() }}
                <ion-icon :icon="arrowForwardOutline" aria-hidden="true"
              /></router-link>
            </div>
          </section>

          <section
            id="why-gora"
            class="benefits container section-space"
            aria-labelledby="benefits-heading"
          >
            <div class="section-heading">
              <div>
                <p class="eyebrow">BUILT FOR THE WAY YOU PLAY</p>
                <h2 id="benefits-heading">
                  Your next game.<br />Your new favorite people.
                </h2>
              </div>
              <p>You bring the energy.<br />GORA helps you find the rest.</p>
            </div>
            <div class="benefit-grid">
              <article class="benefit-card featured-benefit">
                <span class="feature-icon"
                  ><ion-icon :icon="navigateOutline" aria-hidden="true"
                /></span>
                <h3>A game closer than you think.</h3>
                <p>
                  Find games by sport and distance. See the time, place, and
                  open spots before you make a plan.
                </p>
                <div class="mini-map" aria-hidden="true">
                  <span class="map-street street-one" /><span
                    class="map-street street-two"
                  /><span class="map-street street-three" /><span
                    class="map-park"
                  /><span class="map-ring" /><span class="map-pin"
                    ><ion-icon :icon="basketballOutline" /></span
                  ><span class="map-dot dot-one" /><span
                    class="map-dot dot-two"
                  /><span class="map-you">You</span
                  ><span class="map-label">Your next game could be nearby</span>
                </div>
                <router-link to="/register" class="card-link"
                  >Find your game
                  <ion-icon :icon="arrowForwardOutline" aria-hidden="true"
                /></router-link>
              </article>
              <article class="benefit-card">
                <span class="feature-icon"
                  ><ion-icon :icon="peopleOutline" aria-hidden="true"
                /></span>
                <h3>Find your kind of team.</h3>
                <p>
                  Meet players who share your sport. Join a club, build
                  connections, and turn a one-off game into a regular thing.
                </p>
                <div class="mini-club" aria-hidden="true">
                  <span class="club-mark"
                    ><ion-icon :icon="basketballOutline" /></span
                  ><strong>Weekend Court Crew</strong
                  ><span>Basketball · Good vibes, good games</span>
                  <div class="club-chips">
                    <span>Community</span><span>All skill levels</span>
                  </div>
                </div>
                <router-link to="/register" class="card-link"
                  >Meet your people
                  <ion-icon :icon="arrowForwardOutline" aria-hidden="true"
                /></router-link>
              </article>
              <article class="benefit-card">
                <span class="feature-icon"
                  ><ion-icon :icon="calendarOutline" aria-hidden="true"
                /></span>
                <h3>Make “someday” game day.</h3>
                <p>
                  Have a court and a time in mind? Host a game, set your player
                  count, and bring everyone together in one place.
                </p>
                <div class="mini-plan" aria-hidden="true">
                  <div class="plan-date">
                    <small>SAT</small><strong>24</strong>
                  </div>
                  <div>
                    <strong>Your weekend, sorted.</strong
                    ><span>Pick a sport. Set a time. Let’s play.</span
                    ><span class="plan-status"
                      ><ion-icon :icon="checkmarkCircleOutline" /> Game plan:
                      made</span
                    >
                  </div>
                </div>
                <router-link to="/register" class="card-link"
                  >Start something good
                  <ion-icon :icon="arrowForwardOutline" aria-hidden="true"
                /></router-link>
              </article>
            </div>
            <p class="illustration-note">
              Illustrative previews. Actual games and clubs depend on your
              community.
            </p>
          </section>

          <section
            id="how-it-works"
            class="how-section"
            aria-labelledby="how-heading"
          >
            <div class="container section-space">
              <div class="section-heading">
                <div>
                  <p class="eyebrow">FROM “I’M IN” TO GAME ON</p>
                  <h2 id="how-heading">Less planning.<br />More showing up.</h2>
                </div>
                <router-link to="/register" class="text-link"
                  >Let’s get you playing
                  <ion-icon :icon="arrowUpRight" aria-hidden="true"
                /></router-link>
              </div>
              <div class="steps">
                <article v-for="(step, index) in steps" :key="step.title">
                  <div class="step-top">
                    <span class="step-number">0{{ index + 1 }}</span
                    ><span class="step-line" />
                  </div>
                  <h3>{{ step.title }}</h3>
                  <p>{{ step.description }}</p>
                </article>
              </div>
            </div>
          </section>

          <section
            id="communities"
            class="community container section-space"
            aria-labelledby="community-heading"
          >
            <div class="community-art" aria-hidden="true">
              <div class="court-lines">
                <span class="court-center" /><span
                  class="court-key court-key-top"
                /><span class="court-key court-key-bottom" />
              </div>
              <span class="court-word">LET’S<br />PLAY.</span
              ><span class="court-caption"
                ><ion-icon :icon="peopleOutline" /> COMMUNITY FIRST.<br />GAME
                ON.</span
              >
            </div>
            <div class="community-copy">
              <p class="eyebrow">YOU DON’T NEED A WHOLE SQUAD</p>
              <h2 id="community-heading">
                Show up for the sport.<br /><span>Stay for the people.</span>
              </h2>
              <p>
                Getting back into a sport? Just moved to a new city? Or simply
                need a few more players for Saturday?
              </p>
              <p>
                There’s a place for you here. Build a profile around what you
                love, find your community, and make playing part of your week.
              </p>
              <router-link to="/register" class="button"
                >Find your people
                <ion-icon :icon="arrowForwardOutline" aria-hidden="true"
              /></router-link>
            </div>
          </section>

          <section
            id="questions"
            class="faq container section-space"
            aria-labelledby="faq-heading"
          >
            <div class="faq-intro">
              <p class="eyebrow">A FEW THINGS TO KNOW</p>
              <h2 id="faq-heading">Good questions.<br />Straight answers.</h2>
              <p>Your first game starts with feeling at home.</p>
            </div>
            <div class="faq-list">
              <details v-for="question in questions" :key="question.title">
                <summary>
                  {{ question.title
                  }}<span class="faq-plus" aria-hidden="true">+</span>
                </summary>
                <p>{{ question.answer }}</p>
              </details>
            </div>
          </section>

          <section class="final-cta container" aria-labelledby="cta-heading">
            <div class="cta-court" aria-hidden="true" />
            <p class="eyebrow">YOUR NEXT “SEE YOU THERE” STARTS HERE</p>
            <h2 id="cta-heading">
              Your sport.<br />Your people. <span>Let’s go.</span>
            </h2>
            <p>Turn your favorite sport into your next plan.</p>
            <router-link to="/register" class="button button-dark"
              >Get in the game
              <ion-icon :icon="arrowUpRight" aria-hidden="true" /></router-link
            ><span class="cta-note"
              >Create your account. Find your community. Play more.</span
            >
          </section>
        </main>

        <footer class="container site-footer">
          <div>
            <router-link to="/" class="wordmark" aria-label="GORA home">{{
              GORA_NAME
            }}</router-link>
            <p>{{ GORA_TAGLINE }}</p>
          </div>
          <div class="footer-links">
            <button @click="scrollTo('how-it-works')">How it works</button
            ><router-link to="/login">Log in</router-link
            ><router-link to="/register"
              >Join GORA <ion-icon :icon="arrowUpRight" aria-hidden="true"
            /></router-link>
          </div>
          <span class="copyright"
            >© {{ new Date().getFullYear() }} GORA. Made for the love of the
            game.</span
          >
        </footer>
      </div>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { RouterLink } from 'vue-router';
import { IonContent, IonIcon, IonPage } from '@ionic/vue';
import { GORA_NAME, GORA_TAGLINE } from '@/constants/brand';
import {
  arrowForwardOutline,
  arrowUpOutline,
  basketballOutline,
  calendarOutline,
  checkmarkCircleOutline,
  footballOutline,
  gameControllerOutline,
  navigateOutline,
  peopleOutline,
  tennisballOutline,
  walkOutline,
} from 'ionicons/icons';

// Rotate an existing icon instead of adding another icon library.
const arrowUpRight = arrowUpOutline;
const sports = [
  {
    name: 'Esports',
    icon: gameControllerOutline,
    title: 'Weekend squad matches',
    place: 'Online or your local gaming cafe',
    time: 'Saturday · 7:00 PM',
    spots: '2 teammates needed',
  },
  {
    name: 'Basketball',
    icon: basketballOutline,
    title: 'Saturday pickup crew',
    place: 'Neighborhood court',
    time: 'Saturday · 4:00 PM',
    spots: '2 spots to fill',
  },
  {
    name: 'Badminton',
    icon: tennisballOutline,
    title: 'A little friendly doubles',
    place: 'Community sports hall',
    time: 'Sunday · 9:00 AM',
    spots: '1 spot to fill',
  },
  {
    name: 'Volleyball',
    icon: basketballOutline,
    title: 'Weekend volleyball',
    place: 'Community court',
    time: 'Saturday · 3:00 PM',
    spots: '3 spots to fill',
  },
  {
    name: 'Football',
    icon: footballOutline,
    title: 'Sunday five-a-side',
    place: 'Neighborhood turf',
    time: 'Sunday · 4:00 PM',
    spots: '2 spots to fill',
  },
  {
    name: 'Running',
    icon: walkOutline,
    title: 'Easy morning miles',
    place: 'Your local park',
    time: 'Sunday · 6:00 AM',
    spots: 'Room for your pace',
  },
];
const selectedSport = ref('Basketball');
const activeGame = computed(
  () =>
    sports.find((sport) => sport.name === selectedSport.value) ?? sports[0]!,
);
const steps = [
  {
    title: 'Make it yours.',
    description:
      'Create your account and add the sports you love. First-timer, weekend warrior, or seasoned player — start where you are.',
  },
  {
    title: 'Find your next game.',
    description:
      'Explore games near you, check the details, and send a join request. Or host your own and invite people along.',
  },
  {
    title: 'Show up. Connect. Repeat.',
    description:
      'Get out there, meet new people, and keep the connection going through your clubs and community.',
  },
];
const questions = [
  {
    title: 'Do I need to be good at my sport?',
    answer:
      'You don’t need to be a pro to get started. Add your skill level to your profile and read game details to find a group that fits. Everyone starts somewhere.',
  },
  {
    title: 'Can I join without knowing anyone?',
    answer:
      'Absolutely. GORA helps you meet players through games and clubs. Find a game you like, send a join request, and let the host bring the group together.',
  },
  {
    title: 'What if there are no games near me yet?',
    answer:
      'You can be the one who gets things going. Host a game with a location, time, and player count, or create a club and invite friends to build your local community.',
  },
  {
    title: 'Can I organize games for my club?',
    answer:
      'Yes. Active club members can host club games. Clubs also have their own chat, so your community has a place to connect between games.',
  },
  {
    title: 'Do I need to download an app?',
    answer:
      'You can get started right here in your browser, on your phone, tablet, or computer. Create an account and you’re ready to explore.',
  },
];

function scrollTo(id: string): void {
  const target = document.getElementById(id);
  target?.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 'instant'
      : 'smooth',
    block: 'start',
  });
  if (target) {
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  }
}
</script>

<style scoped>
.landing-content {
  --background: var(--ion-background-color);
  --padding-start: 0;
  --padding-end: 0;
}
.landing {
  --accent: var(--ion-color-primary);
  --ink: var(--ion-background-color);
  --white: var(--ion-text-color);
  --muted: var(--gora-muted);
  color: var(--white);
  font-family: var(--ion-font-family);
}
.landing *,
.landing *::before,
.landing *::after {
  box-sizing: border-box;
}
.container {
  width: min(1180px, calc(100% - 96px));
  margin-inline: auto;
}
.landing a {
  text-decoration: none;
}
.landing button {
  color: inherit;
  font: inherit;
  cursor: pointer;
}
.landing a,
.landing button,
.landing summary {
  -webkit-tap-highlight-color: transparent;
}
.landing :is(a, button, summary):focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 6px;
}
.landing section {
  scroll-margin-top: 106px;
}
.landing section:focus,
.landing main:focus {
  outline: none;
}
.skip-link {
  position: absolute;
  top: -70px;
  left: 20px;
  z-index: 50;
  padding: 14px 20px;
  background: var(--accent);
  color: var(--ink);
  border-radius: 8px;
}
.skip-link:focus {
  top: 16px;
}
.site-header {
  position: sticky;
  top: 0;
  z-index: 20;
  background: var(--ion-toolbar-background);
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
}
.header-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 88px;
  gap: 28px;
}
.wordmark {
  color: var(--white);
  font-size: 41px;
  font-weight: 900;
  letter-spacing: -1.8px;
  font-style: italic;
  line-height: 1;
}

.desktop-nav,
.header-actions {
  display: flex;
  align-items: center;
  gap: 30px;
}
.desktop-nav button,
.footer-links button {
  padding: 10px 0;
  border: 0;
  background: transparent;
  color: #bfc6cb;
  font-size: 13px;
  font-weight: 500;
}
.desktop-nav button:hover,
.footer-links button:hover,
.login-link:hover {
  color: var(--accent);
}
.header-actions {
  gap: 26px;
}
.login-link {
  color: var(--white);
  font-size: 13px;
  font-weight: 600;
}
.button {
  display: inline-flex;
  min-height: 54px;
  justify-content: center;
  align-items: center;
  gap: 25px;
  padding: 16px 24px;
  border: 1px solid transparent;
  border-radius: var(--gora-radius-control);
  color: var(--ink);
  background: var(--accent);
  font-size: 14px;
  font-weight: 750;
  transition:
    background 0.18s,
    transform 0.18s;
}
.button:hover {
  background: var(--ion-color-primary-tint);
  transform: translateY(-2px);
}
.button ion-icon {
  width: 19px;
  height: 19px;
}
.button-small {
  min-height: 43px;
  padding: 11px 18px;
  gap: 20px;
  font-size: 13px;
}
.button-small ion-icon,
.text-link ion-icon,
.button-dark ion-icon,
.footer-links ion-icon {
  transform: rotate(45deg);
}

.eyebrow {
  margin: 0 0 22px;
  color: var(--accent);
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 1.8px;
  line-height: 1.7;
}

.live-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
  flex-shrink: 0;
}
h1 {
  margin: 0;
  font-size: clamp(44px, 4.65vw, 67px);
  font-weight: 850;
  letter-spacing: -2.8px;
  line-height: 1.07;
}
h1 span {
  color: var(--accent);
}

.text-button {
  display: inline-flex;
  gap: 9px;
  align-items: center;
  padding: 10px 0;
  border: 0;
  background: none;
  font-size: 12px !important;
  font-weight: 650 !important;
}
.text-button:hover {
  color: var(--accent);
}
.play-icon {
  display: grid;
  place-items: center;
  width: 27px;
  height: 27px;
  border: 1px solid #4b5660;
  border-radius: 50%;
}
.play-icon ion-icon {
  width: 9px;
  margin-left: 2px;
}

.note-line {
  width: 28px;
  height: 1px;
  background: #596773;
}

.sport-icon {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  background: var(--accent);
  color: var(--ink);
  border-radius: 9px;
  font-size: 23px;
  flex-shrink: 0;
}

.open-tag {
  margin-left: auto;
  padding: 5px 6px;
  border-radius: 4px;
  background: rgba(var(--ion-color-primary-rgb), 0.1);
  color: var(--accent);
  font-size: 8px;
  white-space: nowrap;
}

.avatar {
  display: grid;
  place-items: center;
  width: 25px;
  height: 25px;
  border: 2px solid var(--gora-surface);
  border-radius: 50%;
  font-size: 9px;
  font-weight: 700;
}
.avatar + .avatar {
  margin-left: -6px;
}
.avatar-one {
  background: #cbb9a0;
  color: #403128;
}
.avatar-two {
  background: #b5c3b2;
  color: #2c4627;
}
.avatar-three {
  background: #879cac;
  color: #182b3b;
}

.sports-section {
  border-block: 1px solid #22303b;
}
.sports-inner {
  display: flex;
  align-items: center;
  gap: 45px;
  padding-block: 25px;
}
.sports-inner > p {
  margin: 0;
  color: #86939e;
  font-size: 8px;
  letter-spacing: 1.1px;
  line-height: 1.8;
  flex-shrink: 0;
}
.sports-inner strong {
  color: #bdc7cc;
  font-weight: 600;
}
.sport-options {
  display: flex;
  flex: 1;
  justify-content: space-between;
  gap: 10px;
}
.sport-options button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 43px;
  padding: 9px 13px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: none;
  color: #bcc7ce;
  font-size: 12px;
  white-space: nowrap;
}
.sport-options ion-icon {
  font-size: 20px;
}
.sport-options button:hover {
  background: #132331;
}
.sport-options button.selected {
  border-color: var(--gora-accent-line);
  background: var(--gora-accent-soft);
  color: var(--accent);
}
.section-space {
  padding-block: 82px;
}
.section-heading {
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: 25px;
  margin-bottom: 36px;
}
.section-heading .eyebrow,
.community .eyebrow,
.faq .eyebrow {
  margin-bottom: 14px;
}
h2 {
  margin: 0;
  font-size: clamp(30px, 3vw, 43px);
  font-weight: 750;
  letter-spacing: -1.6px;
  line-height: 1.15;
}
.section-heading > p {
  margin: 0 0 2px;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.8;
}
.benefit-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18px;
}
.benefit-card {
  display: flex;
  flex-direction: column;
  align-items: start;
  padding: 28px 24px 23px;
  border: 1px solid #25333f;
  border-radius: var(--gora-radius-card);
  background: var(--gora-surface);
}
.featured-benefit {
  background: var(--gora-surface);
  border-color: var(--gora-accent-line);
}
.feature-icon {
  display: grid;
  place-items: center;
  width: 37px;
  height: 37px;
  margin-bottom: 23px;
  border: 1px solid #34434b;
  border-radius: 9px;
  color: var(--accent);
  font-size: 21px;
}
.benefit-card h3 {
  max-width: 235px;
  margin: 0 0 11px;
  font-size: 22px;
  font-weight: 650;
  line-height: 1.25;
  letter-spacing: -0.7px;
}
.benefit-card > p {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.8;
  min-height: 66px;
}
.mini-map {
  position: relative;
  width: 100%;
  height: 142px;
  margin-block: 24px;
  overflow: hidden;
  background: var(--gora-surface-raised);
  border: 1px solid #344442;
  border-radius: 8px;
}
.map-street {
  position: absolute;
  background: #303134;
  border-inline: 1px solid #48494c;
}
.street-one {
  width: 18px;
  height: 220px;
  left: 60px;
  top: -35px;
  transform: rotate(30deg);
}
.street-two {
  width: 15px;
  height: 340px;
  left: 160px;
  top: -90px;
  transform: rotate(76deg);
}
.street-three {
  width: 12px;
  height: 250px;
  left: 220px;
  top: -30px;
  transform: rotate(20deg);
}
.map-park {
  position: absolute;
  width: 62px;
  height: 38px;
  background: #373032;
  border-radius: 7px;
  top: 10px;
  right: 17px;
  transform: rotate(15deg);
}
.map-ring {
  position: absolute;
  width: 115px;
  height: 115px;
  left: 50%;
  top: 42%;
  border: 1px solid rgba(var(--ion-color-primary-rgb), 0.22);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  background: rgba(var(--ion-color-primary-rgb), 0.025);
}
.map-pin {
  position: absolute;
  display: grid;
  place-items: center;
  left: 54%;
  top: 18px;
  width: 35px;
  height: 35px;
  background: var(--accent);
  color: #101113;
  border: 4px solid #754532;
  border-radius: 50%;
  font-size: 20px;
}
.map-dot {
  position: absolute;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent);
}
.dot-one {
  top: 35px;
  left: 22px;
}
.dot-two {
  right: 23px;
  bottom: 40px;
}
.map-you {
  position: absolute;
  top: 71px;
  left: 37%;
  color: #d4ddd5;
  font-size: 9px;
}
.map-you::before {
  content: '';
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #b7d3ff;
  margin-right: 4px;
}
.map-label {
  position: absolute;
  inset: auto 0 0;
  padding: 8px;
  background: #1b1c1f;
  font-size: 8px;
  color: #aab3bf;
  text-align: center;
}
.mini-club {
  display: grid;
  width: 100%;
  height: 142px;
  place-items: center;
  align-content: center;
  gap: 7px;
  margin-block: 24px;
  background: var(--gora-surface-raised);
  border: 1px solid var(--gora-line);
  border-radius: 8px;
}
.club-mark {
  display: grid;
  place-items: center;
  width: 37px;
  height: 37px;
  border-radius: 50%;
  background: var(--gora-accent-soft);
  color: var(--accent);
  font-size: 23px;
}
.mini-club > strong {
  font-size: 11px;
}
.mini-club > span:not(.club-mark) {
  color: #9cacb8;
  font-size: 8px;
}
.club-chips {
  display: flex;
  gap: 6px;
  margin-top: 2px;
}
.club-chips span {
  background: var(--gora-surface-raised);
  color: #aebdc7;
  padding: 4px 7px;
  font-size: 7px;
  border-radius: 3px;
}
.mini-plan {
  display: flex;
  align-items: center;
  width: 100%;
  height: 142px;
  gap: 12px;
  margin-block: 24px;
  padding: 13px;
  background: var(--gora-surface-raised);
  border: 1px solid var(--gora-line);
  border-radius: 8px;
}
.plan-date {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  width: 49px;
  padding: 10px;
  border: 1px solid var(--gora-accent-line);
  border-radius: 6px;
  background: var(--gora-surface);
}
.plan-date small {
  font-size: 8px;
  color: var(--accent);
}
.plan-date strong {
  font-size: 27px;
  font-weight: 650;
}
.mini-plan > div:last-child {
  display: grid;
  gap: 8px;
}
.mini-plan > div:last-child > strong {
  font-size: 10px;
}
.mini-plan > div:last-child > span {
  font-size: 8px;
  color: #aabac4;
}
.plan-status {
  display: flex;
  gap: 4px;
  align-items: center;
  color: var(--accent) !important;
}
.plan-status ion-icon {
  font-size: 12px;
}
.card-link {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  margin-top: auto;
  color: var(--accent);
  font-size: 11px;
  font-weight: 650;
}
.card-link:hover {
  color: #efffb1;
}
.card-link ion-icon {
  font-size: 15px;
}
.illustration-note {
  margin: 12px 0 0;
  color: #91a0ab;
  font-size: 9px;
}
.how-section {
  border-block: 1px solid #22303b;
  background: var(--gora-surface);
}
.text-link {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 8px 0;
  color: var(--accent);
  font-size: 12px;
  font-weight: 650;
}
.steps {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 44px;
  margin-top: 46px;
}
.step-top {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 25px;
}
.step-number {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border: 1px solid #35463b;
  border-radius: 50%;
  color: var(--accent);
  font-size: 13px;
}
.step-line {
  flex: 1;
  height: 1px;
  background: #2b3b45;
}
.steps article:last-child .step-line {
  background: linear-gradient(90deg, #2b3b45, transparent);
}
.steps h3 {
  margin: 0 0 12px;
  font-size: 19px;
  letter-spacing: -0.4px;
  font-weight: 650;
}
.steps p {
  max-width: 280px;
  margin: 0;
  font-size: 12px;
  line-height: 1.9;
  color: var(--muted);
}
.community {
  display: grid;
  grid-template-columns: 0.95fr 1fr;
  gap: 85px;
  align-items: center;
}
.community-art {
  position: relative;
  min-height: 340px;
  overflow: hidden;
  border-radius: var(--gora-radius-card);
  border: 1px solid var(--gora-line);
  background: #141e28;
}
.court-lines {
  position: absolute;
  inset: 22px 30px;
  border: 2px solid #909398;
  opacity: 0.2;
}
.court-lines::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 2px;
  background: #909398;
}
.court-center {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 150px;
  height: 150px;
  border: 2px solid #909398;
  border-radius: 50%;
  transform: translate(-50%, -50%);
}
.court-key {
  position: absolute;
  left: 50%;
  width: 170px;
  height: 90px;
  border: 2px solid #909398;
  transform: translateX(-50%);
}
.court-key-top {
  top: -1px;
}
.court-key-bottom {
  bottom: -1px;
}
.court-word {
  position: absolute;
  top: 61px;
  left: 36px;
  font-size: 86px;
  line-height: 0.94;
  font-weight: 900;
  font-style: italic;
  letter-spacing: -5px;
  color: var(--accent);
}
.court-caption {
  display: flex;
  align-items: center;
  gap: 9px;
  position: absolute;
  right: 20px;
  bottom: 31px;
  padding: 16px 18px;
  border-radius: 6px;
  border-left: 2px solid var(--accent);
  background: var(--gora-surface);
  color: var(--white);
  font-size: 10px;
  line-height: 1.3;
  font-weight: 850;
}
.court-caption ion-icon {
  font-size: 24px;
}
.community h2 {
  font-size: clamp(30px, 2.8vw, 39px);
  line-height: 1.2;
}
.community h2 span {
  color: var(--accent);
}
.community-copy > p:not(.eyebrow) {
  margin: 20px 0 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.85;
}
.community .button {
  margin-top: 24px;
}
.faq {
  display: grid;
  grid-template-columns: 0.8fr 1.2fr;
  gap: 80px;
  border-top: 1px solid #22303b;
}
.faq-intro > p:last-child {
  margin: 20px 0 0;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.8;
}
.faq-list {
  border-top: 1px solid #293844;
}
.faq details {
  border-bottom: 1px solid #293844;
}
.faq summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  padding: 22px 0;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  list-style: none;
}
.faq summary::-webkit-details-marker {
  display: none;
}
.faq-plus {
  display: inline-block;
  color: var(--accent);
  font-size: 23px;
  font-weight: 400;
  transition: transform 0.2s;
}
.faq details[open] .faq-plus {
  transform: rotate(45deg);
}
.faq details > p {
  padding: 0 30px 23px 0;
  margin: 0;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.9;
}
.final-cta {
  position: relative;
  padding: 58px 50px 48px;
  overflow: hidden;
  border-radius: var(--gora-radius-card);
  border: 1px solid var(--gora-accent-line);
  background: var(--gora-surface);
  color: var(--white);
  text-align: center;
}
.final-cta > :not(.cta-court) {
  position: relative;
}
.final-cta .eyebrow {
  color: var(--accent);
  margin-bottom: 20px;
  font-size: 9px;
}
.final-cta h2 {
  font-size: clamp(39px, 4.5vw, 64px);
  font-weight: 850;
  letter-spacing: -2.5px;
  line-height: 1.06;
}
.final-cta h2 span {
  color: var(--accent);
}
.final-cta > p:not(.eyebrow) {
  margin: 20px 0 25px;
  color: var(--muted);
  font-size: 14px;
}
.button-dark {
  background: var(--accent);
  color: var(--ink);
}
.button-dark:hover {
  background: var(--ion-color-primary-tint);
}
.cta-note {
  display: block;
  margin-top: 15px;
  color: var(--muted);
  font-size: 9px;
}
.cta-court {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 1020px;
  height: 720px;
  border: 1px solid var(--gora-line);
  border-radius: 50%;
  transform: translate(-50%, -50%);
}
.cta-court::before {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 480px;
  height: 480px;
  content: '';
  border: 1px solid var(--gora-line);
  border-radius: 50%;
  transform: translate(-50%, -50%);
}
.site-footer {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  row-gap: 35px;
  padding-block: 50px 25px;
}
.site-footer .wordmark {
  font-size: 35px;
}
.site-footer p {
  margin: 10px 0 0;
  color: #9aa8b2;
  font-size: 10px;
}
.footer-links {
  display: flex;
  align-items: center;
  gap: 27px;
}
.footer-links :is(a, button) {
  color: #b6c0c7;
  font-size: 11px;
}
.footer-links a:last-child {
  color: var(--accent);
  display: flex;
  align-items: center;
  gap: 7px;
}
.copyright {
  grid-column: 1 / -1;
  padding-top: 20px;
  border-top: 1px solid #22303b;
  color: #8b9ba8;
  font-size: 9px;
}
@media (min-width: 1450px) {
}
@media (max-width: 1100px) {
  .container {
    width: calc(100% - 64px);
  }

  h1 {
    font-size: 53px;
    letter-spacing: -3px;
  }

  .sports-inner {
    gap: 23px;
  }
  .sport-options {
    gap: 2px;
  }
  .sport-options button {
    font-size: 10px;
    padding-inline: 8px;
  }
  .benefit-card {
    padding: 25px 18px 20px;
  }
  .mini-plan {
    gap: 7px;
    padding-inline: 8px;
  }
  .plan-date {
    width: 41px;
  }
  .community {
    gap: 50px;
  }
  .faq {
    gap: 45px;
  }
}
@media (max-width: 920px) {
  .container {
    width: calc(100% - 40px);
  }
  .header-inner {
    height: 72px;
    gap: 16px;
  }
  .wordmark {
    font-size: 36px;
  }
  .desktop-nav {
    display: none;
  }
  .header-actions {
    gap: 18px;
  }
  .button-small {
    min-height: 39px;
    padding: 9px 14px;
    font-size: 12px;
    gap: 10px;
  }
  .login-link {
    font-size: 12px;
  }

  h1 {
    font-size: clamp(38px, 8.8vw, 64px);
    letter-spacing: -2.5px;
  }

  .sports-inner {
    display: block;
    padding-block: 23px 18px;
  }
  .sports-inner > p {
    font-size: 8px;
    margin-bottom: 12px;
  }
  .sports-inner > p br {
    display: none;
  }
  .sports-inner > p strong {
    margin-left: 5px;
  }
  .sport-options {
    flex-wrap: wrap;
    justify-content: start;
    gap: 6px;
  }
  .sport-options button {
    font-size: 11px;
    padding: 9px 13px;
    min-height: 40px;
    border-color: #24333d;
  }
  .sport-options ion-icon {
    font-size: 17px;
  }
  .section-space {
    padding-block: 54px;
  }
  .section-heading {
    align-items: start;
    flex-direction: column;
    gap: 18px;
    margin-bottom: 26px;
  }
  h2 {
    font-size: 34px;
    letter-spacing: -1.2px;
  }
  .section-heading > p br {
    display: none;
  }
  .benefit-grid {
    grid-template-columns: 1fr;
    gap: 15px;
  }
  .benefit-card {
    padding: 25px;
  }
  .benefit-card h3 {
    max-width: none;
    font-size: 23px;
  }
  .benefit-card > p {
    max-width: 490px;
    min-height: 0;
    font-size: 13px;
  }
  .feature-icon {
    margin-bottom: 17px;
  }
  .mini-map,
  .mini-club,
  .mini-plan {
    height: 152px;
    margin-block: 21px;
  }
  .mini-plan {
    justify-content: center;
    gap: 20px;
  }
  .mini-plan > div:last-child > strong {
    font-size: 12px;
  }
  .mini-plan > div:last-child > span {
    font-size: 10px;
  }
  .plan-date {
    width: 55px;
  }
  .mini-club > strong {
    font-size: 13px;
  }
  .mini-club > span:not(.club-mark) {
    font-size: 10px;
  }
  .club-chips span {
    font-size: 9px;
  }
  .card-link {
    font-size: 12px;
  }
  .steps {
    grid-template-columns: 1fr;
    gap: 28px;
    margin-top: 28px;
  }
  .step-top {
    margin-bottom: 16px;
  }
  .steps h3 {
    font-size: 21px;
  }
  .steps p {
    max-width: 490px;
    font-size: 13px;
  }
  .community {
    grid-template-columns: 1fr;
    gap: 42px;
  }
  .community-art {
    min-height: 300px;
    margin-inline: 8px;
  }
  .court-word {
    font-size: 80px;
    top: 42px;
  }
  .community h2 {
    font-size: 34px;
  }
  .faq {
    grid-template-columns: 1fr;
    gap: 30px;
  }
  .faq summary {
    padding-block: 21px;
  }
  .faq details > p {
    font-size: 13px;
  }
  .final-cta {
    padding: 43px 20px 37px;
  }
  .final-cta h2 {
    font-size: clamp(36px, 8.3vw, 57px);
    letter-spacing: -1.8px;
  }
  .final-cta .eyebrow {
    font-size: 8px;
    letter-spacing: 1px;
  }
  .final-cta > p:not(.eyebrow) {
    font-size: 12px;
  }
  .site-footer {
    gap: 25px;
    padding-top: 36px;
  }
  .footer-links {
    gap: 14px;
  }
  .footer-links :is(a, button) {
    font-size: 9px;
  }
  .landing section {
    scroll-margin-top: 85px;
  }
}
@media (max-width: 380px) {
  .container {
    width: calc(100% - 32px);
  }
  .header-actions {
    gap: 13px;
  }
  h1 {
    font-size: 35px;
  }

  .text-button {
    font-size: 10px !important;
  }

  .community h2 {
    font-size: 29px;
  }
  .site-footer {
    grid-template-columns: 1fr;
  }
  .copyright {
    grid-column: 1;
  }
  .footer-links {
    justify-content: space-between;
  }
  .footer-links :is(a, button) {
    font-size: 11px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .landing *,
  .landing *::before,
  .landing *::after {
    transition: none !important;
    scroll-behavior: auto !important;
  }
  .button:hover {
    transform: none;
  }
}

/* The reference uses a single cinematic hero rather than a floating app mockup. */
.container {
  width: min(1500px, 80%);
}
.site-header {
  background: #101113;
}
.header-inner {
  height: 104px;
}
.wordmark {
  display: inline-flex;
  align-items: center;
  font-size: 43px;
  letter-spacing: -1.8px;
  gap: 0;
}
.brand-dot {
  color: var(--accent);
}
.brand-mark {
  display: inline-flex;
  align-items: flex-end;
  gap: 3px;
  margin-right: 20px;
  transform: skew(-20deg);
}
.brand-mark span {
  display: block;
  width: 5px;
  height: 32px;
  background: var(--accent);
}
.brand-mark span:nth-child(2) {
  height: 24px;
}
.brand-mark span:nth-child(3) {
  height: 17px;
}
.button {
  min-height: 56px;
  padding: 17px 26px;
  border-radius: 5px;
  color: white;
  font-size: 14px;
}
.button-small {
  min-height: 52px;
  padding: 14px 23px;
  gap: 15px;
}
.button-small ion-icon {
  transform: none;
}
.hero {
  position: relative;
  overflow: hidden;
  background: #101113;
}
.hero-backdrop,
.hero-shade {
  position: absolute;
  inset: 0;
}
.hero-backdrop {
  display: block;
}
.hero-backdrop img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 43%;
}
.hero-shade {
  background:
    linear-gradient(
      90deg,
      #101113 0%,
      rgba(16, 17, 19, 0.97) 26%,
      rgba(16, 17, 19, 0.72) 43%,
      rgba(16, 17, 19, 0.15) 70%
    ),
    linear-gradient(0deg, #101113 0%, transparent 24%);
}
.hero-inner {
  position: relative;
  min-height: 740px;
  padding-top: 92px;
  padding-bottom: 120px;
}
.hero-copy {
  max-width: 960px;
}
.hero .eyebrow {
  display: flex;
  align-items: center;
  gap: 11px;
  margin-bottom: 36px;
  font-size: 11px;
  letter-spacing: 2px;
}
.eyebrow-line {
  width: 22px;
  height: 2px;
  background: var(--accent);
  flex-shrink: 0;
}
.hero h1 {
  margin: 0;
  font-family: 'Gora Condensed', Impact, 'Arial Narrow', sans-serif;
  font-size: clamp(64px, 6.2vw, 112px);
  font-weight: 800;
  font-style: italic;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  line-height: 1.07;
}
.hero-line {
  display: block;
  color: var(--white);
  white-space: nowrap;
}
.hero h1 em {
  color: var(--accent);
  font-style: inherit;
}
.hero-description {
  max-width: 480px;
  margin: 31px 0 34px;
  color: #c4c5ca;
  font-size: 16px;
  line-height: 1.85;
}
.hero-actions {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}
.hero-actions .button {
  min-width: 176px;
  min-height: 60px;
}
.button-secondary {
  border: 1px solid #38393d;
  background: #242529;
  color: var(--white);
}
.button-secondary:hover {
  background: #303136;
}
.hero-note {
  margin: 27px 0 0 24px;
  color: #94969f;
  font-size: 11px;
}
.hero-caption {
  position: absolute;
  right: 0;
  bottom: 155px;
  max-width: 238px;
  padding-left: 20px;
  border-left: 2px solid var(--accent);
}
.hero-caption span {
  display: block;
  margin-bottom: 12px;
  color: #bfc2c9;
  font-size: 9px;
  letter-spacing: 2px;
}
.hero-caption strong {
  font-size: 14px;
  font-weight: 800;
  line-height: 1.65;
}
.hero-footer {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  min-height: 78px;
  border-top: 1px solid var(--gora-line);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
}
.hero-footer > span {
  color: #9699a2;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 3.5px;
}
.hero-footer a {
  display: flex;
  gap: 11px;
  align-items: center;
  color: var(--white);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1.8px;
}
.hero-footer a:hover {
  color: var(--accent);
}
.sport-preview {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
  padding-block: 22px;
  border-top: 1px solid var(--gora-line);
}
.sport-preview > div {
  display: grid;
  gap: 7px;
}
.preview-kicker {
  color: var(--accent);
  font-size: 8px;
  font-weight: 750;
  letter-spacing: 1.5px;
}
.sport-preview strong {
  font-size: 15px;
}
.sport-preview > div > span:last-child {
  color: var(--muted);
  font-size: 11px;
  line-height: 1.8;
}
.sport-preview .text-link ion-icon {
  transform: none;
}
.benefit-card {
  border-color: var(--gora-line);
}
.featured-benefit {
  border-color: var(--gora-accent-line);
}
.final-cta h2 {
  font-family: 'Gora Condensed', Impact, 'Arial Narrow', sans-serif;
  font-style: italic;
  text-transform: uppercase;
  font-size: clamp(46px, 5vw, 76px);
  letter-spacing: 0.3px;
}
@media (min-width: 1750px) {
  .hero-inner {
    min-height: 795px;
    padding-top: 105px;
  }
  .hero-description {
    max-width: 520px;
    font-size: 17px;
  }
}
@media (max-width: 1100px) {
  .container {
    width: calc(100% - 64px);
  }
  .hero h1 {
    font-size: 76px;
  }
  .hero-copy {
    max-width: 750px;
  }
  .hero-caption {
    max-width: 200px;
  }
  .header-inner {
    height: 92px;
  }
  .desktop-nav {
    gap: 20px;
  }
}
@media (max-width: 920px) {
  .container {
    width: calc(100% - 40px);
  }
  .header-inner {
    height: 76px;
  }
  .wordmark {
    font-size: 31px;
  }
  .brand-mark {
    margin-right: 12px;
    gap: 2px;
  }
  .brand-mark span {
    width: 4px;
    height: 24px;
  }
  .brand-mark span:nth-child(2) {
    height: 18px;
  }
  .brand-mark span:nth-child(3) {
    height: 12px;
  }
  .hero h1 {
    font-size: clamp(55px, 9vw, 80px);
  }
  .hero-inner {
    min-height: 720px;
    padding-top: 70px;
  }
  .hero .eyebrow {
    font-size: 9px;
  }
  .hero-description {
    max-width: 430px;
    font-size: 15px;
  }
  .hero-caption {
    bottom: 113px;
  }
  .hero-shade {
    background:
      linear-gradient(
        90deg,
        rgba(16, 17, 19, 0.99),
        rgba(16, 17, 19, 0.75) 45%,
        rgba(16, 17, 19, 0.3)
      ),
      linear-gradient(0deg, #101113, transparent 60%);
  }
  .button-small {
    min-height: 43px;
    padding: 11px 16px;
    font-size: 12px;
  }
  .header-actions {
    gap: 16px;
  }
  .hero-footer {
    min-height: 70px;
  }
}
@media (max-width: 600px) {
  .hero-inner {
    min-height: 720px;
    padding-top: 62px;
    padding-bottom: 135px;
  }
  .hero h1 {
    font-size: clamp(45px, 11vw, 64px);
    line-height: 1.09;
    letter-spacing: 0;
  }
  .hero-line {
    white-space: normal;
  }
  .hero-copy {
    max-width: 100%;
  }
  .hero .eyebrow {
    font-size: 8px;
    letter-spacing: 1.3px;
    margin-bottom: 26px;
  }
  .hero-description {
    margin-block: 26px;
    font-size: 14px;
    max-width: 330px;
  }
  .hero-actions {
    gap: 10px;
  }
  .hero-actions .button {
    min-width: 0;
    flex: 1;
    min-height: 52px;
    padding-inline: 14px;
    font-size: 12px;
  }
  .hero-note {
    margin-left: 0;
    font-size: 10px;
  }
  .hero-caption {
    right: 0;
    bottom: 105px;
    max-width: none;
    padding-left: 14px;
  }
  .hero-caption span {
    font-size: 8px;
    margin-bottom: 7px;
  }
  .hero-caption strong {
    font-size: 11px;
  }
  .hero-backdrop img {
    object-position: 64% center;
    opacity: 0.75;
  }
  .hero-shade {
    background:
      linear-gradient(
        90deg,
        rgba(16, 17, 19, 0.94),
        rgba(16, 17, 19, 0.68) 60%,
        rgba(16, 17, 19, 0.42)
      ),
      linear-gradient(0deg, #101113 0%, transparent 50%);
  }
  .hero-footer > span {
    font-size: 8px;
    letter-spacing: 1.9px;
  }
  .hero-footer a {
    font-size: 8px;
    letter-spacing: 1px;
  }
  .sport-preview {
    align-items: start;
    flex-direction: column;
    gap: 14px;
  }
  .sport-preview .text-link {
    font-size: 11px;
  }
  .hero-caption br {
    display: none;
  }
}
@media (max-width: 380px) {
  .container {
    width: calc(100% - 32px);
  }
  .wordmark {
    font-size: 27px;
  }
  .brand-mark {
    margin-right: 9px;
  }
  .header-actions {
    gap: 12px;
  }
  .button-small {
    padding-inline: 12px;
    font-size: 11px;
    gap: 8px;
  }
  .login-link {
    font-size: 11px;
  }
  .hero .eyebrow {
    font-size: 7px;
  }
  .hero h1 {
    font-size: 44px;
  }
  .hero-caption {
    left: 0;
    right: auto;
  }
  .hero-inner {
    min-height: 735px;
  }
}
</style>
