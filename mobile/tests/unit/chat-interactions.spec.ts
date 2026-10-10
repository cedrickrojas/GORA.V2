import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { defineComponent, nextTick, ref } from 'vue';
import ChatComposer from '@/components/chat/ChatComposer.vue';
import MessageBubble from '@/components/chat/MessageBubble.vue';
import { useChatKeyboard } from '@/composables/useChatKeyboard';

const wrappers: VueWrapper[] = [];
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function bubble() {
  const wrapper = mount(MessageBubble, {
    attachTo: document.body,
    props: { senderName: 'Alice', body: 'Hello!', sentAt: '2026-10-10T12:00:00Z', now: Date.now(), mine: false, canReact: true },
  });
  wrappers.push(wrapper);
  return wrapper;
}
const dialog = () => document.querySelector('[role="dialog"]');

describe('message reactions', () => {
  test('holding opens the picker; quick taps and scrolling do not', async () => {
    vi.useFakeTimers();
    const wrapper = bubble();
    const content = wrapper.get('.message-bubble__content');
    await content.trigger('pointerdown', { button: 0, clientX: 20, clientY: 20 });
    await content.trigger('pointerup');
    await vi.advanceTimersByTimeAsync(500);
    expect(dialog()).toBeNull();
    await content.trigger('pointerdown', { button: 0, clientX: 20, clientY: 20 });
    await content.trigger('pointermove', { clientX: 20, clientY: 45 });
    await vi.advanceTimersByTimeAsync(500);
    expect(dialog()).toBeNull();
    await content.trigger('pointerdown', { button: 0, clientX: 20, clientY: 20 });
    await vi.advanceTimersByTimeAsync(450);
    expect(dialog()).not.toBeNull();
    expect(dialog()?.querySelectorAll('[aria-pressed]')).toHaveLength(6);
  });

  test('right click and keyboard open reactions; Escape restores focus', async () => {
    const wrapper = bubble();
    await wrapper.get('.message-bubble__content').trigger('contextmenu');
    expect(dialog()).not.toBeNull();
    dialog()?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await nextTick();
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(wrapper.get('.message-bubble__content').element);
    await wrapper.get('.message-bubble__content').trigger('keydown', { key: 'Enter' });
    expect(dialog()).not.toBeNull();
  });

  test('chooses, changes, and removes the viewer reaction', async () => {
    const wrapper = bubble();
    await wrapper.get('.message-bubble__add').trigger('click');
    (dialog()?.querySelector('[aria-label="Love"]') as HTMLButtonElement).click();
    await nextTick();
    expect(wrapper.emitted('react')?.[0]).toEqual(['❤️']);
    await wrapper.setProps({ reactions: [{ emoji: '❤️', count: 2, reacted: true }] });
    expect(wrapper.get('.message-bubble__reactions button').attributes('aria-pressed')).toBe('true');
    await wrapper.get('.message-bubble__add').trigger('click');
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Love');
    (dialog()?.querySelector('[aria-label="Love"]') as HTMLButtonElement).click();
    await nextTick();
    expect(wrapper.emitted('react')?.[1]).toEqual([null]);
    await wrapper.get('.message-bubble__add').trigger('click');
    (dialog()?.querySelector('[aria-label="Haha"]') as HTMLButtonElement).click();
    await nextTick();
    expect(wrapper.emitted('react')?.[2]).toEqual(['😂']);
  });

  test('pending reactions and message requests cannot open the picker', async () => {
    const wrapper = bubble();
    await wrapper.setProps({ busy: true });
    await wrapper.get('.message-bubble__content').trigger('contextmenu');
    expect(dialog()).toBeNull();
    await wrapper.setProps({ busy: false, canReact: false });
    await wrapper.get('.message-bubble__content').trigger('keydown', { key: 'Enter' });
    expect(dialog()).toBeNull();
  });
});

