/**
 * Price Monitor Demo Bot — Vercel Serverless Webhook Handler
 * Suitable for: e-commerce, marketplace sellers, wholesalers
 * Demo version: uses mock data instead of real price scraping
 */

const TOKEN = process.env.PRICE_DEMO_TOKEN;
const ADMIN_ID = process.env.PRICE_DEMO_ADMIN_ID;

// --- Mock data with your price vs competitor ---
const DEMO_PRODUCTS = [
  { name: "iPhone 15 Pro",   source: "Kaspi",       price: 489990, prev: 499990, your: 519990, currency: "\u20b8" },
  { name: "Samsung S24",     source: "Wildberries",  price: 398000, prev: 385000, your: 410000, currency: "\u20b8" },
  { name: "MacBook Air M3",  source: "Ozon",         price: 699990, prev: 699990, your: 729000, currency: "\u20b8" },
  { name: "AirPods Pro 2",   source: "Kaspi",        price: 89990,  prev: 94990,  your: 92000,  currency: "\u20b8" },
  { name: "Dyson V15",       source: "Wildberries",  price: 299990, prev: 289990, your: 315000, currency: "\u20b8" },
];

// --- Telegram API helper ---
async function tg(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

// --- Helpers ---
function fmt(n) {
  return n.toLocaleString('ru-RU');
}

function priceChange(product) {
  const diff = product.price - product.prev;
  if (diff === 0) return ' (=)';
  const arrow = diff > 0 ? '\u2191' : '\u2193';
  const pct = ((diff / product.prev) * 100).toFixed(1);
  const sign = diff > 0 ? '+' : '';
  return ` (${arrow}${sign}${fmt(diff)}${product.currency}, ${sign}${pct}%)`;
}

// --- Keyboards ---
function mainMenuKb() {
  return {
    inline_keyboard: [
      [{ text: '\ud83d\udce6 \u041c\u043e\u0438 \u0442\u043e\u0432\u0430\u0440\u044b', callback_data: 'my_products' }],
      [{ text: '\u2795 \u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0442\u043e\u0432\u0430\u0440', callback_data: 'add_product' }],
      [{ text: '\ud83d\udd04 \u041f\u0440\u043e\u0432\u0435\u0440\u0438\u0442\u044c \u0446\u0435\u043d\u044b', callback_data: 'check_now' }],
      [{ text: '\ud83d\udcca \u041e\u0442\u0447\u0451\u0442', callback_data: 'report' }],
    ],
  };
}

function backMenuKb(extra = []) {
  return {
    inline_keyboard: [
      ...extra,
      [{ text: '\u00ab\u00ab \u041c\u0435\u043d\u044e', callback_data: 'back_main' }],
    ],
  };
}

// --- Handlers ---

function handleStart(chatId) {
  return tg('sendMessage', {
    chat_id: chatId,
    text:
      '*Мониторинг цен конкурентов*\n\n' +
      'Как это работает:\n' +
      '1. Вы добавляете товары конкурентов (ссылка на Kaspi/WB/Ozon)\n' +
      '2. Указываете свою цену на этот же товар\n' +
      '3. Бот каждый час проверяет цены конкурентов\n' +
      '4. Получаете алерт если цена изменилась\n\n' +
      '*Что показывает:*\n' +
      '• Ваша цена vs цена конкурента\n' +
      '• Разница в % (дороже/дешевле)\n' +
      '• Динамика: выросла или упала цена\n' +
      '• Отчёт по всем товарам\n\n' +
      '_Это демо-версия с примерами данных._',
    parse_mode: 'Markdown',
    reply_markup: mainMenuKb(),
  });
}

function handleMyProducts(chatId, msgId) {
  let text = '*Ваши товары:*\n\n';
  for (const p of DEMO_PRODUCTS) {
    const diff = p.your - p.price;
    const diffPct = ((diff / p.price) * 100).toFixed(1);
    const yourStatus = diff > 0 ? `дороже на ${diffPct}%` : diff < 0 ? `дешевле на ${Math.abs(diffPct)}%` : "одинаково";
    const change = priceChange(p);

    text += `*${p.name}* (${p.source})\n`;
    text += `   Конкурент: ${fmt(p.price)}${p.currency}${change}\n`;
    text += `   Вы: ${fmt(p.your)}${p.currency} — ${yourStatus}\n\n`;
  }
  text += `_Отслеживается: ${DEMO_PRODUCTS.length} товаров_`;

  return tg('editMessageText', {
    chat_id: chatId,
    message_id: msgId,
    text,
    parse_mode: 'Markdown',
    reply_markup: backMenuKb([
      [{ text: 'Проверить сейчас', callback_data: 'check_now' }],
      [{ text: 'Добавить товар', callback_data: 'add_product' }],
    ]),
  });
}

function handleAddProduct(chatId, msgId) {
  return tg('editMessageText', {
    chat_id: chatId,
    message_id: msgId,
    text:
      '*\u0414\u043e\u0431\u0430\u0432\u043b\u0435\u043d\u0438\u0435 \u0442\u043e\u0432\u0430\u0440\u0430*\n\n' +
      '\u041e\u0442\u043f\u0440\u0430\u0432\u044c\u0442\u0435 \u0441\u0441\u044b\u043b\u043a\u0443 \u043d\u0430 \u0442\u043e\u0432\u0430\u0440 \u043a\u043e\u043d\u043a\u0443\u0440\u0435\u043d\u0442\u0430.\n\n' +
      '\u041f\u043e\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u044e\u0442\u0441\u044f: Kaspi, Wildberries, Ozon, \u043b\u044e\u0431\u044b\u0435 \u043c\u0430\u0433\u0430\u0437\u0438\u043d\u044b.\n\n' +
      '\u0424\u043e\u0440\u043c\u0430\u0442: `\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u0442\u043e\u0432\u0430\u0440\u0430 | \u0441\u0441\u044b\u043b\u043a\u0430`\n' +
      '\u041f\u0440\u0438\u043c\u0435\u0440: `iPhone 15 | https://kaspi.kz/shop/p/...`\n\n' +
      '_\u0412 \u043f\u043e\u043b\u043d\u043e\u0439 \u0432\u0435\u0440\u0441\u0438\u0438 \u0431\u043e\u0442 \u0430\u0432\u0442\u043e\u043c\u0430\u0442\u0438\u0447\u0435\u0441\u043a\u0438 \u043e\u043f\u0440\u0435\u0434\u0435\u043b\u044f\u0435\u0442 \u0446\u0435\u043d\u0443 \u0441\u043e \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u044b \u0442\u043e\u0432\u0430\u0440\u0430._',
    parse_mode: 'Markdown',
    reply_markup: backMenuKb(),
  });
}

function handleProductAdded(chatId, name) {
  const mockPrice = Math.floor(Math.random() * 400000 + 50000);
  return tg('sendMessage', {
    chat_id: chatId,
    text:
      '\u2705 *\u0422\u043e\u0432\u0430\u0440 \u0434\u043e\u0431\u0430\u0432\u043b\u0435\u043d!*\n\n' +
      `*${name}*\n` +
      `\u0426\u0435\u043d\u0430: ${fmt(mockPrice)}\u20b8\n\n` +
      '\u0411\u0443\u0434\u0443 \u043e\u0442\u0441\u043b\u0435\u0436\u0438\u0432\u0430\u0442\u044c \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u044f.\n\n' +
      '_\u0414\u0435\u043c\u043e: \u0446\u0435\u043d\u0430 \u0441\u0433\u0435\u043d\u0435\u0440\u0438\u0440\u043e\u0432\u0430\u043d\u0430 \u0441\u043b\u0443\u0447\u0430\u0439\u043d\u043e._',
    parse_mode: 'Markdown',
    reply_markup: mainMenuKb(),
  });
}

function handleCheckNow(chatId, msgId) {
  const changes = DEMO_PRODUCTS.filter((p) => p.price !== p.prev);
  let text = '*Проверка цен...*\n\n';

  if (changes.length === 0) {
    text += 'Цены не изменились.';
  } else {
    text += '*Изменения цен:*\n\n';
    for (const p of changes) {
      const diff = p.price - p.prev;
      const arrow = diff > 0 ? '\u2191' : '\u2193';
      const pct = ((diff / p.prev) * 100).toFixed(1);
      const sign = diff > 0 ? '+' : '';
      const yourDiff = p.your - p.price;
      const yourNote = yourDiff > 0 ? `(вы дороже на ${fmt(yourDiff)}${p.currency})` : yourDiff < 0 ? `(вы дешевле на ${fmt(Math.abs(yourDiff))}${p.currency})` : "";
      text +=
        `${arrow} *${p.name}* — ${p.source}\n` +
        `   Было: ${fmt(p.prev)}${p.currency} -> Стало: ${fmt(p.price)}${p.currency} (${sign}${pct}%)\n` +
        `   Ваша цена: ${fmt(p.your)}${p.currency} ${yourNote}\n\n`;
    }
  }

  const noChange = DEMO_PRODUCTS.filter((p) => p.price === p.prev);
  if (noChange.length > 0) {
    text += '*Без изменений:*\n';
    for (const p of noChange) {
      text += `• ${p.name} (${p.source}) — ${fmt(p.price)}${p.currency}\n`;
    }
  }

  // Use editMessageText if we have msgId (callback), otherwise sendMessage
  if (msgId) {
    return tg('editMessageText', {
      chat_id: chatId,
      message_id: msgId,
      text,
      parse_mode: 'Markdown',
      reply_markup: backMenuKb(),
    });
  }
  return tg('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
    reply_markup: mainMenuKb(),
  });
}

