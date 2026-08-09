// Minimal logger placeholder — swap for pino/winston later if needed.
export const logger = {
  info: (...args) => console.log('[info]', ...args),
  error: (...args) => console.error('[error]', ...args),
};
