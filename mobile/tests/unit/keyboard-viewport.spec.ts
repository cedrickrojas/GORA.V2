import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { installKeyboardViewport, KEYBOARD_VIEWPORT_EVENT } from '@/utils/keyboard-viewport';

let stop: (() => void) | undefined;
let viewport: EventTarget & { height: number; offsetTop: number; scale: number };
let frames: Map<number, FrameRequestCallback>;
let sequence: number;
const root = document.documentElement;

async function settle() {
  for (let i = 0; i < 4; i++) {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((callback) => callback(0));
    await Promise.resolve();
  }
}
function rect(top: number, height: number): DOMRect {
  return { top, bottom: top + height, height, left: 0, right: 390, width: 390, x: 0, y: top, toJSON: () => ({}) };
}
function editor({ footer = false, modal = false, shadow = false } = {}) {
  const app = document.createElement('ion-app');
  const page = document.createElement(modal ? 'ion-modal' : 'div');
  const content = document.createElement(footer ? 'ion-footer' : 'ion-content') as HTMLElement & {
    getScrollElement?: () => Promise<HTMLElement>;
  };
  const scroll = document.createElement('div');
  const input = document.createElement('textarea');
  if (shadow) {
    const host = document.createElement('ion-textarea');
    host.attachShadow({ mode: 'open' }).append(input);
    scroll.append(host);
  } else scroll.append(input);
  content.append(scroll);
  page.append(content);
  app.append(page);
  document.body.append(app);
  if (!footer) content.getScrollElement = async () => scroll;
  vi.spyOn(scroll, 'getBoundingClientRect').mockImplementation(() =>
    rect(
      viewport.offsetTop + 56,
      Number.parseFloat(root.style.getPropertyValue('--gora-viewport-height') || '800') - 56,
    ),
  );
  vi.spyOn(input, 'getBoundingClientRect').mockImplementation(() =>
    footer
      ? rect(
          viewport.offsetTop + Number.parseFloat(root.style.getPropertyValue('--gora-viewport-height') || '800') - 64,
          44,
        )
      : rect(650 - scroll.scrollTop, 44),
  );
  return { input, scroll, app, content };
}