describe('chat composer', () => {
  function composer() {
    const wrapper = mount(ChatComposer, { props: { modelValue: 'Hello' } });
    wrappers.push(wrapper);
    return wrapper;
  }
  test('grows for multiple lines and shrinks when the draft is cleared', async () => {
    const wrapper = composer();
    const field = wrapper.get('textarea').element;
    vi.spyOn(field, 'scrollHeight', 'get').mockReturnValue(100);
    await wrapper.get('textarea').setValue('First line\nSecond line');
    expect(field.style.height).toBe('100px');
    expect(field.style.overflowY).toBe('hidden');
    vi.spyOn(field, 'scrollHeight', 'get').mockReturnValue(0);
    await wrapper.setProps({ modelValue: '' });
    await nextTick();
    expect(field.style.height).toBe('44px');
  });
  test('very long drafts stop growing and scroll inside the textarea', async () => {
    const wrapper = composer();
    const field = wrapper.get('textarea').element;
    vi.spyOn(field, 'scrollHeight', 'get').mockReturnValue(300);
    await wrapper.get('textarea').setValue('A long draft');
    expect(field.style.height).toBe('144px');
    expect(field.style.overflowY).toBe('auto');
  });
  test('desktop Enter sends; Shift+Enter and IME composition retain new lines', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
    const wrapper = composer();
    await wrapper.get('textarea').trigger('keydown', { key: 'Enter', shiftKey: true });
    await wrapper.get('textarea').trigger('keydown', { key: 'Enter', isComposing: true });
    expect(wrapper.emitted('send')).toBeUndefined();
    await wrapper.get('textarea').trigger('keydown', { key: 'Enter' });
    expect(wrapper.emitted('send')).toHaveLength(1);
  });
  test('phone Enter does not send and sending prevents duplicate submissions', async () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
    const wrapper = composer();
    await wrapper.get('textarea').trigger('keydown', { key: 'Enter' });
    expect(wrapper.emitted('send')).toBeUndefined();
    await wrapper.setProps({ sending: true });
    await wrapper.get('form').trigger('submit');
    expect(wrapper.emitted('send')).toBeUndefined();
    // Sending does not disable the textarea and dismiss the on-screen keyboard.
    expect(wrapper.get('textarea').attributes('disabled')).toBeUndefined();
  });
});

describe('keyboard viewport', () => {
  function viewportHarness() {
    vi.stubGlobal('innerHeight', 800);
    const viewport = Object.assign(new EventTarget(), { height: 800, offsetTop: 0, scale: 1 });
    vi.stubGlobal('visualViewport', viewport);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    let inset = ref(0);
    const wrapper = mount(defineComponent({
      setup() {
        const page = ref<HTMLElement | null>(null);
        ({ keyboardInset: inset } = useChatKeyboard(page, vi.fn()));
        return { page };
      },
      template: '<div ref="page" />',
    }));
    wrappers.push(wrapper);
    vi.spyOn(wrapper.element, 'getBoundingClientRect').mockImplementation(() => ({
      top: 0, bottom: 800 - inset.value, height: 800 - inset.value,
    }) as DOMRect);
    return { viewport, inset, wrapper };
  }
  test('raises the thread above an overlay keyboard without doubling the inset', () => {
    const { viewport, inset } = viewportHarness();
    viewport.height = 480;
    viewport.dispatchEvent(new Event('resize'));
    expect(inset.value).toBe(320);
    viewport.dispatchEvent(new Event('scroll'));
    expect(inset.value).toBe(320);
    viewport.height = 800;
    viewport.dispatchEvent(new Event('resize'));
    expect(inset.value).toBe(0);
  });
  test('ignores pinch zoom and removes listeners after unmount', () => {
    const { viewport, inset, wrapper } = viewportHarness();
    viewport.height = 400;
    viewport.scale = 2;
    viewport.dispatchEvent(new Event('resize'));
    expect(inset.value).toBe(0);
    wrapper.unmount();
    wrappers.pop();
    viewport.scale = 1;
    viewport.dispatchEvent(new Event('resize'));
    expect(inset.value).toBe(0);
  });
});
