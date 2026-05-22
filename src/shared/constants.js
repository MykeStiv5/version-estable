'use strict';

/**
 * CONSTANTS PRO
 * ─────────────────────────────────────────────────────────────
 * Fuente única de verdad para:
 * - Config del sistema
 * - IDs fijos
 * - tiempos críticos
 * - límites de seguridad
 */

// =========================
// WHATSAPP
// =========================

const WHATSAPP = Object.freeze({
  // Grupo destino principal (tu canal)
  TARGET_CHAT_ID: '120363408686646018@g.us',

  // Reintentos envío mensajes
  MAX_SEND_RETRIES: 3,

  // Timeout de envío
  SEND_TIMEOUT_MS: 30000,

  // Reconexión WhatsApp Web
  RECONNECT_BASE_MS: 5000,
  RECONNECT_MAX_MS: 60000,
  RECONNECT_MAX_TRIES: 5,
});

// =========================
// QUEUE
// =========================

const QUEUE = Object.freeze({
  INTER_MESSAGE_DELAY_MS: 1500,
  RETRY_DELAYS_MS: [5000, 15000, 30000],
  MAX_QUEUE_SIZE: 10000,
});

// =========================
// SCRAPING
// =========================

const SCRAPER = Object.freeze({
  INTERVAL_MS: 15 * 60 * 1000, // 15 min
  MAX_POSTS_PER_SOURCE: 5,

  INSTAGRAM_URL:
    'https://www.instagram.com/titularizadora.colombiana/',

  WEBSITE_URL:
    'https://www.titularizadora.com/es',

  USER_AGENT:
    'Mozilla/5.0 (Bot Titularizadora 1.0)',
});

// =========================
// STORAGE
// =========================

const STORAGE = Object.freeze({
  QUEUE_FILE: 'storage/queue.json',
  SEEN_POSTS_FILE: 'storage/seen_posts.json',
  LOG_DIR: 'logs',
});

// =========================
// SYSTEM
// =========================

const SYSTEM = Object.freeze({
  MAX_EVENT_HISTORY: 300,
  LOG_LEVEL: 'info',
});

module.exports = {
  WHATSAPP,
  QUEUE,
  SCRAPER,
  STORAGE,
  SYSTEM,
};