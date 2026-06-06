const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        locale: 'en-US'
    });
    const page = await context.newPage();
    const headers = { 'ngrok-skip-browser-warning': 'true' };
    await context.setExtraHTTPHeaders(headers);

    const baseUrl = 'http://localhost:5173';
    const outDir = path.join(__dirname, '../docs/images');

    console.log('Navigating to login...');
    await page.goto(`${baseUrl}/login`);
    await page.waitForLoadState('networkidle');

    console.log('Login as user2...');
    try {
        await page.fill('input[autocomplete="username"]', 'user2');
        await page.fill('input[autocomplete="current-password"]', 'user2');
        await page.click('button[type="submit"]');
    } catch (e) {
        await page.fill('input[type="text"]', 'user2');
        await page.fill('input[type="password"]', 'user2');
        await page.click('button');
    }

    await page.waitForURL('**/dashboard');
    console.log('User2 Login successful.');

    console.log('Capturing Consumption Tabs...');
    await page.goto(`${baseUrl}/consumption`);
    await page.waitForTimeout(3000);

    // Tab 0: History (Default)
    await page.screenshot({ path: path.join(outDir, 'consumption_tab_history.png') });
    console.log('History tab captured.');

    // Tab 1: Analytics
    console.log('Switching to Analytics Tab...');
    await page.screenshot({ path: path.join(outDir, 'debug_before_analytics_click.png') });
    try {
        // Try text match
        const tab = page.getByText(/Analytics/i).first();
        if (await tab.isVisible()) {
            await tab.click();
            await page.waitForTimeout(2000);
            await page.screenshot({ path: path.join(outDir, 'consumption_tab_analytics.png') });
            console.log('Analytics tab captured.');
        } else {
            console.log('Analytics tab not visible');
        }
    } catch (e) { console.error('Analytics tab failed', e); }

    // Tab 2: Simulator
    console.log('Switching to Simulator Tab...');
    try {
        await page.getByRole('tab', { name: /simulator/i }).click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: path.join(outDir, 'consumption_tab_simulator.png') });
        console.log('Simulator tab captured.');
    } catch (e) { console.error('Simulator tab failed', e); }

    await browser.close();
    console.log('User2 screenshots capture complete.');
})();
