'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { app } = require('electron');

/**
 * JsonStore PRO
 * -------------------------------------------------
 * Mini persistencia tipo DB local basada en JSON.
 *
 * Diseño:
 * - Cache en memoria (Set/Map)
 * - Persistencia en disco (JSON seguro)
 * - Write atomic (evita corrupción)
 * - Deduplicación por hash estable
 */
class JsonStore {
  constructor(filename = 'store.json') {
    this._filePath = this._resolvePath(filename);

    this._memory = new Set();      // IDs únicos rápidos
    this._meta = new Map();        // metadata opcional

    this._loaded = false;
    this._writeQueue = Promise.resolve();
  }

  // =========================
  // INIT
  // =========================

  async init() {
    if (this._loaded) return;

    await this._ensureFile();
    await this._loadFromDisk();

    this._loaded = true;
  }

  // =========================
  // PUBLIC API
  // =========================

  /**
   * Verifica si existe un ID
   */
  has(id) {
    return this._memory.has(id);
  }

  /**
   * Inserta si no existe (deduplicación real)
   */
  async add(id, meta = null) {
    await this.init();

    if (this._memory.has(id)) {
      return false; // duplicado
    }

    this._memory.add(id);

    if (meta) {
      this._meta.set(id, meta);
    }

    this._queueWrite();
    return true;
  }

  /**
   * Bulk insert (optimizado scraping)
   */
  async addMany(items = []) {
    await this.init();

    const added = [];

    for (const item of items) {
      const id = typeof item === 'string' ? item : item.id;

      if (!this._memory.has(id)) {
        this._memory.add(id);
        if (item.meta) this._meta.set(id, item.meta);
        added.push(id);
      }
    }

    if (added.length > 0) {
      this._queueWrite();
    }

    return added;
  }

  /**
   * Devuelve metadata
   */
  get(id) {
    return this._meta.get(id) || null;
  }

  /**
   * Snapshot del store
   */
  snapshot() {
    return {
      size: this._memory.size,
      items: [...this._memory],
    };
  }

  /**
   * Limpieza controlada
   */
  clear() {
    this._memory.clear();
    this._meta.clear();
    this._queueWrite();
  }

  // =========================
  // HASH UTIL (para scraping)
  // =========================

  createHash(input) {
    return crypto
      .createHash('sha256')
      .update(input)
      .digest('hex');
  }

  // =========================
  // DISK OPERATIONS
  // =========================

  async _loadFromDisk() {
    try {
      if (!fs.existsSync(this._filePath)) return;

      const raw = fs.readFileSync(this._filePath, 'utf-8');
      const data = JSON.parse(raw);

      if (Array.isArray(data.items)) {
        data.items.forEach(item => this._memory.add(item));
      }

      if (data.meta) {
        Object.entries(data.meta).forEach(([k, v]) => {
          this._meta.set(k, v);
        });
      }

    } catch (err) {
      console.warn('[JsonStore] Error cargando archivo, se reinicia:', err.message);
      this._memory.clear();
      this._meta.clear();
    }
  }

  async _ensureFile() {
    if (!fs.existsSync(this._filePath)) {
      this._writeToDisk({ items: [], meta: {} });
    }
  }

  _queueWrite() {
    // evita writes concurrentes (CRÍTICO en scraping)
    this._writeQueue = this._writeQueue.then(() => this._write());
  }

  async _write() {
    const data = {
      items: [...this._memory],
      meta: Object.fromEntries(this._meta),
      updatedAt: Date.now(),
    };

    this._writeToDisk(data);
  }

  _writeToDisk(data) {
    try {
      const tmpPath = this._filePath + '.tmp';

      fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2));
      fs.renameSync(tmpPath, this._filePath); // atomic replace

    } catch (err) {
      console.error('[JsonStore] Error escribiendo archivo:', err.message);
    }
  }

  // =========================
  // PATH RESOLUTION
  // =========================

  _resolvePath(filename) {
    const base = app
      ? app.getPath('userData')
      : path.join(process.cwd(), 'storage');

    if (!fs.existsSync(base)) {
      fs.mkdirSync(base, { recursive: true });
    }

    return path.join(base, filename);
  }
}

/**
 * Singleton global (importante para consistencia)
 */
module.exports = new JsonStore('seen_store.json');