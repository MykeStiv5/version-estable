'use strict';

// CORRECCIÓN #22: Los polyfills File/Blob deben ir ANTES de cualquier require
// de whatsapp-web.js para que los encuentre cuando inicializa.
global.File = class File {};
global.Blob = class Blob {};

require('dotenv').config();

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

const BotController = require('../src/core/BotController');
const { bus, EVENTS } = require('../src/shared/EventBus');

let win         = null;
let isBotStarting = false;

// ─── Window ───────────────────────────────────────────────────────────────────

function createWindow() {
    win = new BrowserWindow({
        width:  1200,
        height: 800,
        backgroundColor: '#0b1220',
        show: false,
        webPreferences: {
            preload:          path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration:  false,
            sandbox:          false,
        },
    });

    win.loadFile(path.join(process.cwd(), 'ui/index.html'));

    win.once('ready-to-show', () => win.show());

    win.on('closed', () => { win = null; });
}

// ─── Safe send ────────────────────────────────────────────────────────────────

const send = (channel, data) => {
    if (!win || win.isDestroyed()) return;
    win.webContents.send(channel, data);
};

// ─── Event bridge (backend → UI) ─────────────────────────────────────────────

function bindBus() {

    bus.on(EVENTS.WA_QR, (qr) => {
        send('wa:qr', qr);
        send('wa:status', 'QR_READY');
    });

    bus.on(EVENTS.WA_READY, () => {
        console.log('[MAIN] WA READY');
        send('wa:status',     'CONNECTED');
        send('system:status', 'RUNNING');
    });

    bus.on(EVENTS.WA_DISCONNECTED, (reason) => {
        send('wa:status',     'DISCONNECTED');
        send('system:status', 'DEGRADED');
        send('system:log', { level: 'warn', source: 'system', message: `WhatsApp desconectado: ${reason}` });
    });

    // CORRECCIÓN #23: Nuevo evento LOGOUT hacia la UI para que muestre
    // un aviso claro al usuario de que debe re-escanear el QR.
    bus.on(EVENTS.WA_LOGOUT, () => {
        send('wa:status',     'LOGOUT');
        send('system:status', 'STOPPED');
        send('system:log', { level: 'warn', source: 'system', message: 'Sesión cerrada — re-escanea el QR' });
    });

    bus.on(EVENTS.SCRAPER_NEW_POSTS, (posts) => {
        send('scraper:new', posts);
    });

    bus.on(EVENTS.LOG, (log) => {
        send('log:event', log);
    });

    bus.on(EVENTS.QUEUE_SENT, (data) => {
        send('queue:sent', data);
    });

    bus.on(EVENTS.QUEUE_FAILED, (data) => {
        send('queue:failed', data);
    });

    bus.on(EVENTS.BOT_STARTED, () => {
        send('system:status', 'RUNNING');
    });

    bus.on(EVENTS.BOT_STOPPED, () => {
        send('system:status', 'STOPPED');
    });
}

// ─── IPC (UI → backend) ───────────────────────────────────────────────────────

function bindIPC() {

    ipcMain.handle('bot:start', async () => {
        if (isBotStarting) return { ok: true, status: 'starting' };

        isBotStarting = true;
        try {
            await BotController.start();
            return { ok: true, status: 'started' };
        } catch (err) {
            return { ok: false, error: err.message };
        } finally {
            isBotStarting = false;
        }
    });

    ipcMain.handle('bot:stop', async () => {
        try {
            await BotController.stop();
            return { ok: true };
        } catch (err) {
            return { ok: false, error: err.message };
        }
    });

    ipcMain.on('bot:manual',      (_, data) => BotController.sendManual(data));
    ipcMain.on('bot:force-scrape', ()       => BotController.forceScrape());
}

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
    createWindow();
    bindBus();
    bindIPC();

    // CORRECCIÓN #24: El setTimeout de 800 ms + la llamada al bot:start desde
    // la UI creaban un DOBLE ARRANQUE garantizado:
    //   1) setTimeout → BotController.start() a los 800 ms
    //   2) UI carga → botAPI.startBot() → IPC bot:start → BotController.start()
    //
    // Aunque BotController.start() tiene guarda `this.started`, la guarda
    // isBotStarting del IPC NO protege contra el setTimeout porque son
    // caminos diferentes. El resultado era dos inicializaciones de WhatsApp
    // concurrentes con dos instancias de Puppeteer = caos.
    //
    // SOLUCIÓN: arranque automático con un delay razonable (2 s para que la
    // ventana esté completamente lista), SIN que la UI también lo dispare.
    setTimeout(() => {
        BotController.start();
    }, 2000);
});

app.on('before-quit', async () => {
    try { await BotController.stop(); } catch (_) {}
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (!win) createWindow();
});
