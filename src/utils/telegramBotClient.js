import { logger } from './logger.js';

async function getFetch() {
  if (typeof fetch === 'function') return fetch;
  // Fallback for older Node versions
  const mod = await import('node-fetch');
  return mod.default;
}

export async function notifyViaTelegramBot(text, opts = {}) {
  const baseUrl = process.env.TELEGRAM_BOT_SERVICE_URL;
  const token = process.env.TELEGRAM_BOT_INTERNAL_TOKEN;

  if (!baseUrl || !token) {
    logger.warn('Telegram bot service is not configured', {
      hasUrl: Boolean(baseUrl),
      hasToken: Boolean(token),
    });
    return { ok: false, skipped: true, reason: 'not_configured' };
  }

  try {
    const _fetch = await getFetch();
    const res = await _fetch(`${baseUrl.replace(/\/$/, '')}/internal/notify`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-internal-token': token,
      },
      body: JSON.stringify({
        text,
        chatId: opts.chatId,
        parse_mode: opts.parseMode || 'HTML',
      }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      logger.warn('Telegram bot notify failed', { status: res.status, data });
      return { ok: false, status: res.status, data };
    }
    return { ok: true, data };
  } catch (error) {
    logger.warn('Telegram bot notify error', { error: error?.message || String(error) });
    return { ok: false, error: error?.message || String(error) };
  }
}

