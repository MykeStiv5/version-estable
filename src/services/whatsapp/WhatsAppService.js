'use strict';

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');
const { bus, EVENTS } = require('../../shared/EventBus');

class WhatsAppService {

    constructor() {
        this.client = null;
        this.ready = false;
        this.initializing = false;
    }

    get isReady() {
        return this.ready;
    }

    async initialize() {

        if (this.initializing || this.ready) return;
        this.initializing = true;

        console.log('[WA] Inicializando...');

        this.client = new Client({

            authStrategy: new LocalAuth({
                dataPath: path.join(process.cwd(), '.wwebjs_auth')
            }),

            webVersionCache: undefined,

            puppeteer: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu'
                ]
            }
        });

        this._bindEvents();

        try {
            await this.client.initialize();
        } catch (err) {
            console.error('[WA] INIT ERROR:', err.message);
            this._reset();
            setTimeout(() => this.initialize(), 5000);
        }
    }

    _bindEvents() {

        const c = this.client;

        c.on('qr', async (qr) => {
            const qrBase64 = await qrcode.toDataURL(qr);
            console.log('[WA] QR generado');
            bus.emit(EVENTS.WA_QR, qrBase64);
        });

        c.on('ready', () => {
            console.log('[WA] READY');
            this.ready = true;
            this.initializing = false;
            bus.emit(EVENTS.WA_READY);
        });

        c.on('auth_failure', (msg) => {
            console.error('[WA] AUTH FAIL:', msg);
            this._reset();
        });

        c.on('disconnected', (reason) => {
            console.warn('[WA] DISCONNECTED:', reason);
            this._reset();
            setTimeout(() => this.initialize(), 5000);
        });
    }

    async sendMessage(chatId, text) {

        if (!this.ready) {
            throw new Error('WhatsApp no listo');
        }

        return this.client.sendMessage(chatId, text);
    }

    _reset() {
        this.ready = false;
        this.initializing = false;

        try {
            if (this.client) this.client.destroy();
        } catch (_) {}

        this.client = null;
    }
}

module.exports = new WhatsAppService();