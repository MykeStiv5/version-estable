'use strict';

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

/**
 * JsonStore - Persistencia segura tipo mini-database local
 * - Escritura atómica (evita corrupción)
 * - Cache en memoria
 * - Auto create directories
 */
class JsonStore {
  constructor(fileName) {
    const basePath = app
      ? app.getPath('userData')
      : path.join(process.cwd(), 'storage');

    this.filePath = path.join(basePath, fileName);
    this.cache = null;

    this._ensureDir();
    this._load();
  }

  _ensureDir() {
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true });
  }

  _load() {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      this.cache = JSON.parse(raw);
    } catch {
      this.cache = {};
      this._commit();
    }
  }

  _commit() {
    const tmp = this.filePath + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.cache, null, 2));
    fs.renameSync(tmp, this.filePath);
  }

  get(key, fallback = null) {
    return this.cache?.[key] ?? fallback;
  }

  set(key, value) {
    this.cache[key] = value;
    this._commit();
  }

  push(key, value) {
    if (!Array.isArray(this.cache[key])) {
      this.cache[key] = [];
    }
    this.cache[key].push(value);
    this._commit();
  }

  delete(key) {
    delete this.cache[key];
    this._commit();
  }
}

module.exports = JsonStore;