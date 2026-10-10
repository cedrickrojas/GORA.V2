export async function copyPostLink(url: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(url);
      return;
    } catch {
      /* Use selection fallback. */
    }
  }
  const input = document.createElement('textarea');
  input.value = url;
  input.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
  input.setAttribute('aria-label', 'Post link');
  document.body.append(input);
  try {
    input.select();
    if (!document.execCommand('copy')) throw new Error('Copy failed.');
  } finally {
    input.remove();
  }
}
