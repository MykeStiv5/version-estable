'use strict';

require('dotenv').config();

const fs = require('fs');
const path = require('path');

const { bus, EVENTS } = require('../../shared/EventBus');
const { createSourceLogger } = require('../Logger');
const log = createSourceLogger('ScraperService');

const website = require('./WebsiteScraper');
const instagram = require('./InstagramScraper');

const SCRAPE_INTERVAL_MS =
    parseInt(process.env.SCRAPE_INTERVAL_MS, 10) || 15 * 60 * 1000;

class ScraperService {

    constructor() {
        this._running = false;
        this._scraping = false;
        this._timer = null;
        this._seenIds = new Set();
        this._seenPath = null;
        this._browser = null;
        this._playwright = null;
    }

    async start() {

        if (this._running) return;

        this._running = true;

        await this._loadSeen();
        log.info('ScraperService iniciado');

        await this._runCycle();

        this._timer = setInterval(() => this._runCycle(), SCRAPE_INTERVAL_MS);
    }

    async stop() {

        this._running = false;

        if (this._timer) {
            clearInterval(this._timer);
            this._timer = null;
        }

        await this._closeBrowser();
        log.warn('Scraper detenido');
    }

    async forceCycle() {
        return this._runCycle();
    }

    // ─────────────────────────────────────────────
    // CYCLE
    // ─────────────────────────────────────────────

    async _runCycle() {

        if (this._scraping) return;
        this._scraping = true;

        try {

            log.info('Scraping cycle...');

            const results = await Promise.allSettled([
                website.scrape(5, this._seenIds),
                this._scrapeInstagramWrapper(),
            ]);

            let all = [];

            for (const r of results) {

                if (r.status !== 'fulfilled') {
                    log.error(`Scraper error: ${r.reason?.message || r.reason}`);
                    continue;
                }

                const value = r.value;

                // 🔥 FIX: normalizar contrato SIEMPRE array
                if (Array.isArray(value)) {
                    all.push(...value);
                } else if (value?.posts && Array.isArray(value.posts)) {
                    all.push(...value.posts);
                }
            }

            const fresh = all
            .filter(p => p.id && !this._seenIds.has(p.id))
            .slice(0, 1);

            if (fresh.length) {

                fresh.forEach(p => this._seenIds.add(p.id));
                await this._saveSeen();

                log.info(`Posts nuevos: ${fresh.length}`);

                bus.emit(EVENTS.SCRAPER_NEW_POSTS, fresh);

            } else {
                log.info('Sin posts nuevos en este ciclo');
            }

        } catch (err) {
            log.error(`Cycle error: ${err.message}`);
        }

        this._scraping = false;
    }

    // ─────────────────────────────────────────────
    // INSTAGRAM WRAPPER FIXED
    // ─────────────────────────────────────────────

    async _scrapeInstagramWrapper() {

        let page;

        try {

            const browser = await this._getBrowser();
            page = await browser.newPage();

            const posts = await instagram.scrape(page, 5, this._seenIds);

            log.info(`Instagram: ${posts.length} encontrado(s)`);

            // 🔥 FIX: SIEMPRE ARRAY
            return posts || [];

        } catch (err) {

            log.error(`Instagram scrape error: ${err.message}`);

            // 🔥 FIX CRÍTICO: consistencia total
            return [];
        }

    finally {

            if (page && !page.isClosed()) {
                try { await page.close(); } catch (_) {}
            }
        }
    }

    // ─────────────────────────────────────────────
    // BROWSER (UNCHANGED LOGIC)
    // ─────────────────────────────────────────────

    async _getBrowser() {

        if (this._browser && this._browser.isConnected()) {
            return this._browser;
        }

        await this._closeBrowser();

        if (!this._playwright) {
            this._playwright = require('playwright');
        }

        this._browser = await this._playwright.chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
        });

        return this._browser;
    }

    async _closeBrowser() {
        if (this._browser) {
            try { await this._browser.close(); } catch (_) {}
            this._browser = null;
        }
    }

    // ─────────────────────────────────────────────
    // STORAGE (UNCHANGED BUT SAFE)
    // ─────────────────────────────────────────────

    _getSeenPath() {

        if (this._seenPath) return this._seenPath;

        let base;

        try {
            const { app } = require('electron');
            base = app ? app.getPath('userData') : process.cwd();
        } catch (_) {
            base = process.cwd();
        }

        this._seenPath = path.join(base, 'storage', 'seen.json');

        return this._seenPath;
    }

    async _loadSeen() {

        try {

            const p = this._getSeenPath();
            fs.mkdirSync(path.dirname(p), { recursive: true });

            if (fs.existsSync(p)) {
                const raw = fs.readFileSync(p, 'utf8');
                this._seenIds = new Set(JSON.parse(raw));
                log.info(`Seen IDs cargados: ${this._seenIds.size}`);
            }

        } catch (err) {
            log.warn(`Error cargando seen IDs: ${err.message}`);
            this._seenIds = new Set();
        }
    }

    async _saveSeen() {

        try {

            const p = this._getSeenPath();
            const arr = [...this._seenIds].slice(-1000);

            fs.mkdirSync(path.dirname(p), { recursive: true });
            fs.writeFileSync(p, JSON.stringify(arr));

        } catch (err) {
            log.error(`Error guardando seen IDs: ${err.message}`);
        }
    }
}

module.exports = new ScraperService();