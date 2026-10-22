/**
 * Small in-memory limits (single container): sliding-window rate limits with a bounded key store,
 * and a concurrency gate for expensive jobs (export, import, preview).
 */
const MAX_KEYS = 20000;

export class RateLimit {
  constructor({ windowMs, max }) {
    this.windowMs = windowMs;
    this.max = max;
    this.hits = new Map();
  }
  _list(key) {
    const now = Date.now();
    const list = (this.hits.get(key) || []).filter((t) => now - t < this.windowMs);
    if (list.length) this.hits.set(key, list);
    else this.hits.delete(key);
    return list;
  }
  blocked(key) {
    return this._list(key).length >= this.max;
  }
  hit(key) {
    if (this.hits.size >= MAX_KEYS && !this.hits.has(key)) {
      // drop the oldest quarter instead of growing without bound
      let n = Math.floor(MAX_KEYS / 4);
      for (const k of this.hits.keys()) {
        this.hits.delete(k);
        if (--n <= 0) break;
      }
    }
    this.hits.set(key, [...this._list(key), Date.now()]);
  }
  reset(key) {
    this.hits.delete(key);
  }
}

/** Express middleware: limit requests per client IP. */
export function limitByIp(limit, message = 'Zu viele Anfragen. Bitte kurz warten.') {
  return (req, res, next) => {
    const key = req.ip || 'unknown';
    if (limit.blocked(key)) {
      res.set('Retry-After', String(Math.ceil(limit.windowMs / 1000)));
      return res.status(429).json({ error: message });
    }
    limit.hit(key);
    next();
  };
}

export class Gate {
  constructor({ global, perUser }) {
    this.global = global;
    this.perUser = perUser;
    this.running = 0;
    this.byUser = new Map();
  }
  /** Runs fn if capacity is free, otherwise throws a 503/429 error. */
  async run(userId, fn) {
    const mine = this.byUser.get(userId) || 0;
    if (mine >= this.perUser) throw Object.assign(new Error('Es läuft bereits ein Export oder Import. Bitte warten, bis er fertig ist.'), { status: 429 });
    if (this.running >= this.global) throw Object.assign(new Error('Der Server ist gerade ausgelastet. Bitte in einer Minute erneut versuchen.'), { status: 503 });
    this.running++;
    this.byUser.set(userId, mine + 1);
    try {
      return await fn();
    } finally {
      this.running--;
      const left = (this.byUser.get(userId) || 1) - 1;
      if (left > 0) this.byUser.set(userId, left);
      else this.byUser.delete(userId);
    }
  }
}

export const jobGate = new Gate({ global: Number(process.env.MAX_PARALLEL_JOBS || 3), perUser: 1 });
// .h5p downloads: lighter than packaging, and people click several in a row – allow two at once per person.
export const downloadGate = new Gate({ global: Number(process.env.MAX_PARALLEL_DOWNLOADS || 4), perUser: 2 });