beforeEach(() => {
  frames = new Map();
  sequence = 0;
  viewport = Object.assign(new EventTarget(), { height: 800, offsetTop: 0, scale: 1 });
  vi.stubGlobal('innerHeight', 800);
  vi.stubGlobal('innerWidth', 390);
  vi.stubGlobal('visualViewport', viewport);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++sequence, callback);
    return sequence;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  stop = installKeyboardViewport();
});
afterEach(() => {
  stop?.();
  stop = undefined;
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('shared phone keyboard layout', () => {
  test('keeps chat and comment footers above an overlay keyboard without applying a second inset', async () => {
    const { input } = editor({ footer: true });
    input.focus();
    viewport.height = 480;
    viewport.dispatchEvent(new Event('resize'));
    await settle();
    expect(root.style.getPropertyValue('--gora-viewport-height')).toBe('480px');
    expect(root.classList.contains('gora-keyboard-open')).toBe(true);
    expect(input.getBoundingClientRect().bottom).toBeLessThan(viewport.height);
    viewport.dispatchEvent(new Event('scroll'));
    await settle();
    expect(root.style.getPropertyValue('--gora-viewport-height')).toBe('480px');
    expect(input.closest('ion-footer')?.style.bottom).toBe('');
  });

  test('uses the actual visible height when Android already resizes the layout viewport', async () => {
    editor({ footer: true }).input.focus();
    vi.stubGlobal('innerHeight', 480);
    viewport.height = 480;
    window.dispatchEvent(new Event('resize'));
    await settle();
    expect(root.style.getPropertyValue('--gora-viewport-height')).toBe('480px');
  });

  test.each([false, true])('scrolls a focused form field into view inside its content (modal: %s)', async (modal) => {
    const { input, scroll } = editor({ modal });
    input.focus();
    viewport.height = 480;
    viewport.dispatchEvent(new Event('resize'));
    await settle();
    expect(scroll.scrollTop).toBe(226);
    expect(input.getBoundingClientRect().bottom).toBe(468);
    expect(input.value).toBe('');
    expect(document.activeElement).toBe(input);
  });

  test('finds inputs inside Ionic shadow roots and keeps their text and selection', async () => {
    const { input, scroll } = editor({ shadow: true });
    input.value = 'Hello there';
    input.focus();
    input.setSelectionRange(5, 5);
    viewport.height = 480;
    viewport.dispatchEvent(new Event('resize'));
    await settle();
    expect(scroll.scrollTop).toBe(226);
    expect(input.value).toBe('Hello there');
    expect(input.selectionStart).toBe(5);
  });

  test('expands a sheet once and uses the latest keyboard bounds after its animation', async () => {
    const { input, scroll } = editor({ modal: true });
    const modal = input.closest('ion-modal') as HTMLElement & {
      breakpoints: number[];
      getCurrentBreakpoint: () => Promise<number>;
      setCurrentBreakpoint: (value: number) => Promise<void>;
    };
    let finishExpansion = () => {};
    modal.breakpoints = [0, 0.6, 1];
    modal.getCurrentBreakpoint = vi.fn(async () => 0.6);
    modal.setCurrentBreakpoint = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishExpansion = resolve;
        }),
    );
    input.focus();
    viewport.height = 480;
    await settle();
    expect(modal.setCurrentBreakpoint).toHaveBeenCalledWith(1);
    viewport.height = 400;
    viewport.dispatchEvent(new Event('resize'));
    await settle();
    expect(modal.setCurrentBreakpoint).toHaveBeenCalledTimes(1);
    finishExpansion();
    await settle();
    expect(scroll.scrollTop).toBe(306);
    expect(input.getBoundingClientRect().bottom).toBe(388);
  });

  test('does not scroll an old editor after focus moves while its container is loading', async () => {
    const { input, scroll, content } = editor();
    let finishContainer = (_: HTMLElement) => {};
    content.getScrollElement = () =>
      new Promise<HTMLElement>((resolve) => {
        finishContainer = resolve;
      });
    input.focus();
    viewport.height = 480;
    await settle();
    input.blur();
    await settle();
    finishContainer(scroll);
    await settle();
    expect(scroll.scrollTop).toBe(0);
  });

  test('accounts for the viewport shifting when Safari pans above the keyboard', async () => {
    editor({ footer: true }).input.focus();
    viewport.height = 450;
    viewport.offsetTop = 80;
    viewport.dispatchEvent(new Event('scroll'));
    await settle();
    expect(root.style.getPropertyValue('--gora-viewport-top')).toBe('80px');
    expect(root.style.getPropertyValue('--gora-viewport-height')).toBe('450px');
  });

  test('restores the full screen and safe-area spacing when the keyboard is dismissed', async () => {
    const { input } = editor({ footer: true });
    input.focus();
    viewport.height = 480;
    viewport.dispatchEvent(new Event('resize'));
    await settle();
    viewport.height = 800;
    viewport.dispatchEvent(new Event('resize'));
    await settle();
    expect(root.classList.contains('gora-keyboard-open')).toBe(false);
    expect(root.style.getPropertyValue('--gora-viewport-height')).toBe('800px');
    input.blur();
    await settle();
    expect(root.classList.contains('gora-input-focused')).toBe(false);
    expect(root.style.getPropertyValue('--gora-viewport-height')).toBe('');
  });

  test('does not treat pinch zoom as a keyboard or move the focused field', async () => {
    const { input, scroll } = editor();
    input.focus();
    viewport.scale = 2;
    viewport.height = 400;
    viewport.dispatchEvent(new Event('resize'));
    await settle();
    expect(root.classList.contains('gora-input-focused')).toBe(false);
    expect(scroll.scrollTop).toBe(0);
  });

  test('does not interfere with desktop typing or non-text controls', async () => {
    editor().input.focus();
    await settle();
    expect(root.classList.contains('gora-keyboard-open')).toBe(false);
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    document.body.append(checkbox);
    checkbox.focus();
    await settle();
    expect(root.classList.contains('gora-input-focused')).toBe(false);
  });

  test('typing schedules visibility checks without repeatedly scrolling a chat to the end', async () => {
    const onResize = vi.fn();
    document.addEventListener(KEYBOARD_VIEWPORT_EVENT, onResize);
    try {
      const { input } = editor();
      input.focus();
      viewport.height = 480;
      await settle();
      input.value = 'New message';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await settle();
      expect(onResize).toHaveBeenCalledTimes(1);
    } finally {
      document.removeEventListener(KEYBOARD_VIEWPORT_EVENT, onResize);
    }
  });

  test('falls back to the window height without VisualViewport and cleans up listeners', async () => {
    stop?.();
    vi.stubGlobal('visualViewport', undefined);
    stop = installKeyboardViewport();
    editor().input.focus();
    vi.stubGlobal('innerHeight', 480);
    window.dispatchEvent(new Event('resize'));
    await settle();
    expect(root.style.getPropertyValue('--gora-viewport-height')).toBe('480px');
    stop();
    stop = undefined;
    viewport.dispatchEvent(new Event('resize'));
    window.dispatchEvent(new Event('resize'));
    await settle();
    expect(root.style.getPropertyValue('--gora-viewport-height')).toBe('');
  });
});