function handleReport(chatId, msgId) {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();

  let text = `*\ud83d\udcca \u041e\u0442\u0447\u0451\u0442 \u043f\u043e \u0446\u0435\u043d\u0430\u043c \u2014 ${dd}.${mm}.${yyyy}*\n\n`;

  let totalTracked = DEMO_PRODUCTS.length;
  let priceUp = 0;
  let priceDown = 0;
  let noChange = 0;

  let youCheaper = 0;
  let youExpensive = 0;

  for (const p of DEMO_PRODUCTS) {
    const diff = p.price - p.prev;
    const yourDiff = p.your - p.price;
    const yourPct = ((yourDiff / p.price) * 100).toFixed(1);
    let trend;
    if (diff > 0) { trend = `\u2191+${fmt(diff)}${p.currency}`; priceUp++; }
    else if (diff < 0) { trend = `\u2193${fmt(diff)}${p.currency}`; priceDown++; }
    else { trend = "= без изменений"; noChange++; }

    if (yourDiff > 0) youExpensive++;
    else if (yourDiff < 0) youCheaper++;

    text += `*${p.name}* (${p.source})\n`;
    text += `   Конкурент: ${fmt(p.price)}${p.currency} (${trend})\n`;
    text += `   Вы: ${fmt(p.your)}${p.currency} (${yourDiff > 0 ? "+" : ""}${yourPct}%)\n\n`;
  }

  text += `*Итого:*\n`;
  text += `Отслеживается: ${totalTracked} товаров\n`;
  text += `\u2191 Подорожало: ${priceUp} | \u2193 Подешевело: ${priceDown} | = Без изменений: ${noChange}\n`;
  text += `\nВаши цены: дешевле у ${youCheaper} | дороже у ${youExpensive}`;

  if (msgId) {
    return tg('editMessageText', {
      chat_id: chatId,
      message_id: msgId,
      text,
      parse_mode: 'Markdown',
      reply_markup: backMenuKb(),
    });
  }
  return tg('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
    reply_markup: mainMenuKb(),
  });
}

