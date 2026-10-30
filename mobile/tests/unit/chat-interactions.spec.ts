import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { defineComponent, h, nextTick, ref } from 'vue';
import ChatComposer from '@/components/chat/ChatComposer.vue';
import MessageBubble from '@/components/chat/MessageBubble.vue';
import { useChatKeyboard } from '@/composables/useChatKeyboard';
import { KEYBOARD_VIEWPORT_EVENT } from '@/utils/keyboard-viewport';

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

describe('chat keyboard scrolling', () => {
  test('only the visible thread with a focused footer follows keyboard layout changes', () => {
    const onResize = vi.fn();
    const wrapper = mount(defineComponent({
      setup() {
        const page = ref<HTMLElement | null>(null);
        useChatKeyboard(page, onResize);
        return () => h('div', { ref: page }, [h('ion-footer', [h('textarea')]), h('input')]);
      },
    }));
    wrappers.push(wrapper);
    const notify = (input: Element) => document.dispatchEvent(new CustomEvent(KEYBOARD_VIEWPORT_EVENT, { detail: { input } }));
    notify(wrapper.get('textarea').element);
    expect(onResize).toHaveBeenCalledTimes(1);
    notify(wrapper.get('input').element);
    expect(onResize).toHaveBeenCalledTimes(1);
    wrapper.element.classList.add('ion-page-hidden');
    notify(wrapper.get('textarea').element);
    expect(onResize).toHaveBeenCalledTimes(1);
    wrapper.unmount();
    wrappers.pop();
    notify(document.createElement('textarea'));
    expect(onResize).toHaveBeenCalledTimes(1);
  });
});
