import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, expect, test } from 'vitest';
import LocationMapPicker from '@/components/map/LocationMapPicker.vue';

let wrapper: ReturnType<typeof mount>;
afterEach(() => wrapper?.unmount());

test('the map center can be selected without device location permission or an existing pin', async () => {
  const center = { latitude: 14.5995, longitude: 120.9842 };
  wrapper = mount(LocationMapPicker, { props: { center, point: null }, attachTo: document.body });
  expect(wrapper.find('.location-map-picker__crosshair').exists()).toBe(true);
  expect(wrapper.find('.location-map-picker__hint').text()).toContain('Use map center');
  expect(wrapper.emitted('select')).toBeUndefined();
  await wrapper.find('.location-map-picker__center').trigger('click');
  expect(wrapper.emitted('select')).toEqual([[center]]);
  await wrapper.setProps({ point: center });
  await flushPromises();
  expect(wrapper.find('.location-map-picker__crosshair').exists()).toBe(false);
  expect(wrapper.find('.leaflet-marker-draggable').exists()).toBe(true);
});

test('tapping the map creates a selectable point', async () => {
  wrapper = mount(LocationMapPicker, {
    props: { center: { latitude: 14.5995, longitude: 120.9842 }, point: null },
    attachTo: document.body,
  });
  await wrapper.find('.location-map-picker__canvas').trigger('click', { clientX: 100, clientY: 100 });
  expect(wrapper.emitted('select')).toHaveLength(1);
  const point = wrapper.emitted('select')![0][0] as { latitude: number; longitude: number };
  expect(Number.isFinite(point.latitude)).toBe(true);
  expect(Number.isFinite(point.longitude)).toBe(true);
});
