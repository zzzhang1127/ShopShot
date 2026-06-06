/**
 * ShopShot 前端 E2E 自动化测试 + 截图
 * 运行: node scripts/browser_e2e_test.mjs
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

const BASE = 'http://localhost:5173';
const OUT = join(process.cwd(), 'test-screenshots', new Date().toISOString().slice(0, 19).replace(/:/g, '-'));
const results = [];

function log(step, status, detail = '') {
  results.push({ step, status, detail });
  const icon = status === 'pass' ? '✓' : status === 'warn' ? '!' : '✗';
  console.log(`${icon} ${step}${detail ? ': ' + detail : ''}`);
}

async function shot(page, name) {
  const path = join(OUT, `${name}.png`);
  await page.screenshot({ path, fullPage: true });
  return path;
}

async function clickNav(page, labelRegex, screenshotName) {
  const btn = page.locator('aside nav button').filter({ hasText: labelRegex }).first();
  await btn.waitFor({ state: 'visible', timeout: 8000 });
  await btn.click();
  await page.waitForTimeout(800);
  const url = page.url();
  await shot(page, screenshotName);
  return url;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  console.log(`\nShopShot E2E → ${OUT}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'zh-CN',
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  try {
    // 1. 首页加载
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1500);
    await shot(page, '01-home-initial');
    const hero = page.locator('h1').first();
    if (await hero.isVisible()) log('首页 Hero 标题', 'pass');
    else log('首页 Hero 标题', 'fail', '未找到 h1');

    const promptBar = page.locator('textarea').first();
    if (await promptBar.isVisible()) log('创作 Prompt 输入框', 'pass');
    else log('创作 Prompt 输入框', 'fail');

    // 2. 侧边栏导航
    const navTests = [
      [/项目|Projects/i, 'projects', '02-nav-projects'],
      [/素材|Library/i, 'library', '03-nav-library'],
      [/视频|Videos/i, 'videos', '04-nav-videos'],
      [/音频|Audio/i, 'audio', '05-nav-audio'],
      [/模板|Templates/i, 'templates', '06-nav-templates'],
      [/首页|Home/i, '', '07-nav-home'],
    ];
    for (const [re, pathPart, shotName] of navTests) {
      try {
        const url = await clickNav(page, re, shotName);
        if (pathPart && url.includes(pathPart)) log(`导航 → ${pathPart}`, 'pass', url);
        else if (!pathPart && (url === BASE + '/' || url.endsWith('/'))) log('导航 → 首页', 'pass', url);
        else log(`导航 → ${pathPart || 'home'}`, 'warn', url);
      } catch (e) {
        log(`导航 → ${pathPart || 'home'}`, 'fail', String(e.message));
      }
    }

    // 3. 回到首页测工作台
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    const workbench = page.locator('h2').filter({ hasText: /工作台|Workbench/i }).first();
    if (await workbench.isVisible()) log('创作功能工作台区块', 'pass');
    else log('创作功能工作台区块', 'fail');

    const wbButtons = page.locator('button').filter({ hasText: /应用内打开|Open in app/i });
    const wbCount = await wbButtons.count();
    if (wbCount >= 6) log('工作台入口按钮', 'pass', `${wbCount} 个`);
    else log('工作台入口按钮', 'warn', `仅 ${wbCount} 个`);

    // 点击「API 配置」类按钮
    const apiBtn = page.locator('button').filter({ hasText: /API|开发者|Developers/i }).first();
    if (await apiBtn.count()) {
      await apiBtn.click();
      await page.waitForTimeout(500);
      const modal = page.locator('h2, h3').filter({ hasText: /模型|Model|API/i }).first();
      if (await modal.isVisible()) {
        log('工作台 → API 配置弹窗', 'pass');
        await shot(page, '08-model-config-modal');
        const closeBtn = page.locator('button').filter({ hasText: /取消|关闭|Cancel|Close/i }).first();
        if (await closeBtn.count()) await closeBtn.click();
      } else log('工作台 → API 配置弹窗', 'warn', '未检测到弹窗标题');
    }

    // 4. Prompt Bar Tabs
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    for (const tab of [/图片|Image/i, /视频|Video/i, /音频|Audio/i]) {
      const tabBtn = page.locator('button').filter({ hasText: tab }).first();
      if (await tabBtn.count()) {
        await tabBtn.click();
        await page.waitForTimeout(300);
        log(`Prompt Tab ${tab}`, 'pass');
      }
    }
    await shot(page, '09-prompt-tabs');

    // 5. 模板区
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1500);
    await shot(page, '10-templates-section');

    const officialTab = page.locator('button').filter({ hasText: /官方模板|Official/i }).first();
    if (await officialTab.count()) {
      await officialTab.click();
      await page.waitForTimeout(500);
    }

    const templateCards = page.locator('[class*="aspect-"]').filter({ has: page.locator('video, img') });
    const cardCount = await templateCards.count();
    if (cardCount > 0) log('模板卡片渲染', 'pass', `${cardCount} 张可见`);
    else log('模板卡片渲染', 'warn', '未找到模板卡片');

    const catalogHint = page.locator('text=/共.*个|templates/i').first();
    if (await catalogHint.isVisible()) log('模板数量统计', 'pass', await catalogHint.innerText());
    else log('模板数量统计', 'warn', '未显示数量');

    // 6. 项目列表
    await page.goto(`${BASE}/projects`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await shot(page, '11-project-list');
    const backLink = page.locator('a').filter({ hasText: /返回|Back/i }).first();
    if (await backLink.isVisible()) log('项目列表返回键', 'pass');
    else log('项目列表返回键', 'fail');

    const newProj = page.locator('a, button').filter({ hasText: /新建|New project/i }).first();
    if (await newProj.isVisible()) log('新建项目按钮', 'pass');
    else log('新建项目按钮', 'fail');

    // 7. 资源中心各 Tab
    await page.goto(`${BASE}/library`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);
    await shot(page, '12-library-assets');

    for (const [label, path] of [
      [/视频|Videos/i, '/videos'],
      [/音频|Audio/i, '/audio'],
      [/剧本|Script/i, '/library?tab=scripts'],
      [/模板|Templates/i, '/templates'],
    ]) {
      let tab = page.locator('header ~ div button').filter({ hasText: label }).first();
      if (!(await tab.count())) {
        tab = page.locator('button').filter({ hasText: label }).first();
      }
      if (await tab.count()) {
        await tab.click();
        await page.waitForTimeout(1200);
        await shot(page, `13-tab-${path.replace(/[^a-z]/gi, '')}`);
        log(`资源中心 Tab ${path}`, 'pass', page.url());
      }
    }

    // 8. 新建项目页
    await page.goto(`${BASE}/projects/new`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await shot(page, '14-project-create');
    const form = page.locator('form input').first();
    if (await form.isVisible()) log('新建项目表单', 'pass');
    else log('新建项目表单', 'fail');

    // 9. 语言切换
    await page.goto(BASE, { waitUntil: 'networkidle' });
    const langBtn = page.locator('aside button').filter({ hasText: /EN|中文|Switch/i }).last();
    if (await langBtn.count()) {
      await langBtn.click();
      await page.waitForTimeout(500);
      await shot(page, '15-lang-switch');
      log('语言切换按钮', 'pass');
    }

    // 10. 控制台错误汇总
    if (consoleErrors.length === 0) log('浏览器 Console 错误', 'pass', '无 error');
    else log('浏览器 Console 错误', 'warn', `${consoleErrors.length} 条`);

    if (pageErrors.length === 0) log('页面 JS 异常', 'pass', '无');
    else log('页面 JS 异常', 'fail', pageErrors.join('; '));

  } catch (err) {
    log('测试中断', 'fail', String(err));
    await shot(page, '99-error-state').catch(() => {});
  } finally {
    await browser.close();
  }

  const report = {
    base: BASE,
    screenshotDir: OUT,
    summary: {
      pass: results.filter((r) => r.status === 'pass').length,
      warn: results.filter((r) => r.status === 'warn').length,
      fail: results.filter((r) => r.status === 'fail').length,
    },
    consoleErrors,
    pageErrors,
    steps: results,
  };
  await writeFile(join(OUT, 'report.json'), JSON.stringify(report, null, 2), 'utf-8');
  console.log('\n--- 汇总 ---');
  console.log(`通过 ${report.summary.pass} | 警告 ${report.summary.warn} | 失败 ${report.summary.fail}`);
  console.log(`截图目录: ${OUT}`);
  console.log(`报告: ${join(OUT, 'report.json')}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
