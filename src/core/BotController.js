'use strict';

const { bus, EVENTS } = require('../shared/EventBus');
const { createSourceLogger } = require('../services/Logger');
const log = createSourceLogger('BotController');

const waService = require('../services/whatsapp/WhatsAppService');
const queue = require('../services/whatsapp/WhatsAppQueue');
const scraper = require('../services/scrapers/ScraperService');

class BotController {

    constructor() {

        this.started = false;

        // 🔴 FIX: evitar duplicados críticos
        this.wareadyHandled = false;
        this.scraperStarted = false;

        this._bindEvents();
    }

    async start() {

        if (this.started) {
            log.warn('start() ignorado — ya iniciado');
            return;
        }

        this.started = true;

        log.info('Iniciando sistema...');

        try {
            await waService.initialize();
            log.info('WhatsApp inicializando...');
        } catch (err) {
            log.error(`Error WA: ${err.message}`);
            this.started = false;
        }
    }

    async stop() {

        log.info('Deteniendo sistema...');

        try {

            await scraper.stop();
            queue.stop();
            await waService.destroy();

            this.started = false;
            this.wareadyHandled = false;
            this.scraperStarted = false;

            bus.emit(EVENTS.BOT_STOPPED);

        } catch (err) {
            log.error(`Stop error: ${err.message}`);
        }
    }

    sendManual(data) {

        return queue.enqueuePost({
            title: data.title,
            description: data.description,
            link: data.link,
            imageUrl: data.imageData || null,
        });
    }

    async forceScrape() {
        return scraper.forceCycle();
    }

    _bindEvents() {

        bus.on(EVENTS.WA_READY, async () => {

            // 🔴 FIX: evitar duplicados
            if (this.wareadyHandled) return;
            this.wareadyHandled = true;

            log.info('WA READY → arrancando scraper');

            try {
                if (!this.scraperStarted) {
                    this.scraperStarted = true;
                    await scraper.start();
                }
            } catch (err) {
                log.error(`Scraper error: ${err.message}`);
            }

            bus.emit(EVENTS.BOT_STARTED);
        });

        bus.on(EVENTS.WA_DISCONNECTED, async (reason) => {

            log.warn(`WA desconectado: ${reason}`);

            // reset control state
            this.wareadyHandled = false;
            this.scraperStarted = false;
        });

        bus.on(EVENTS.WA_LOGOUT, async () => {

            log.warn('WA LOGOUT');

            await scraper.stop();
            queue.stop();

            this.started = false;
            this.wareadyHandled = false;
            this.scraperStarted = false;

            bus.emit(EVENTS.BOT_STOPPED);
        });

        bus.on(EVENTS.SCRAPER_NEW_POSTS, (posts) => {

            if (!Array.isArray(posts) || !posts.length) return;

            log.info(`Scraper → ${posts.length} posts`);

            posts.forEach(post => {
                queue.enqueuePost(post);
            });
        });
    }
}

module.exports = new BotController();