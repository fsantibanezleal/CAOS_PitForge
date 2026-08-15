import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const viewports = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'laptop', width: 1280, height: 720 },
  { name: '200% zoom equivalent', width: 640, height: 360 },
  { name: 'short landscape', width: 932, height: 430 },
  { name: 'desktop', width: 1600, height: 900 },
];

async function activeVerticalScrollOwners(page: Page) {
  return page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('body *')).filter((element) => {
    const style = getComputedStyle(element);
    return /^(auto|scroll)$/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 1;
  }).map((element) => ({ tag: element.tagName, classes: element.className, id: element.id })));
}

for (const viewport of viewports) {
  test(`workbench remains reachable at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/');
    await expect(page.getByText('Focus mode')).toBeVisible();

    const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(horizontalOverflow).toBeLessThanOrEqual(1);

    const owner = page.locator('.page-body.pf-layout');
    await expect(owner).toHaveCSS('overflow-y', 'auto');
    const owners = await activeVerticalScrollOwners(page);
    expect(owners).toHaveLength(1);
    expect(String(owners[0].classes)).toContain('pf-layout');

    await page.getByText('Controls (live re-solve)').scrollIntoViewIfNeeded();
    await expect(page.getByText('Controls (live re-solve)')).toBeVisible();
    if (viewport.width <= 720) {
      await expect(page.locator('.pf-tabselect select')).toBeVisible();
      await page.locator('.pf-tabselect select').selectOption('hist');
      await expect(page.getByText(/Block-value histogram/)).toBeVisible();
    } else {
      await expect(page.locator('.pf-tabrow')).toBeVisible();
    }
  });
}

test('locale updates visible copy, title, and document language', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.getByRole('button', { name: 'Switch language' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page).toHaveTitle('PitForge · rajo último y cáscaras anidadas');
  await expect(page.getByRole('link', { name: 'Introducción' })).toBeVisible();
  await expect(page.getByText('Controles (recálculo en vivo)')).toBeVisible();
});

test('serious accessibility violations are absent in both themes', async ({ page }) => {
  await page.goto('/');
  for (const theme of ['dark', 'light']) {
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    if (theme === 'light') {
      // The shell intentionally animates theme colors. Audit the settled palette, not an
      // inaccessible-looking intermediate frame sampled during the 150 ms transition.
      await expect(page.getByRole('link', { name: 'App', exact: true })).toHaveCSS('color', 'rgb(3, 61, 130)');
    }
    const results = await new AxeBuilder({ page }).analyze();
    const material = results.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
    expect(material, `${theme}: ${material.map((violation) => `${violation.id}: ${violation.help}`).join('\n')}`).toEqual([]);
    if (theme === 'dark') await page.getByRole('button', { name: 'Toggle light / dark' }).click();
  }
});

test('WebGL loss keeps the product usable with a recoverable fallback', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
      if (type === 'webgl' || type === 'webgl2') return null;
      return original.call(this, type, ...args as []) as RenderingContext | null;
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  await page.goto('/');
  await expect(page.getByText('3D view unavailable')).toBeVisible();
  await expect(page.getByText('Controls (live re-solve)')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry 3D' })).toBeVisible();
});

test('artifact failure is explicit, bounded, and retryable', async ({ page }) => {
  await page.route('**/data/manifests/index.json', (route) => route.abort());
  await page.goto('/experiments');
  await expect(page.getByText('Invalid artifact contract')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry' }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'App' })).toBeVisible();
});

test('long prose routes retain one reachable scroll owner', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/benchmark');
  const owners = await activeVerticalScrollOwners(page);
  expect(owners).toHaveLength(1);
  expect(String(owners[0].classes)).toContain('page');
  await page.getByRole('heading', { name: 'Learned vs classical' }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('heading', { name: 'Learned vs classical' })).toBeVisible();
});

test('focus mode remains operable on a short phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 667 });
  await page.goto('/focus/A01');
  await expect(page.getByRole('link', { name: 'Back to the app' })).toBeVisible();
  await expect(page.getByText('Porphyry copper (disseminated shell)')).toBeVisible();
  await expect(page.getByRole('slider', { name: /Price/ })).toBeVisible();
  await page.getByText(/The pit is re-solved EXACTLY/).scrollIntoViewIfNeeded();
  await expect(page.getByText(/The pit is re-solved EXACTLY/)).toBeVisible();

  const owners = await activeVerticalScrollOwners(page);
  expect(owners).toHaveLength(1);
  expect(String(owners[0].classes)).toContain('pff-rail');
  const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(horizontalOverflow).toBeLessThanOrEqual(1);
});

test('desktop grouped views open and close from the keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  const group = page.locator('.pf-tabrow button[aria-haspopup="menu"]').first();
  await group.focus();
  await page.keyboard.press('Enter');
  await expect(group).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('menu').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(group).toHaveAttribute('aria-expanded', 'false');
  await expect(group).toBeFocused();
});
