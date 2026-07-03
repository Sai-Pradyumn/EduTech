/**
 * Targeted, dependency-free scrub for generated SVG/HTML before it is rendered
 * via `[innerHTML]`. Angular's own HTML sanitizer strips most SVG, so visuals
 * must bypass it — which means the content has to be made safe first. This
 * removes the script-bearing vectors (script/iframe/object/embed/foreignObject
 * and SVG animation elements that can retarget an href), inline event handlers,
 * and `javascript:`/`vbscript:`/`data:text/html` URLs, while keeping the drawing
 * markup intact. Defense-in-depth for first-party generated content (VISUAL-BUG-001).
 */
const BAD_TAGS = new Set([
  'script',
  'iframe',
  'object',
  'embed',
  'base',
  'meta',
  'link',
  'foreignobject',
  'animate',
  'animatetransform',
  'set',
  'handler',
]);

const BAD_URL = /^\s*(?:javascript|vbscript|data:text\/html):/i;
const URLISH_ATTR = /^(?:href|xlink:href|src|action|formaction|from|to|values)$/i;

export function sanitizeMarkup(input: string): string {
  if (!input) return '';
  // A <template>'s innerHTML is parsed inertly — scripts don't run, images/resources
  // aren't fetched — so it's safe to inspect and scrub before rendering.
  const tpl = document.createElement('template');
  tpl.innerHTML = input;
  for (const el of Array.from(tpl.content.querySelectorAll('*'))) {
    if (BAD_TAGS.has(el.tagName.toLowerCase())) {
      el.remove();
      continue;
    }
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (name.startsWith('on')) el.removeAttribute(attr.name);
      else if (URLISH_ATTR.test(name) && BAD_URL.test(attr.value))
        el.removeAttribute(attr.name);
    }
  }
  return tpl.innerHTML;
}
