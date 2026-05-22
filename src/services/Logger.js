'use strict';

/**
 * LOGGER PRO
 * ─────────────────────────────────────────────────────────────
 * Sistema de logging tipo SaaS interno:
 * - Logs estructurados
 * - Archivos por nivel
 * - Integración con EventBus
 * - Trazabilidad por servicio (source)
 * - Compatible con Electron + Node
 */

const fs = require('fs');
const path = require('path');
const { format } = require('util');

const { bus, EVENTS } = require('../shared/EventBus');
const { STORAGE } = require('../shared/constants');

// =========================
// UTILIDADES
// =========================

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function formatMessage(args) {
  return args.map(a =>
    typeof a === 'object' ? JSON.stringify(a) : String(a)
  ).join(' ');
}

// =========================
// LOGGER CORE
// =========================

class Logger {
  constructor(source = 'SYSTEM') {
    this.source = source;

    const baseDir = path.resolve(process.cwd(), STORAGE.LOG_DIR);

    this.paths = {
      info: path.join(baseDir, 'info.log'),
      warn: path.join(baseDir, 'warn.log'),
      error: path.join(baseDir, 'error.log'),
      debug: path.join(baseDir, 'debug.log'),
    };

    ensureDir(baseDir);
  }

  // =========================
  // INTERNAL WRITE
  // =========================

  _write(level, message) {
    const timestamp = new Date().toISOString();

    const line = `[${timestamp}] [${level.toUpperCase()}] [${this.source}] ${message}\n`;

    // Archivo
    try {
      fs.appendFileSync(this.paths[level], line);
    } catch (err) {
      console.error('Logger write error:', err.message);
    }

    // EventBus (UI realtime)
    bus.emit(EVENTS.LOG, {
      level,
      source: this.source,
      message,
      timestamp,
    });

    // Console bonito
    if (level === 'error') {
      console.error(line.trim());
    } else if (level === 'warn') {
      console.warn(line.trim());
    } else {
      console.log(line.trim());
    }
  }

  // =========================
  // API PUBLICA
  // =========================

  info(...args) {
    this._write('info', formatMessage(args));
  }

  warn(...args) {
    this._write('warn', formatMessage(args));
  }

  error(...args) {
    this._write('error', formatMessage(args));
  }

  debug(...args) {
    this._write('debug', formatMessage(args));
  }

  // =========================
  // HELPERS AVANZADOS
  // =========================

  section(title) {
    this.info(`\n========== ${title} ==========\n`);
  }

  trace(label, data) {
    this.debug(label, data);
  }
}

// =========================
// FACTORY (IMPORTANTE)
// =========================

function createSourceLogger(source) {
  return new Logger(source);
}

module.exports = {
  createSourceLogger,
};