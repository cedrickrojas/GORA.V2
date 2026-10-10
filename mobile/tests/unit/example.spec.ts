import { flushPromises, mount } from '@vue/test-utils';
import { IonicVue } from '@ionic/vue';
import { createPinia } from 'pinia';
import { describe, expect, test, vi } from 'vitest';
import { routerKey } from 'vue-router';
import HomePage from '@/views/HomePage.vue';

describe('HomePage.vue', () => {
  test('renders only active stories and the social newsfeed', async () => {
    const wrapper = mount(HomePage, {
      global: {
        plugins: [IonicVue, createPinia()],
        stubs: { RouterLink: { template: '<a><slot /></a>' } },
        provide: { [routerKey as symbol]: { push: vi.fn() } },
      },
    });

    await flushPromises();

    const text = wrapper.text();
    expect(text).toContain('GORA');
    expect(text).toContain('Your Story');
    expect(text).toContain('john');
    expect(text).toContain('maria');
    expect(text).toContain('alex');
    expect(text).toContain('mark');
    expect(text).not.toContain('sam');

    expect(text).toContain('Share a game moment');
    expect(text).toContain('posted a game');
    expect(text).toContain('Looking for players tonight!');
    expect(text).toContain('3/12');
    expect(text).toContain('shared a reel');
    expect(text).toContain('unlocked the Social Player badge');
  });
});
