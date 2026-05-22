'use strict';

const fs = require('fs');
const path = require('path');

const INSTAGRAM_URL =
    'https://www.instagram.com/titularizadora.colombiana/';

class InstagramScraper {

    constructor() {
        this.seenFile = path.join(process.cwd(), 'storage', 'ig_seen.json');
        this.seenIds = new Set();
        this._loadSeen();
    }

    // ─────────────────────────────
    // LOAD PERSISTENTE
    // ─────────────────────────────

    _loadSeen() {
        try {

            if (!fs.existsSync(this.seenFile)) {
                fs.mkdirSync(path.dirname(this.seenFile), { recursive: true });
                fs.writeFileSync(this.seenFile, JSON.stringify([]));
            }

            const raw = fs.readFileSync(this.seenFile, 'utf8');
            const data = JSON.parse(raw);

            this.seenIds = new Set(data || []);

            console.log(`[IG] Seen cargados: ${this.seenIds.size}`);

        } catch (err) {
            console.log('[IG] Error loading seen:', err.message);
            this.seenIds = new Set();
        }
    }

    // ─────────────────────────────
    // SAVE PERSISTENTE
    // ─────────────────────────────

    _saveSeen() {
        try {

            const arr = [...this.seenIds].slice(-1000); // límite de memoria

            fs.writeFileSync(
                this.seenFile,
                JSON.stringify(arr, null, 2)
            );

        } catch (err) {
            console.log('[IG] Error saving seen:', err.message);
        }
    }

    // ─────────────────────────────
    // SCRAPE
    // ─────────────────────────────

    async scrape(page, max = 5) {

        try {

            await page.goto(INSTAGRAM_URL, {
                waitUntil: 'domcontentloaded',
                timeout: 60000
            });

            await page.waitForTimeout(8000);

            await page.evaluate(() => {
                window.scrollBy(0, window.innerHeight);
            });

            await page.waitForTimeout(3000);

            const posts = await page.evaluate((max) => {

                const links = Array.from(
                    document.querySelectorAll('a[href*="/p/"], a[href*="/reel/"]')
                );

                const unique = [...new Map(
                    links.map(a => [a.href, a])
                ).values()];

                return unique.slice(0, max).map(a => {

                    const href = a.href;
                    const code = href.split('/').filter(Boolean).pop();

                    return {
                        id: 'ig_' + code,
                        source: 'instagram',
                        title: 'Nueva publicación Instagram',
                        description: 'Titularizadora Colombiana',
                        link: href,
                        imageUrl: null
                    };

                }).filter(p => p.id);

            }, max);

            // ─────────────────────────────
            // 🔥 ANTI DUPLICADO REAL
            // ─────────────────────────────

            const fresh = [];

            for (const post of posts) {

                if (!this.seenIds.has(post.id)) {
                    this.seenIds.add(post.id);
                    fresh.push(post);
                }
            }

            if (fresh.length > 0) {
                this._saveSeen();
            }

            console.log(`[IG] nuevos: ${fresh.length}`);

            return fresh;

        } catch (err) {

            console.log('[IG ERROR]', err.message);
            return [];
        }
    }
}

module.exports = new InstagramScraper();