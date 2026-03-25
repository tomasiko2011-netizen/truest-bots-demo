/**
 * Booking Demo Bot — Vercel Serverless Webhook Handler
 * Suitable for: barbershop, salon, massage, car wash
 */

const TOKEN = process.env.BOOKING_DEMO_TOKEN;
const ADMIN_ID = process.env.BOOKING_DEMO_ADMIN_ID;

// --- Input sanitization ---
function sanitize(str, maxLen = 100) {
  return String(str || '').slice(0, maxLen).replace(/[*_`\[\]()~>#+\-=|{}.!\\]/g, '\\$&');
}

// --- Config (edit for each client) ---
const SERVICES = [
  { id: 'haircut',  name: 'Стрижка мужская',   price: 3000, duration: 30 },
  { id: 'beard',    name: 'Стрижка бороды',     price: 2000, duration: 20 },
  { id: 'combo',    name: 'Стрижка + борода',   price: 4500, duration: 45 },
  { id: 'coloring', name: 'Окрашивание',        price: 8000, duration: 60 },
];

const WORK_HOURS = Array.from({ length: 10 }, (_, i) => i + 10); // 10..19
const BUSINESS_NAME = 'BarberShop';
const DAY_NAMES = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

// --- In-memory state for name/phone collection (resets on cold start) ---
const sessions = new Map();
const SESSION_TTL = 10 * 60 * 1000; // 10 minutes

function getSession(chatId) {
  const s = sessions.get(chatId);
  if (s && Date.now() - s.ts < SESSION_TTL) return s;
  sessions.delete(chatId);
  return null;
}

function setSession(chatId, data) {
  sessions.set(chatId, { ...data, ts: Date.now() });
}

function clearSession(chatId) {
  sessions.delete(chatId);
}

// --- Telegram API helper ---
async function tg(token, method, body) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

// --- Keyboard builders ---
function mainMenuKb() {
  return {
    inline_keyboard: [
      [{ text: '📋 Записаться', callback_data: 'book' }],
      [{ text: '📖 Мои записи', callback_data: 'my_bookings' }],
      [{ text: 'ℹ️ О нас', callback_data: 'about' }],
    ],
  };
}

function servicesKb() {
  const rows = SERVICES.map((s) => [
    { text: `${s.name} — ${s.price}₸ (${s.duration} мин)`, callback_data: `svc:${s.id}` },
  ]);
  rows.push([{ text: '« Назад', callback_data: 'back_main' }]);
  return { inline_keyboard: rows };
}

function datesKb(svcId) {
  const rows = [];
  const now = new Date();
  for (let i = 1; i <= 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const dayName = DAY_NAMES[d.getDay()];
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    rows.push([{ text: `${dayName}, ${dd}.${mm}`, callback_data: `date:${svcId}:${iso}` }]);
  }
  rows.push([{ text: '« Назад', callback_data: 'book' }]);
  return { inline_keyboard: rows };
}

function timesKb(svcId, date) {
  const rows = [];
  let row = [];
  for (const h of WORK_HOURS) {
    const t = `${String(h).padStart(2, '0')}:00`;
    row.push({ text: t, callback_data: `time:${svcId}:${date}:${t}` });
    if (row.length === 3) {
      rows.push(row);
      row = [];
    }
  }
  if (row.length) rows.push(row);
  rows.push([{ text: '« Назад', callback_data: `svc:${svcId}` }]);
  return { inline_keyboard: rows };
}

// --- Webhook auth ---
function verifyWebhook(req) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return true; // no secret configured = allow (dev mode)
  return req.headers['x-telegram-bot-api-secret-token'] === secret;
}

// --- Main handler ---
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).send('OK');
  if (!verifyWebhook(req)) return res.status(401).send('Unauthorized');

  const update = req.body;
  try {
    if (update.callback_query) {
      await handleCallback(update.callback_query);
    } else if (update.message) {
      await handleMessage(update.message);
    }
  } catch (err) {
    console.error('Handler error:', err);
  }
  return res.status(200).send('OK');
}

export const config = { maxDuration: 10 };

// --- Callback handler ---
async function handleCallback(cb) {
  const chatId = cb.message.chat.id;
  const msgId = cb.message.message_id;
  const data = cb.data;

  // Acknowledge callback
  tg(TOKEN, 'answerCallbackQuery', { callback_query_id: cb.id });

  if (data === 'book') {
    return tg(TOKEN, 'editMessageText', {
      chat_id: chatId,
      message_id: msgId,
      text: 'Выберите услугу:',
      reply_markup: servicesKb(),
    });
  }

  if (data === 'back_main') {
    clearSession(chatId);
    return tg(TOKEN, 'editMessageText', {
      chat_id: chatId,
      message_id: msgId,
      text: `*${BUSINESS_NAME}*\n\nВыберите действие:`,
      parse_mode: 'Markdown',
      reply_markup: mainMenuKb(),
    });
  }

  if (data === 'about') {
    return tg(TOKEN, 'editMessageText', {
      chat_id: chatId,
      message_id: msgId,
      text:
        `*${BUSINESS_NAME}*\n\n` +
        `Адрес: ул. Примерная, 1\n` +
        `Часы работы: 10:00 — 19:00\n` +
        `Телефон: +7 777 123 4567\n\n` +
        `Instagram: @barbershop`,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📋 Записаться', callback_data: 'book' }],
          [{ text: '« Меню', callback_data: 'back_main' }],
        ],
      },
    });
  }

  if (data === 'my_bookings') {
    // No DB in demo — just show a placeholder
    return tg(TOKEN, 'editMessageText', {
      chat_id: chatId,
      message_id: msgId,
      text: 'У вас пока нет записей.\n\n_Это демо-бот — записи не сохраняются между сессиями._',
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📋 Записаться', callback_data: 'book' }],
          [{ text: '« Меню', callback_data: 'back_main' }],
        ],
      },
    });
  }

  // svc:{id} → show dates
  if (data.startsWith('svc:')) {
    const svcId = data.split(':')[1];
    const svc = SERVICES.find((s) => s.id === svcId);
    if (!svc) return;
    return tg(TOKEN, 'editMessageText', {
      chat_id: chatId,
      message_id: msgId,
      text: `Услуга: *${svc.name}*\n\nВыберите дату:`,
      parse_mode: 'Markdown',
      reply_markup: datesKb(svcId),
    });
  }

  // date:{svcId}:{date} → show times
  if (data.startsWith('date:')) {
    const [, svcId, date] = data.split(':');
    const svc = SERVICES.find((s) => s.id === svcId);
    return tg(TOKEN, 'editMessageText', {
      chat_id: chatId,
      message_id: msgId,
      text: `Услуга: *${svc?.name}*\nДата: *${date}*\n\nВыберите время:`,
      parse_mode: 'Markdown',
      reply_markup: timesKb(svcId, date),
    });
  }

  // time:{svcId}:{date}:{time} → ask for name
  if (data.startsWith('time:')) {
    const parts = data.split(':');
    const svcId = parts[1];
    const date = parts[2];
    const time = parts[3] + ':' + parts[4]; // re-join HH:MM
    const svc = SERVICES.find((s) => s.id === svcId);
    setSession(chatId, { step: 'name', svcId, date, time, svc });
    return tg(TOKEN, 'editMessageText', {
      chat_id: chatId,
      message_id: msgId,
      text: `Услуга: *${svc?.name}*\nДата: *${date}*\nВремя: *${time}*\n\nВведите ваше *имя*:`,
      parse_mode: 'Markdown',
    });
  }

  // confirm booking
  if (data === 'confirm') {
    const session = getSession(chatId);
    if (!session || !session.name) {
      return tg(TOKEN, 'editMessageText', {
        chat_id: chatId,
        message_id: msgId,
        text: 'Сессия истекла. Начните заново.',
        reply_markup: mainMenuKb(),
      });
    }

    const { svc, date, time, name, phone } = session;
    clearSession(chatId);

    // Confirmation to user
    await tg(TOKEN, 'editMessageText', {
      chat_id: chatId,
      message_id: msgId,
      text:
        `✅ Вы записаны!\n\n` +
        `*${svc.name}*\n` +
        `${date} в ${time}\n\n` +
        `Ждём вас в *${BUSINESS_NAME}*!`,
      parse_mode: 'Markdown',
    });

    // Notify admin
    if (ADMIN_ID) {
      const username = cb.from?.username || '';
      await tg(TOKEN, 'sendMessage', {
        chat_id: ADMIN_ID,
        text:
          `🆕 Новая запись!\n\n` +
          `Клиент: ${sanitize(name)}\n` +
          `Телефон: ${sanitize(phone, 20)}\n` +
          `Услуга: ${svc.name} (${svc.price}₸)\n` +
          `Дата: ${date} ${time}\n` +
          `TG: @${sanitize(username, 50)}`,
      });
    }
    return;
  }
}

// --- Text message handler (name/phone collection) ---
async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();

  // /start command
  if (text === '/start') {
    clearSession(chatId);
    return tg(TOKEN, 'sendMessage', {
      chat_id: chatId,
      text: `Добро пожаловать в *${BUSINESS_NAME}*!\n\nЗдесь вы можете записаться на услугу онлайн.`,
      parse_mode: 'Markdown',
      reply_markup: mainMenuKb(),
    });
  }

  // Check for active session
  const session = getSession(chatId);
  if (!session) return;

  if (session.step === 'name') {
    setSession(chatId, { ...session, step: 'phone', name: text });
    return tg(TOKEN, 'sendMessage', {
      chat_id: chatId,
      text: 'Введите ваш *телефон*:',
      parse_mode: 'Markdown',
    });
  }

  if (session.step === 'phone') {
    const updated = { ...session, step: 'confirm', phone: text };
    setSession(chatId, updated);
    const { svc, date, time, name } = updated;
    return tg(TOKEN, 'sendMessage', {
      chat_id: chatId,
      text:
        `Подтвердите запись:\n\n` +
        `Услуга: *${svc.name}*\n` +
        `Дата: *${date}*\n` +
        `Время: *${time}*\n` +
        `Имя: *${name}*\n` +
        `Телефон: *${text}*\n` +
        `Цена: *${svc.price}₸*`,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ Подтвердить', callback_data: 'confirm' }],
          [{ text: '❌ Отменить', callback_data: 'back_main' }],
        ],
      },
    });
  }
}
