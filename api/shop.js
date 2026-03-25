// Vercel serverless webhook handler for the shop demo bot
const TOKEN = process.env.SHOP_DEMO_TOKEN;
const ADMIN_ID = process.env.SHOP_DEMO_ADMIN_ID
  ? parseInt(process.env.SHOP_DEMO_ADMIN_ID, 10)
  : 0;

// --- Input sanitization ---
function sanitize(str, maxLen = 100) {
  return String(str || '').slice(0, maxLen).replace(/[*_`\[\]()~>#+\-=|{}.!\\]/g, '\\$&');
}

const SHOP_NAME = 'FlowerShop';
const CURRENCY = '₸';

const CATEGORIES = [
  { id: 'bouquets', name: 'Букеты' },
  { id: 'roses', name: 'Розы' },
  { id: 'gifts', name: 'Подарки' },
];

const PRODUCTS = [
  { id: 'b1', cat: 'bouquets', name: 'Весенний букет', price: 3500, desc: 'Тюльпаны, ирисы, зелень' },
  { id: 'b2', cat: 'bouquets', name: 'Романтический', price: 5000, desc: 'Розы, пионы, эвкалипт' },
  { id: 'b3', cat: 'bouquets', name: 'Люкс букет', price: 12000, desc: '51 роза, упаковка премиум' },
  { id: 'r1', cat: 'roses', name: '11 красных роз', price: 4500, desc: 'Эквадорские розы 60см' },
  { id: 'r2', cat: 'roses', name: '25 роз микс', price: 8500, desc: 'Красные + белые' },
  { id: 'r3', cat: 'roses', name: '101 роза', price: 35000, desc: 'Красные эквадорские 70см' },
  { id: 'g1', cat: 'gifts', name: 'Открытка', price: 500, desc: 'Авторская открытка' },
  { id: 'g2', cat: 'gifts', name: 'Шоколад Lindt', price: 1500, desc: 'Набор конфет 200г' },
  { id: 'g3', cat: 'gifts', name: 'Мишка плюшевый', price: 2500, desc: 'Мягкая игрушка 30см' },
];

// In-memory cart: { userId: { productId: qty, _step, _name, _phone, _address } }
const carts = new Map();

// --- Helpers ---

async function tg(token, method, body) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

function getCart(uid) {
  return carts.get(uid) || {};
}

function cartTotal(uid) {
  const cart = getCart(uid);
  let total = 0;
  for (const [pid, qty] of Object.entries(cart)) {
    if (pid.startsWith('_')) continue;
    const p = PRODUCTS.find((x) => x.id === pid);
    if (p) total += p.price * qty;
  }
  return total;
}

function cartText(uid) {
  const cart = getCart(uid);
  const items = Object.entries(cart).filter(([k]) => !k.startsWith('_'));
  if (items.length === 0) return 'Корзина пуста';
  const lines = [];
  for (const [pid, qty] of items) {
    const p = PRODUCTS.find((x) => x.id === pid);
    if (p) lines.push(`• ${p.name} x${qty} — ${p.price * qty}${CURRENCY}`);
  }
  lines.push(`\n*Итого: ${cartTotal(uid)}${CURRENCY}*`);
  return lines.join('\n');
}

function cartHasItems(uid) {
  const cart = getCart(uid);
  return Object.keys(cart).some((k) => !k.startsWith('_'));
}

function mainMenuKb() {
  return {
    inline_keyboard: [
      [{ text: 'Каталог', callback_data: 'catalog' }],
      [{ text: 'Корзина', callback_data: 'cart' }],
      [{ text: 'Мои заказы', callback_data: 'my_orders' }],
      [{ text: 'Контакты', callback_data: 'contacts' }],
    ],
  };
}

// --- Callback handlers ---

async function handleCatalog(chatId, messageId) {
  const buttons = CATEGORIES.map((c) => [{ text: c.name, callback_data: `cat:${c.id}` }]);
  buttons.push([{ text: 'Корзина', callback_data: 'cart' }]);
  buttons.push([{ text: '<< Меню', callback_data: 'back_main' }]);
  await tg(TOKEN, 'editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text: '*Каталог*\n\nВыберите категорию:',
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: buttons },
  });
}

async function handleCategory(chatId, messageId, catId) {
  const cat = CATEGORIES.find((c) => c.id === catId);
  if (!cat) return;
  const products = PRODUCTS.filter((p) => p.cat === catId);
  const buttons = products.map((p) => [
    { text: `${p.name} — ${p.price}${CURRENCY}`, callback_data: `prod:${p.id}` },
  ]);
  buttons.push([{ text: '<< Каталог', callback_data: 'catalog' }]);
  await tg(TOKEN, 'editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text: `*${cat.name}*`,
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: buttons },
  });
}

async function handleProduct(chatId, messageId, pid) {
  const p = PRODUCTS.find((x) => x.id === pid);
  if (!p) return;
  const text = `*${p.name}*\n\n${p.desc}\n\nЦена: *${p.price}${CURRENCY}*`;
  await tg(TOKEN, 'editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Добавить в корзину', callback_data: `add:${pid}` }],
        [{ text: '<< Каталог', callback_data: `cat:${p.cat}` }],
      ],
    },
  });
}

async function handleAdd(chatId, messageId, callbackQueryId, uid, pid) {
  const p = PRODUCTS.find((x) => x.id === pid);
  if (!p) return;

  if (!carts.has(uid)) carts.set(uid, {});
  const cart = carts.get(uid);
  cart[pid] = (cart[pid] || 0) + 1;

  await tg(TOKEN, 'answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text: `${p.name} добавлен в корзину!`,
  });

  await tg(TOKEN, 'editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text: `*${p.name}* добавлен!\n\nКорзина: ${cartTotal(uid)}${CURRENCY}`,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Перейти в корзину', callback_data: 'cart' }],
        [{ text: 'Продолжить покупки', callback_data: 'catalog' }],
      ],
    },
  });
}

async function handleCart(chatId, messageId, uid) {
  if (!cartHasItems(uid)) {
    await tg(TOKEN, 'editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text: 'Корзина пуста.',
      reply_markup: {
        inline_keyboard: [[{ text: 'Каталог', callback_data: 'catalog' }]],
      },
    });
    return;
  }
  await tg(TOKEN, 'editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text: `*Корзина:*\n\n${cartText(uid)}`,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Оформить заказ', callback_data: 'checkout' }],
        [{ text: 'Очистить корзину', callback_data: 'clear_cart' }],
        [{ text: '<< Каталог', callback_data: 'catalog' }],
      ],
    },
  });
}

async function handleClearCart(chatId, messageId, callbackQueryId, uid) {
  carts.delete(uid);
  await tg(TOKEN, 'answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text: 'Корзина очищена',
  });
  await tg(TOKEN, 'editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text: 'Корзина очищена.',
    reply_markup: {
      inline_keyboard: [[{ text: 'Каталог', callback_data: 'catalog' }]],
    },
  });
}

async function handleCheckout(chatId, messageId, uid) {
  if (!carts.has(uid)) carts.set(uid, {});
  const cart = carts.get(uid);
  cart._step = 'name';
  await tg(TOKEN, 'editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text: 'Введите *имя* для заказа:',
    parse_mode: 'Markdown',
  });
}

async function handleMyOrders(chatId, messageId) {
  // No DB in serverless demo — inform user
  await tg(TOKEN, 'editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text: 'История заказов недоступна в демо-режиме.',
    reply_markup: {
      inline_keyboard: [[{ text: '<< Меню', callback_data: 'back_main' }]],
    },
  });
}

async function handleContacts(chatId, messageId) {
  await tg(TOKEN, 'editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text:
      `*${SHOP_NAME}*\n\n` +
      `Доставка: 10:00-22:00\n` +
      `Телефон: +7 777 123 4567\n` +
      `Instagram: @flowershop\n\n` +
      `Доставка бесплатно от 5000${CURRENCY}`,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[{ text: '<< Меню', callback_data: 'back_main' }]],
    },
  });
}

async function handleBackMain(chatId, messageId) {
  await tg(TOKEN, 'editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text: `*${SHOP_NAME}*\n\nВыберите действие:`,
    parse_mode: 'Markdown',
    reply_markup: mainMenuKb(),
  });
}

// --- Checkout text flow ---

async function handleCheckoutInput(chatId, uid, username, text) {
  const cart = carts.get(uid);
  if (!cart) return false;
  const step = cart._step;
  if (!step) return false;

  if (step === 'name') {
    cart._name = text.trim();
    cart._step = 'phone';
    await tg(TOKEN, 'sendMessage', {
      chat_id: chatId,
      text: 'Введите *телефон*:',
      parse_mode: 'Markdown',
    });
    return true;
  }

  if (step === 'phone') {
    cart._phone = text.trim();
    cart._step = 'address';
    await tg(TOKEN, 'sendMessage', {
      chat_id: chatId,
      text: 'Введите *адрес доставки*:',
      parse_mode: 'Markdown',
    });
    return true;
  }

  if (step === 'address') {
    cart._address = text.trim();
    cart._step = null;

    const itemsText = cartText(uid);
    const total = cartTotal(uid);
    const name = cart._name;
    const phone = cart._phone;
    const address = cart._address;

    // Clear cart
    carts.delete(uid);

    await tg(TOKEN, 'sendMessage', {
      chat_id: chatId,
      text:
        `Заказ оформлен!\n\n` +
        `${itemsText}\n\n` +
        `Доставка: ${address}\n` +
        `Мы свяжемся с вами по телефону ${phone}\n\n` +
        `Спасибо за заказ!`,
      parse_mode: 'Markdown',
      reply_markup: mainMenuKb(),
    });

    // Notify admin
    if (ADMIN_ID) {
      await tg(TOKEN, 'sendMessage', {
        chat_id: ADMIN_ID,
        text:
          `Новый заказ!\n\n` +
          `Клиент: ${sanitize(name)}\n` +
          `Телефон: ${sanitize(phone, 20)}\n` +
          `Адрес: ${sanitize(address, 200)}\n` +
          `TG: @${sanitize(username || '', 50)}\n\n` +
          `${itemsText}\n` +
          `Сумма: ${total}${CURRENCY}`,
      });
    }
    return true;
  }

  return false;
}

// --- Webhook auth ---
function verifyWebhook(req) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return true;
  return req.headers['x-telegram-bot-api-secret-token'] === secret;
}

// --- Main handler ---

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true, method: req.method });
  }
  if (!verifyWebhook(req)) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const update = req.body;

    // Handle callback queries
    if (update.callback_query) {
      const cb = update.callback_query;
      const chatId = cb.message.chat.id;
      const messageId = cb.message.message_id;
      const uid = cb.from.id;
      const data = cb.data;

      if (data === 'catalog') {
        await handleCatalog(chatId, messageId);
      } else if (data.startsWith('cat:')) {
        await handleCategory(chatId, messageId, data.split(':')[1]);
      } else if (data.startsWith('prod:')) {
        await handleProduct(chatId, messageId, data.split(':')[1]);
      } else if (data.startsWith('add:')) {
        await handleAdd(chatId, messageId, cb.id, uid, data.split(':')[1]);
      } else if (data === 'cart') {
        await handleCart(chatId, messageId, uid);
      } else if (data === 'clear_cart') {
        await handleClearCart(chatId, messageId, cb.id, uid);
      } else if (data === 'checkout') {
        await handleCheckout(chatId, messageId, uid);
      } else if (data === 'my_orders') {
        await handleMyOrders(chatId, messageId);
      } else if (data === 'contacts') {
        await handleContacts(chatId, messageId);
      } else if (data === 'back_main') {
        await handleBackMain(chatId, messageId);
      }

      return res.status(200).json({ ok: true });
    }

    // Handle text messages
    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const uid = msg.from.id;
      const text = msg.text || '';

      // /start command
      if (text === '/start') {
        await tg(TOKEN, 'sendMessage', {
          chat_id: chatId,
          text: `Добро пожаловать в *${SHOP_NAME}*!\n\nВыберите действие:`,
          parse_mode: 'Markdown',
          reply_markup: mainMenuKb(),
        });
        return res.status(200).json({ ok: true });
      }

      // Admin /orders command
      if (text === '/orders' && ADMIN_ID && uid === ADMIN_ID) {
        await tg(TOKEN, 'sendMessage', {
          chat_id: chatId,
          text: 'История заказов недоступна в демо-режиме.',
        });
        return res.status(200).json({ ok: true });
      }

      // Checkout flow input
      const handled = await handleCheckoutInput(chatId, uid, msg.from.username, text);
      if (handled) {
        return res.status(200).json({ ok: true });
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Shop bot error:', err);
    return res.status(200).json({ ok: true });
  }
}

export const config = {
  maxDuration: 10,
};