function handleBackMain(chatId, msgId) {
  return tg('editMessageText', {
    chat_id: chatId,
    message_id: msgId,
    text: '*\u041c\u043e\u043d\u0438\u0442\u043e\u0440\u0438\u043d\u0433 \u0446\u0435\u043d*\n\n\u0412\u044b\u0431\u0435\u0440\u0438\u0442\u0435 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435:',
    parse_mode: 'Markdown',
    reply_markup: mainMenuKb(),
  });
}

// --- Webhook auth ---
function verifyWebhook(req) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return true;
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
    console.error('Price demo handler error:', err);
  }
  return res.status(200).send('OK');
}

export const config = { maxDuration: 10 };

// --- Callback handler ---
async function handleCallback(cb) {
  const chatId = cb.message.chat.id;
  const msgId = cb.message.message_id;
  const data = cb.data;

  tg('answerCallbackQuery', { callback_query_id: cb.id });

  if (data === 'my_products') return handleMyProducts(chatId, msgId);
  if (data === 'add_product') return handleAddProduct(chatId, msgId);
  if (data === 'check_now') return handleCheckNow(chatId, msgId);
  if (data === 'report') return handleReport(chatId, msgId);
  if (data === 'back_main') return handleBackMain(chatId, msgId);
}

// --- Text message handler ---
async function handleMessage(msg) {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();
  if (!text) return;

  if (text === '/start') {
    return handleStart(chatId);
  }

  // User sends "Name | url" to add a product
  if (text.includes('|')) {
    const parts = text.split('|', 2);
    const name = parts[0].trim();
    if (!name) return;
    return handleProductAdded(chatId, name);
  }
}
