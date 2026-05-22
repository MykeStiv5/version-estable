'use strict';

const { contextBridge, ipcRenderer } = require('electron');

/**
 * PRELOAD PRODUCTION LAYER
 * - Expone API segura a UI
 * - No permite acceso directo a Node.js
 * - Solo canales controlados
 */

contextBridge.exposeInMainWorld('botAPI', {

  // =========================
  // BOT CONTROL
  // =========================
  startBot: () => ipcRenderer.invoke('bot:start'),
  stopBot: () => ipcRenderer.invoke('bot:stop'),

  forceScrape: () => ipcRenderer.send('bot:force-scrape'),

  sendManual: (data) => ipcRenderer.send('bot:manual', data),

  // =========================
  // EVENTS → UI
  // =========================
  onWhatsAppQR: (callback) =>
    ipcRenderer.on('wa:qr', (_, data) => callback(data)),

  onWhatsAppStatus: (callback) =>
    ipcRenderer.on('wa:status', (_, data) => callback(data)),

  onScraperNew: (callback) =>
    ipcRenderer.on('scraper:new', (_, data) => callback(data)),

  onLogs: (callback) =>
    ipcRenderer.on('log:event', (_, data) => callback(data)),

  onQueueSent: (callback) =>
    ipcRenderer.on('queue:sent', (_, data) => callback(data)),

  onQueueFailed: (callback) =>
    ipcRenderer.on('queue:failed', (_, data) => callback(data)),

  onSystemStatus: (callback) =>
    ipcRenderer.on('system:status', (_, data) => callback(data)),
});