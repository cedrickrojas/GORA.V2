/** One viewport owner for pages, footers, and Ionic overlays. */
export const KEYBOARD_VIEWPORT_EVENT = 'gora:keyboard-viewport-change';

type ScrollContent = HTMLElement & { getScrollElement?: () => Promise<HTMLElement> };
type SheetModal = HTMLElement & {
  breakpoints?: number[];
  getCurrentBreakpoint?: () => Promise<number | undefined>;
  setCurrentBreakpoint?: (breakpoint: number) => Promise<void>;
};

const NON_TEXT_INPUTS = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
]);
const sheetExpansions = new WeakMap<HTMLElement, Promise<void>>();

function textEntry(element: Element | null): HTMLElement | null {
  if (element instanceof HTMLTextAreaElement) return element.disabled || element.readOnly ? null : element;
  if (element instanceof HTMLInputElement) {
    return element.disabled || element.readOnly || NON_TEXT_INPUTS.has(element.type) ? null : element;
  }
  if (!(element instanceof HTMLElement)) return null;
  return element.closest<HTMLElement>('[contenteditable]:not([contenteditable="false"])');
}

function activeEntry(): HTMLElement | null {
  let element = document.activeElement;
  while (element?.shadowRoot?.activeElement) element = element.shadowRoot.activeElement;
  const input = textEntry(element);
  return input?.closest('.ion-page-hidden, [inert]') ? null : input;
}

/** Walk through Ionic inputs' shadow roots as well as ordinary HTML parents. */
function parentElement(element: HTMLElement): HTMLElement | null {
  const root = element.getRootNode();
  return element.parentElement ?? (root instanceof ShadowRoot && root.host instanceof HTMLElement ? root.host : null);
}

async function scrollContainer(input: HTMLElement): Promise<HTMLElement | null> {
  let parent = parentElement(input);
  while (parent && parent !== document.body) {
    if (parent.tagName === 'ION-CONTENT') {
      const content = parent as ScrollContent;
      if (content.getScrollElement) return content.getScrollElement();
    }
    const style = getComputedStyle(parent);
    if (/(auto|scroll)/.test(style.overflowY) && parent.scrollHeight > parent.clientHeight) return parent;
    parent = parentElement(parent);
  }
  return null;
}

async function expandInputSheet(input: HTMLElement, isCurrent: () => boolean): Promise<void> {
  let parent = parentElement(input);
  while (parent) {
    if (parent.tagName === 'ION-MODAL') {
      const modal = parent as SheetModal;
      const expanding = sheetExpansions.get(modal);
      if (expanding) {
        await expanding;
        return;
      }
      if (modal.breakpoints?.includes(1) && modal.getCurrentBreakpoint && modal.setCurrentBreakpoint) {
        const breakpoint = await modal.getCurrentBreakpoint();
        if (isCurrent() && breakpoint !== undefined && breakpoint < 1) {
          // A partial sheet translates part of its scroll area below the keyboard.
          // Expand it first so the field and its send/save controls can be reached.
          const expansion = modal.setCurrentBreakpoint(1);
          sheetExpansions.set(modal, expansion);
          try {
            await expansion;
          } finally {
            sheetExpansions.delete(modal);
          }
        }
      }
      return;
    }
    parent = parentElement(parent);
  }
}

/** Keep the focused field visible without scrolling Ionic's fixed page or header. */
async function reveal(input: HTMLElement, top: number, height: number, isCurrent: () => boolean): Promise<void> {
  await expandInputSheet(input, isCurrent);
  const container = await scrollContainer(input);
  if (!container || !isCurrent() || !input.isConnected) return;
  const bounds = container.getBoundingClientRect();
  const field = input.getBoundingClientRect();
  const visibleTop = Math.max(top, bounds.top) + 12;
  const visibleBottom = Math.min(top + height, bounds.bottom) - 12;
  if (visibleBottom <= visibleTop) return;

  // Large editors keep their caret in view, instead of jumping to the end of the field.
  let fieldTop = field.top;
  let fieldBottom = field.bottom;
  if (input.isContentEditable) {
    const selection = window.getSelection();
    if (selection?.rangeCount && input.contains(selection.anchorNode)) {
      const caret = selection.getRangeAt(0).getBoundingClientRect();
      if (caret.height) {
        fieldTop = caret.top;
        fieldBottom = caret.bottom;
      }
    }
  }
  const available = visibleBottom - visibleTop;
  let delta = 0;
  if (fieldBottom - fieldTop > available) {
    if (fieldTop < visibleTop || fieldTop > visibleBottom) delta = fieldTop - visibleTop;
  } else if (fieldBottom > visibleBottom) {
    delta = fieldBottom - visibleBottom;
  } else if (fieldTop < visibleTop) {
    delta = fieldTop - visibleTop;
  }
  if (Math.abs(delta) > 1) container.scrollTop += delta;
}

