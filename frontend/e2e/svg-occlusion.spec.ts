import { expect, test } from '@playwright/test';

// The 2026-08-18 audit found one architecture diagram whose text ran under a later, opaque panel
// ("the ultimate pit is the maximum-value closed set..." in 04-the-science.svg), hiding the word
// "cut." A heuristic character-width estimate cannot decide this: it flags every title that
// legitimately spans a panel. So measure the REAL geometry in a browser, the way a reader sees it:
// a text node is occluded when its painted box overlaps a rect that is painted AFTER it and is
// opaque. Fixing the diagram without this gate would just let the next long line regress silently.
//
// BOTH LANGUAGES. The diagrams became bilingual (ADR-0058) and Spanish runs longer than English, so
// checking only the default language would check the shorter half of the problem. Opened standalone
// like this there is no shell stylesheet, so the Spanish pass injects the same two rules the shell
// would apply.

const DIAGRAMS = [
  '01-the-app.svg',
  '02-lanes.svg',
  '03-web-flow.svg',
  '04-the-science.svg',
  '05-data-contracts.svg',
];

const LANGS = [
  { id: 'en', css: '' },
  { id: 'es', css: '.l-en { display: none !important; } .l-es { display: inline !important; }' },
];

for (const name of DIAGRAMS) {
  for (const lang of LANGS) {
    test(`architecture diagram ${name} has no text hidden under a later panel (${lang.id})`, async ({ page }) => {
      await page.goto(`/svg/tech/${name}`);
      // addStyleTag appends to <head>, and a standalone SVG document has none. Append a real
      // SVG <style> element to the root instead.
      if (lang.css) {
        await page.evaluate((css) => {
          const el = document.createElementNS('http://www.w3.org/2000/svg', 'style');
          el.textContent = css;
          document.documentElement.appendChild(el);
        }, lang.css);
      }

      const seen = await page.evaluate(() => {
        const svg = document.querySelector('svg');
        if (!svg) return { count: 0, offenders: [{ text: 'NO SVG ROOT', rect: '' }] };
        const nodes = Array.from(svg.querySelectorAll('text, rect'));
        const offenders: Array<{ text: string; rect: string }> = [];
        let count = 0;
        nodes.forEach((node, index) => {
          if (node.tagName.toLowerCase() !== 'text') return;
          // SCREEN geometry, not getBBox: these diagrams contain nested <svg viewBox> islands,
          // and getBBox returns the INNER coordinate system there, which produced false positives.
          const tb = node.getBoundingClientRect();
          // A hidden language reports a zero box; it is not on screen, so it cannot be occluded.
          if (tb.width === 0 || tb.height === 0) return;
          count += 1;
          for (let j = index + 1; j < nodes.length; j += 1) {
            const later = nodes[j];
            if (later.tagName.toLowerCase() !== 'rect') continue;
            const style = getComputedStyle(later);
            const fill = style.fill;
            // only an OPAQUE later rect can hide text
            if (fill === 'none' || style.fillOpacity === '0' || /rgba\([^)]*,\s*0(\.\d+)?\)$/.test(fill)) continue;
            const rb = later.getBoundingClientRect();
            const overlapX = Math.min(tb.right, rb.right) - Math.max(tb.left, rb.left);
            const overlapY = Math.min(tb.bottom, rb.bottom) - Math.max(tb.top, rb.top);
            if (overlapX > 2 && overlapY > 2) {
              offenders.push({
                text: (node.textContent || '').slice(0, 60),
                rect: `x=${Math.round(rb.left)} y=${Math.round(rb.top)} w=${Math.round(rb.width)}`,
              });
              break;
            }
          }
        });
        return { count, offenders };
      });

      // Guard against the pass being vacuous: if the language switch hid everything, the check
      // would measure nothing and report success.
      expect(seen.count, `no visible text measured in ${name} (${lang.id})`).toBeGreaterThan(5);
      expect(seen.offenders, `text hidden behind a later panel in ${name} (${lang.id})`).toEqual([]);
    });
  }
}
