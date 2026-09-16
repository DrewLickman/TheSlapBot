export const PREVIEW_TTL_MS = 10 * 60 * 1000;

function releaseColorData(entry) {
  entry.avatarBuffer = null;
  entry.input = null;
  if (entry.colorInteraction) {
    entry.colorInteraction.editReply({ content: 'This preview is closed.', components: [] }).catch(() => {});
    entry.colorInteraction = null;
  }
}

export function isPreviewOwner(preview, userId) {
  return Boolean(preview && typeof userId === 'string' && preview.ownerId === userId);
}

export class PreviewStore {
  #entries = new Map();

  constructor({
    ttlMs = PREVIEW_TTL_MS,
    onExpire = () => {},
    onError = () => {},
    now = Date.now,
    unrefTimers = true,
  } = {}) {
    this.ttlMs = ttlMs;
    this.onExpire = onExpire;
    this.onError = onError;
    this.now = now;
    this.unrefTimers = unrefTimers;
  }

  create(messageId, data) {
    this.delete(messageId);
    const entry = {
      ...data,
      state: 'preview',
      expiresAt: this.now() + this.ttlMs,
      timer: null,
    };

    this.#entries.set(messageId, entry);
    entry.timer = setTimeout(() => {
      if (this.#entries.get(messageId) !== entry) return;
      this.#entries.delete(messageId);
      entry.state = 'expired';
      entry.buffer = null;
      releaseColorData(entry);
      Promise.resolve()
        .then(() => this.onExpire(messageId, entry))
        .catch((error) => this.onError(error));
    }, this.ttlMs);
    if (this.unrefTimers) entry.timer.unref?.();

    return entry;
  }

  get(messageId) {
    return this.#entries.get(messageId);
  }

  claim(messageId) {
    const entry = this.get(messageId);
    if (!entry || entry.state !== 'preview' || entry.expiresAt <= this.now()) return false;
    entry.state = 'posting';
    clearTimeout(entry.timer);
    entry.timer = null;
    return true;
  }

  delete(messageId, state = 'done') {
    const entry = this.#entries.get(messageId);
    if (!entry) return undefined;
    clearTimeout(entry.timer);
    this.#entries.delete(messageId);
    entry.timer = null;
    entry.state = state;
    entry.buffer = null;
    releaseColorData(entry);
    return entry;
  }

  clear() {
    for (const messageId of this.#entries.keys()) this.delete(messageId);
  }

  get size() {
    return this.#entries.size;
  }
}
