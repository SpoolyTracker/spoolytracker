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
    const headers = {
        'ngrok-skip-browser-warning': 'true',
    };
    await context.setExtraHTTPHeaders(headers);

    const baseUrl = 'http://localhost:5173';
    const outDir = path.join(__dirname, '../docs/images');

    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    console.log('Navigating to login...');
    await page.goto(`${baseUrl}/login`);
    await page.waitForLoadState('networkidle');

    // 1. Login as User1 (Standard User) for Inventory/Project stuff
    console.log('Login as user1...');
    try {
        await page.fill('input[autocomplete="username"]', 'user1');
        await page.fill('input[autocomplete="current-password"]', 'user1');
        await page.click('button[type="submit"]');
    } catch (e) {
        // Fallback
        await page.fill('input[type="text"]', 'user1');
        await page.fill('input[type="password"]', 'user1');
        await page.click('button');
    }

    await page.waitForURL('**/dashboard', { timeout: 15000 });
    console.log('Login successful.');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(outDir, 'dashboard.png') });

    // --- INVENTORY DETAILED ---
    console.log('Capturing Inventory Details...');
    await page.goto(`${baseUrl}/inventory`);
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(outDir, 'inventory.png') });

    // Add Filament Modal & SEEDING
    console.log('Opening Add Filament Modal...');
    // Try precise text matching or icon
    let addBtn = page.locator('button').filter({ hasText: 'Add Filament' }).first();
    if (!await addBtn.isVisible()) {
        addBtn = page.locator('button:has(svg.lucide-plus)').first();
    }

    if (await addBtn.isVisible()) {
        await addBtn.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: path.join(outDir, 'inventory_modal_add.png') });

        // SEED DATA: Create a filament so we can screenshot Edit/Consume
        console.log('Seeding a filament for screenshots...');
        try {
            // Brand
            await page.getByLabel('Brand').click();
            await page.keyboard.type('Generic');
            await page.keyboard.press('Enter');
            await page.waitForTimeout(500);

            // Material
            await page.getByLabel('Material').click();
            await page.keyboard.type('PLA');
            await page.keyboard.press('Enter');
            await page.waitForTimeout(500);

            // Color (Type hex)
            // Use evaluate for color input because fill might not trigger standard events sometimes or color inputs are tricky
            // But let's try fill first
            const colorInput = page.locator('input[type="color"]').first();
            if (await colorInput.isVisible()) {
                await colorInput.fill('#ff0000');
            }

            // Weight
            await page.getByLabel('Total Weight (g)').fill('1000');

            // Save
            // Text might be "Create" or "Add"
            await page.getByRole('button', { name: /create|add/i }).click();
            await page.waitForTimeout(2000); // Wait for save and refresh
        } catch (e) {
            console.log('Seeding failed (maybe already exists or UI diff)', e);
            // Close modal if still open
            await page.keyboard.press('Escape');
        }
    } else {
        console.error('Add Button not found!');
    }

    // Refresh inventory to be sure
    await page.reload();
    await page.waitForTimeout(2000);

    // Edit Filament Modal
    console.log('Opening Edit Filament Modal...');
    try {
        // Edit icon is usually lucide-edit2 or similar. Title "Edit"
        // In Inventory.tsx: <Edit2 size={16} /> inside IconButton with title={t('common.edit')}
        const editBtn = page.locator('button[title="Edit"]').first();
        if (await editBtn.count() > 0) {
            await editBtn.click();
            await page.waitForTimeout(1000);
            await page.screenshot({ path: path.join(outDir, 'inventory_modal_edit.png') });
            await page.keyboard.press('Escape');
            await page.waitForTimeout(500);
        } else {
            console.log('No edit button found (maybe no items?)');
        }
    } catch (e) { console.log('Edit modal failed', e); }

    // Add Consumption Modal from Inventory
    console.log('Opening Consumption Modal from Inventory...');
    try {
        // Title "Log Consumption". Icon PencilRuler
        const consumeBtn = page.locator('button[title="Log Consumption"]').first();
        if (await consumeBtn.count() > 0) {
            await consumeBtn.click();
            await page.waitForTimeout(1000);
            await page.screenshot({ path: path.join(outDir, 'inventory_modal_consume.png') });
            await page.keyboard.press('Escape');
            await page.waitForTimeout(500);
        } else {
            console.log('No consumption button found');
        }
    } catch (e) { console.log('Consume modal failed', e); }

    // --- PROJECTS DETAILED ---
    console.log('Capturing Projects Details...');
    await page.goto(`${baseUrl}/projects`);
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(outDir, 'projects_list.png') });
    await page.screenshot({ path: path.join(outDir, 'projects.png') });

    // Create Project Page
    console.log('Opening New Project Page...');
    try {
        await page.getByText('New Project').click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: path.join(outDir, 'projects_create.png') });
        await page.goto(`${baseUrl}/projects`);
        await page.waitForTimeout(1000);
    } catch (e) { console.log('New Project capture failed', e); }

    // Dummy Project for Details
    console.log('Creating dummy project...');
    try {
        await page.goto(`${baseUrl}/projects/new`);
        await page.waitForTimeout(1000);
        await page.fill('input[name="name"]', 'Docs Demo Project');
        await page.fill('textarea[name="description"]', 'Demo Description');
        // Submit button text might be "Create Project" or "Create"
        await page.locator('button[type="submit"]').click();
        await page.waitForURL('**/projects/*');
        await page.waitForTimeout(2000);
        console.log('Capturing Project Overview...');
        await page.screenshot({ path: path.join(outDir, 'projects_detail_overview.png') });

        // Cost Tab?
        // Check for tab with text "Cost" or "Analysis"
        // If not found, ignore.
    } catch (e) { console.log('Dummy project creation/capture failed', e); }

    // --- SETTINGS (Just in case) ---
    console.log('Capturing Settings...');
    await page.goto(`${baseUrl}/settings`);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outDir, 'settings.png') });

    // --- REFERENCE DATA ---
    console.log('Capturing Reference Data...');
    await page.goto(`${baseUrl}/reference-data`);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outDir, 'reference_data.png') });

    // --- CONSUMPTION DETAILED (USER2) ---
    console.log('Switching to user2...');

    // Clear state
    await page.context().clearCookies();
    await page.evaluate(() => localStorage.clear());
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
    await page.waitForTimeout(2000);

    // Tab 0: History
    await page.screenshot({ path: path.join(outDir, 'consumption_tab_history.png') });
    await page.screenshot({ path: path.join(outDir, 'consumption.png') }); // Backup/Alias

    // Tab 1: Analytics
    console.log('Switching to Analytics Tab...');
    try {
        // Tab label might be "Analytics & Forecast"
        // Find tab. 
        // We can use getByRole('tab', { name: /analytics/i })
        await page.getByRole('tab', { name: /analytics/i }).click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: path.join(outDir, 'consumption_tab_analytics.png') });
    } catch (e) { console.error('Analytics tab failed', e); }

    // Tab 2: Simulator
    console.log('Switching to Simulator Tab...');
    try {
        await page.getByRole('tab', { name: /simulator/i }).click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: path.join(outDir, 'consumption_tab_simulator.png') });
    } catch (e) { console.error('Simulator tab failed', e); }

    // Add Consumption Modal from this page
    try {
        await page.getByText('Add Usage').click(); // or Add Consumption
        await page.waitForTimeout(1000);
        await page.screenshot({ path: path.join(outDir, 'consumption_modal_add.png') });
    } catch (e) { console.log('Add Usage modal failed', e); }

    await browser.close();
    console.log('Detailed screenshots capture complete.');
})();
