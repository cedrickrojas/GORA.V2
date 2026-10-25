import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { defineComponent } from 'vue';
import LocationPickerModal from '@/components/feed/LocationPickerModal.vue';
import { getCurrentLocation } from '@/services/location.service';
import { useAuthStore } from '@/stores/auth';
import { useCatalogStore } from '@/stores/catalog';
import type { PostLocation } from '@/types/post';

vi.mock('@/services/location.service', () => ({ getCurrentLocation: vi.fn() }));
const reading = vi.mocked(getCurrentLocation);
const point = { latitude: 14.551234, longitude: 121.050987 };
const saved = { name: 'My chosen court', ...point };
const mapStub = defineComponent({
  name: 'LocationMapPicker',
  props: ['center', 'point'],
  emits: ['select'],
  template: '<div class="test-map" />',
});
let wrapper: ReturnType<typeof mount>;
function open(current: PostLocation | null = null) {
  wrapper = mount(LocationPickerModal, {
    props: { isOpen: true, current },
    global: {
      stubs: {
        IonModal: { template: '<div><slot /></div>' },
        IonContent: { template: '<div><slot /></div>' },
        IonIcon: true,
        LocationMapPicker: mapStub,
      },
    },
  });
  return wrapper;
}
async function click(text: string) {
  const button = wrapper.findAll('button').find((button) => button.text().includes(text));
  if (!button) throw new Error(`Missing button ${text}`);
  await button.trigger('click');
}
const submit = () => wrapper.find('form').trigger('submit');
beforeEach(() => {
  setActivePinia(createPinia());
  reading.mockReset();
});
afterEach(() => {
  wrapper?.unmount();
  vi.restoreAllMocks();
});

describe('post location picker', () => {
  test('does not request device location or attach the browsing center on open', async () => {
    open();
    await flushPromises();
    expect(reading).not.toHaveBeenCalled();
    expect(wrapper.find('.location-picker__confirm').attributes('disabled')).toBeDefined();
    await click('Select on map');
    expect(wrapper.findComponent(mapStub).exists()).toBe(true);
    await submit();
    expect(wrapper.emitted('confirm')).toBeUndefined();
  });

  test('reads a precise device point only after a tap and waits for explicit confirmation', async () => {
    reading.mockResolvedValue({ ok: true, point });
    open();
    await click('Use current location');
    await flushPromises();
    expect(reading).toHaveBeenCalledWith(undefined, { precise: true });
    expect(wrapper.emitted('confirm')).toBeUndefined();
    expect(wrapper.findComponent(mapStub).props('point')).toEqual({ name: 'Current location', ...point });
    await wrapper.find('#post-location-name').setValue('  My court  ');
    await submit();
    expect(wrapper.emitted('confirm')).toEqual([[{ name: 'My court', ...point }]]);
  });

  test('accepts map points, rejects invalid coordinates and saves a custom name', async () => {
    open();
    await click('Select on map');
    const map = wrapper.findComponent(mapStub);
    map.vm.$emit('select', { latitude: 95, longitude: 0 });
    await flushPromises();
    expect(wrapper.find('#post-location-name').exists()).toBe(false);
    map.vm.$emit('select', point);
    await flushPromises();
    await wrapper.find('#post-location-name').setValue('Park court');
    map.vm.$emit('select', { latitude: 14.555555, longitude: 121.055555 });
    await flushPromises();
    await submit();
    expect(wrapper.emitted('confirm')).toEqual([[{ name: 'Park court', latitude: 14.555555, longitude: 121.055555 }]]);
  });

  test('restores saved coordinates that are outside the venue catalog without mutating the parent', async () => {
    open(saved);
    await flushPromises();
    expect(wrapper.find('#post-location-name').element).toHaveProperty('value', 'My chosen court');
    await wrapper.find('#post-location-name').setValue('Renamed');
    expect(saved.name).toBe('My chosen court');
    await wrapper.setProps({ isOpen: false });
    await wrapper.setProps({ isOpen: true });
    expect(wrapper.find('#post-location-name').element).toHaveProperty('value', 'My chosen court');
  });

  test.each(['DENIED', 'TIMEOUT', 'UNAVAILABLE', 'UNSUPPORTED'] as const)(
    'handles %s without losing the previous location',
    async (reason) => {
      reading.mockResolvedValue({ ok: false, reason });
      open(saved);
      await click('Use current location');
      await flushPromises();
      expect(wrapper.find('[role=alert]').text()).toMatch(/location|Location/);
      expect(wrapper.find('[role=alert]').text()).not.toContain('games');
      await submit();
      expect(wrapper.emitted('confirm')).toEqual([[saved]]);
    },
  );

  test('ignores a device result from a closed picker after reopening it', async () => {
    let finish!: (value: Awaited<ReturnType<typeof getCurrentLocation>>) => void;
    reading.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    open(saved);
    await click('Use current location');
    await wrapper.setProps({ isOpen: false });
    await wrapper.setProps({ isOpen: true });
    finish({ ok: true, point: { latitude: 1, longitude: 2 } });
    await flushPromises();
    await submit();
    expect(wrapper.emitted('confirm')).toEqual([[saved]]);
  });

  test('selecting a venue cancels a pending device result', async () => {
    let finish!: (value: Awaited<ReturnType<typeof getCurrentLocation>>) => void;
    reading.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    open();
    await flushPromises();
    await click('Use current location');
    const venue = useCatalogStore().locations[0];
    await click(venue.name);
    finish({ ok: true, point });
    await flushPromises();
    await submit();
    expect(wrapper.emitted('confirm')).toEqual([
      [{ name: venue.name, latitude: venue.latitude, longitude: venue.longitude }],
    ]);
  });

  test('an account change closes the picker and discards an old device result', async () => {
    let finish!: (value: Awaited<ReturnType<typeof getCurrentLocation>>) => void;
    reading.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    open(saved);
    await click('Use current location');
    useAuthStore().accessToken = 'different-account';
    finish({ ok: true, point });
    await flushPromises();
    await submit();
    expect(wrapper.emitted('close')).toBeDefined();
    expect(wrapper.emitted('confirm')).toBeUndefined();
  });

  test('moving a known venue pin clears its automatic venue name', async () => {
    open();
    await flushPromises();
    const venue = useCatalogStore().locations[0];
    await click(venue.name);
    await click('Select on map');
    wrapper.findComponent(mapStub).vm.$emit('select', point);
    await flushPromises();
    expect(wrapper.find('#post-location-name').element).toHaveProperty('value', 'Selected location');
    await wrapper.find('#post-location-name').setValue('   ');
    await submit();
    expect(wrapper.emitted('confirm')).toBeUndefined();
  });
});
