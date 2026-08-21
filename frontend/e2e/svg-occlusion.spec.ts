import { expect, test } from '@playwright/test';

// The 2026-08-18 audit found one architecture diagram whose text ran under a later, opaque panel
// ("the ultimate pit is the maximum-value closed set..." in 04-the-science.svg), hiding the word
// "cut." A heuristic character-width estimate cannot decide this: it flags every title that
// legitimately spans a panel. So measure the REAL geometry in a browser, the way a reader sees it:
// a text node is occluded when its painted box overlaps a rect that is painted AFTER it and is
// opaque. Fixing the diagram without this gate would just let the next long line regress silently.

const DIAGRAMS = [
  '01-the-app.svg',
  '02-lanes.svg',
  '03-web-flow.svg',
  '04-the-science.svg',
  '05-data-contracts.svg',
];

for (const name of DIAGRAMS) {
  test(`architecture diagram ${name} has no text hidden under a later panel`, async ({ page }) => {
    await page.goto(`/svg/tech/${name}`);
    const offenders = await page.evaluate(() => {
      const svg = document.querySelector('svg');
      if (!svg) return [{ text: 'NO SVG ROOT', rect: '' }];
      const nodes = Array.from(svg.querySelectorAll('text, rect'));
      const out: Array<{ text: string; rect: string }> = [];
      nodes.forEach((node, index) => {
        if (node.tagName.toLowerCase() !== 'text') return;
        // SCREEN geometry, not getBBox: these diagrams contain nested <svg viewBox> islands,
        // and getBBox returns the INNER coordinate system there, which produced false positives.
        const tb = node.getBoundingClientRect();
        if (tb.width === 0 || tb.height === 0) return;
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
            out.push({
              text: (node.textContent || '').slice(0, 60),
              rect: `x=${Math.round(rb.left)} y=${Math.round(rb.top)} w=${Math.round(rb.width)}`,
            });
            break;
          }
        }
      });
      return out;
    });
    expect(offenders, `text hidden behind a later panel in ${name}`).toEqual([]);
  });
}
