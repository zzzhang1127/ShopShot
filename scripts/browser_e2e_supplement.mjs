/** 补充测试：首页模板区 + 工作台点击 + 项目详情 */
import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import { join } from 'path';

const BASE = 'http://localhost:5173';
const OUT = join(process.cwd(), 'test-screenshots', 'supplement-' + Date.now());

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // 首页模板区
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.locator('text=/热门带货模板|Trending/i').scrollIntoViewIfNeeded();
  await page.waitForTimeout(2000);
  await page.screenshot({ path: join(OUT, 'home-templates.png'), fullPage: false });

  const countText = await page.locator('text=/共\\s*\\d+\\s*个|templates/i').first().textContent().catch(() => null);
  const cards = await page.locator('video').count();
  console.log('模板统计:', countText, '| video元素:', cards);

  // 工作台各入口
  const wbActions = [
    '生成 AI 视频',
    '先生成图片再动图',
    '制作视频场景 AI 艺术图',
    '编辑已有素材',
    '放大/增强素材',
    '对比不同模型',
    '学习工作流',
    '定价与积分',
    '开发者 API',
  ];
  for (const label of wbActions) {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    const btn = page.locator('button').filter({ hasText: label }).first();
    if (await btn.count()) {
      await btn.scrollIntoViewIfNeeded();
      await btn.click();
      await page.waitForTimeout(600);
      console.log(`工作台[${label}] → URL: ${page.url()}`);
    }
  }
  await page.screenshot({ path: join(OUT, 'workbench-learn-panel.png'), fullPage: true });

  // 资源中心模板页
  await page.goto(`${BASE}/templates`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(OUT, 'resource-templates.png'), fullPage: true });
  const tplCards = await page.locator('video').count();
  console.log('资源中心模板 video:', tplCards);

  // 点击第一个项目
  await page.goto(`${BASE}/projects`, { waitUntil: 'networkidle' });
  const first = page.locator('a[href^="/projects/"]').first();
  if (await first.count()) {
    await first.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: join(OUT, 'project-detail.png'), fullPage: true });
    console.log('项目详情 URL:', page.url());
  }

  await browser.close();
  console.log('截图目录:', OUT);
}

main();