export function installKeyboardViewport(): () => void {
  const root = document.documentElement;
  const viewport = window.visualViewport;
  let baselineHeight = Math.max(window.innerHeight, viewport?.height ?? 0);
  let frame = 0;
  let revealFrame = 0;
  let stopped = false;
  let revision = 0;
  let lastGeometry = '';
  let currentInput: HTMLElement | null = null;
  let lastWidth = window.innerWidth;

  function reset(): void {
    root.classList.remove('gora-input-focused', 'gora-keyboard-open');
    root.style.removeProperty('--gora-viewport-height');
    root.style.removeProperty('--gora-viewport-top');
    lastGeometry = '';
  }

  function measure(): void {
    frame = 0;
    currentInput = activeEntry();
    // Pinch zoom is a user choice; do not resize the app to a magnified viewport.
    if (!currentInput || (viewport && Math.abs(viewport.scale - 1) > 0.05)) {
      reset();
      if (!currentInput) baselineHeight = Math.max(window.innerHeight, viewport?.height ?? 0);
      return;
    }
    const top = Math.max(0, viewport?.offsetTop ?? 0);
    const height = Math.max(1, Math.min(window.innerHeight, viewport?.height ?? window.innerHeight));
    // Width changes commonly mean rotation; the old portrait height is no longer a baseline.
    if (Math.abs(window.innerWidth - lastWidth) > 100) baselineHeight = window.innerHeight;
    lastWidth = window.innerWidth;
    const keyboardOpen = Math.max(baselineHeight, window.innerHeight) - height > 100;
    root.style.setProperty('--gora-viewport-height', `${height}px`);
    root.style.setProperty('--gora-viewport-top', `${top}px`);
    root.classList.add('gora-input-focused');
    root.classList.toggle('gora-keyboard-open', keyboardOpen);

    const input = currentInput;
    const measuredRevision = revision;
    const geometry = `${top}:${height}:${keyboardOpen}`;
    const changed = geometry !== lastGeometry;
    lastGeometry = geometry;
    cancelAnimationFrame(revealFrame);
    // Read field positions after the app, content, and any footer have resized.
    revealFrame = requestAnimationFrame(() => {
      revealFrame = 0;
      if (stopped || currentInput !== input || activeEntry() !== input) return;
      if (changed) document.dispatchEvent(new CustomEvent(KEYBOARD_VIEWPORT_EVENT, { detail: { input } }));
      void reveal(input, top, height, () => !stopped && revision === measuredRevision && activeEntry() === input);
    });
  }

  function schedule(): void {
    revision++;
    cancelAnimationFrame(frame);
    cancelAnimationFrame(revealFrame);
    frame = requestAnimationFrame(measure);
  }

  viewport?.addEventListener('resize', schedule);
  viewport?.addEventListener('scroll', schedule);
  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', schedule);
  document.addEventListener('focusin', schedule);
  document.addEventListener('focusout', schedule);
  document.addEventListener('input', schedule, true);
  document.addEventListener('selectionchange', schedule);
  schedule();

  return () => {
    stopped = true;
    cancelAnimationFrame(frame);
    cancelAnimationFrame(revealFrame);
    viewport?.removeEventListener('resize', schedule);
    viewport?.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    window.removeEventListener('orientationchange', schedule);
    document.removeEventListener('focusin', schedule);
    document.removeEventListener('focusout', schedule);
    document.removeEventListener('input', schedule, true);
    document.removeEventListener('selectionchange', schedule);
    reset();
  };
}
