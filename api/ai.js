/**
 * Vercel serverless webhook — AI Assistant Demo Bot
 * Medical clinic "Здоровье" — AI + booking with doctor buttons
 *
 * Env vars:
 *   AI_DEMO_TOKEN      — Telegram bot token
 *   AI_DEMO_ADMIN_ID   — Admin chat ID for lead notifications
 *   OPENROUTER_API_KEY  — OpenRouter API key (free models)
 */

const TOKEN = () => process.env.AI_DEMO_TOKEN;
const ADMIN_ID = () => process.env.AI_DEMO_ADMIN_ID;

// --- Conversation memory ---
const conversations = new Map();
const CONV_TTL = 30 * 60 * 1000;
const MAX_TURNS = 10;

function getHistory(chatId) {
  const entry = conversations.get(chatId);
  if (entry && Date.now() - entry.ts < CONV_TTL) return entry.messages;
  conversations.delete(chatId);
  return [];
}

function addToHistory(chatId, role, content) {
  const entry = conversations.get(chatId) || { messages: [], ts: Date.now() };
  entry.messages.push({ role, content: String(content).slice(0, 1000) });
  if (entry.messages.length > MAX_TURNS * 2) {
    entry.messages = entry.messages.slice(-MAX_TURNS * 2);
  }
  entry.ts = Date.now();
  conversations.set(chatId, entry);
}

function clearHistory(chatId) { conversations.delete(chatId); }

// --- Booking sessions ---
const sessions = new Map();
const SESSION_TTL = 10 * 60 * 1000;

function getSession(chatId) {
  const s = sessions.get(chatId);
  if (s && Date.now() - s.ts < SESSION_TTL) return s;
  sessions.delete(chatId);
  return null;
}

function setSession(chatId, data) {
  sessions.set(chatId, { ...data, ts: Date.now() });
}

function clearSession(chatId) { sessions.delete(chatId); }

// --- Config ---
const BUSINESS_NAME = "МедЦентр Здоровье";

const DOCTORS = [
  { id: "therapist", name: "Терапевт",   price: 5000, duration: 30 },
  { id: "cardio",    name: "Кардиолог",  price: 7000, duration: 40 },
  { id: "neuro",     name: "Невролог",   price: 7000, duration: 40 },
  { id: "uzi",       name: "УЗИ",        price: 4000, duration: 20 },
  { id: "analysis",  name: "Анализы",    price: 2000, duration: 15 },
  { id: "vaccine",   name: "Вакцинация", price: 3000, duration: 15 },
];

const WORK_HOURS = [9, 10, 11, 12, 14, 15, 16, 17]; // 9-18, lunch 13-14
const DAY_NAMES = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

function sanitize(str, maxLen = 100) {
  return String(str || '').slice(0, maxLen).replace(/[*_`\[\]()~>#+\-=|{}.!\\]/g, '\\$&');
}

// --- Telegram ---
async function tg(method, body) {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  return res.json();
}

async function send(chatId, text, opts = {}) {
  const payload = { chat_id: chatId, text, parse_mode: "Markdown", disable_web_page_preview: true, ...opts };
  const result = await tg("sendMessage", payload);
  if (!result.ok && result.description?.includes("parse")) {
    return tg("sendMessage", { ...payload, parse_mode: undefined });
  }
  return result;
}

async function answer(queryId) {
  return tg("answerCallbackQuery", { callback_query_id: queryId }).catch(() => {});
}

async function notifyAdmin(text) {
  const adminId = ADMIN_ID();
  if (!adminId) return;
  return send(adminId, text).catch(() => {});
}

// --- AI ---
const SYSTEM_PROMPT = `Ты — виртуальный ассистент медицинского центра "Здоровье".

Информация о клинике:
- Адрес: г. Алматы, ул. Абая 100
- Часы работы: Пн-Пт 9:00-18:00, Сб 9:00-15:00
- Телефон: +7 727 123 4567
- Врачи: терапевт (5000₸), кардиолог (7000₸), невролог (7000₸), УЗИ (4000₸), анализы (2000₸), вакцинация (3000₸)

Правила:
- Отвечай вежливо и профессионально
- НЕ ставь диагнозы — направляй к врачу
- Если хотят записаться — скажи нажать кнопку "Записаться"
- Отвечай кратко — максимум 3-4 предложения`;

async function askAI(messages) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return "AI-ассистент временно недоступен. Позвоните: +7 727 123 4567";
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: "google/gemma-3-27b-it:free", messages, max_tokens: 500 }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "Извините, произошла ошибка. Позвоните: +7 727 123 4567";
}

// --- Menu ---
const MAIN_MENU = {
  reply_markup: { inline_keyboard: [
    [{ text: "Записаться на приём", callback_data: "book" }],
    [{ text: "Наши цены", callback_data: "prices" }],
    [{ text: "Контакты", callback_data: "contacts" }],
  ]},
};

// --- Booking flow ---
function getDoctorButtons() {
  const rows = [];
  for (let i = 0; i < DOCTORS.length; i += 2) {
    const row = [{ text: `${DOCTORS[i].name} — ${DOCTORS[i].price}₸`, callback_data: `doc:${DOCTORS[i].id}` }];
    if (DOCTORS[i + 1]) row.push({ text: `${DOCTORS[i + 1].name} — ${DOCTORS[i + 1].price}₸`, callback_data: `doc:${DOCTORS[i + 1].id}` });
    rows.push(row);
  }
  rows.push([{ text: "<< Назад", callback_data: "menu" }]);
  return { reply_markup: { inline_keyboard: rows } };
}

function getDateButtons() {
  const buttons = [];
  const now = new Date();
  for (let i = 1; i <= 5; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    if (d.getDay() === 0) continue; // skip Sunday
    const dateStr = d.toISOString().slice(0, 10);
    const label = `${DAY_NAMES[d.getDay()]} ${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
    buttons.push([{ text: label, callback_data: `date:${dateStr}` }]);
  }
  buttons.push([{ text: "<< Назад к врачам", callback_data: "book" }]);
  return { reply_markup: { inline_keyboard: buttons } };
}

function getTimeButtons() {
  const rows = [];
  for (let i = 0; i < WORK_HOURS.length; i += 3) {
    const row = WORK_HOURS.slice(i, i + 3).map(h => ({
      text: `${h}:00`,
      callback_data: `time:${h}:00`,
    }));
    rows.push(row);
  }
  rows.push([{ text: "<< Назад к датам", callback_data: "back_dates" }]);
  return { reply_markup: { inline_keyboard: rows } };
}

// --- Handlers ---
async function handleStart(chatId, from) {
  clearHistory(chatId);
  clearSession(chatId);
  await send(chatId,
    `Добро пожаловать в *${BUSINESS_NAME}*!\n\n` +
    "Я — AI-ассистент клиники. Могу:\n" +
    "• Записать вас на приём к врачу\n" +
    "• Рассказать об услугах и ценах\n" +
    "• Ответить на вопросы о здоровье\n\n" +
    "Выберите действие или просто задайте вопрос:",
    MAIN_MENU
  );
  await notifyAdmin(`Новый пользователь: @${sanitize(from.username || "no_username", 50)} (${sanitize(from.first_name || "", 50)})`);
}

async function handlePrices(chatId) {
  let text = `*Цены ${BUSINESS_NAME}:*\n\n`;
  for (const d of DOCTORS) {
    text += `${d.name} — ${d.price.toLocaleString()}₸ (${d.duration} мин)\n`;
  }
  text += "\nДля записи нажмите кнопку ниже:";
  return send(chatId, text, {
    reply_markup: { inline_keyboard: [
      [{ text: "Записаться на приём", callback_data: "book" }],
      [{ text: "<< Меню", callback_data: "menu" }],
    ]},
  });
}

async function handleContacts(chatId) {
  return send(chatId,
    `*${BUSINESS_NAME}*\n\n` +
    "Адрес: г. Алматы, ул. Абая 100\n" +
    "Телефон: +7 727 123 4567\n" +
    "Часы: Пн-Пт 9:00-18:00, Сб 9:00-15:00\n" +
    "Instagram: @medcenter\\_zdorovie",
    { reply_markup: { inline_keyboard: [[{ text: "<< Меню", callback_data: "menu" }]] } }
  );
}

async function handleBookStart(chatId) {
  clearSession(chatId);
  await send(chatId, "Выберите врача:", getDoctorButtons());
}

async function handleDoctorSelect(chatId, doctorId) {
  const doctor = DOCTORS.find(d => d.id === doctorId);
  if (!doctor) return;
  setSession(chatId, { step: "date", doctorId, doctorName: doctor.name, price: doctor.price });
  await send(chatId, `*${doctor.name}* — ${doctor.price.toLocaleString()}₸\n\nВыберите дату:`, getDateButtons());
}

async function handleDateSelect(chatId, date) {
  const s = getSession(chatId);
  if (!s) return handleBookStart(chatId);
  setSession(chatId, { ...s, step: "time", date });
  const label = date.split("-").reverse().join(".");
  await send(chatId, `*${s.doctorName}* | ${label}\n\nВыберите время:`, getTimeButtons());
}

async function handleTimeSelect(chatId, time) {
  const s = getSession(chatId);
  if (!s) return handleBookStart(chatId);
  setSession(chatId, { ...s, step: "name", time });
  await send(chatId, `*${s.doctorName}* | ${s.date} | ${time}\n\nВведите ваше *имя*:`);
}

async function handleNameInput(chatId, name) {
  const s = getSession(chatId);
  if (!s || s.step !== "name") return;
  setSession(chatId, { ...s, step: "phone", name: sanitize(name, 50) });
  await send(chatId, `Спасибо, *${sanitize(name, 50)}*!\n\nТеперь введите *номер телефона*:`);
}

async function handlePhoneInput(chatId, phone, from) {
  const s = getSession(chatId);
  if (!s || s.step !== "phone") return;

  const dateLabel = s.date.split("-").reverse().join(".");
  clearSession(chatId);

  // Confirm to user
  await send(chatId,
    `*Запись подтверждена!*\n\n` +
    `Врач: *${s.doctorName}*\n` +
    `Дата: ${dateLabel}\n` +
    `Время: ${s.time}\n` +
    `Имя: ${s.name}\n` +
    `Телефон: ${sanitize(phone, 20)}\n` +
    `Стоимость: ${s.price.toLocaleString()}₸\n\n` +
    `Мы ждём вас по адресу:\nг. Алматы, ул. Абая 100\n\n` +
    `Для отмены позвоните: +7 727 123 4567`,
    MAIN_MENU
  );

  // Notify admin
  await notifyAdmin(
    `НОВАЯ ЗАПИСЬ!\n\n` +
    `Врач: ${s.doctorName}\n` +
    `Дата: ${dateLabel} в ${s.time}\n` +
    `Клиент: ${s.name}\n` +
    `Телефон: ${sanitize(phone, 20)}\n` +
    `TG: @${sanitize(from.username || "нет", 50)}\n` +
    `Стоимость: ${s.price}₸`
  );
}

// --- Text message handler ---
async function handleTextMessage(chatId, text, from) {
  // Check if user is in booking flow
  const s = getSession(chatId);
  if (s?.step === "name") return handleNameInput(chatId, text);
  if (s?.step === "phone") return handlePhoneInput(chatId, text, from);

  // AI response
  tg("sendChatAction", { chat_id: chatId, action: "typing" }).catch(() => {});
  addToHistory(chatId, "user", text);
  const messages = [{ role: "system", content: SYSTEM_PROMPT }, ...getHistory(chatId)];
  const reply = await askAI(messages);
  addToHistory(chatId, "assistant", reply);
  await send(chatId, reply, MAIN_MENU);

  // Lead detection
  const lower = text.toLowerCase();
  if (["записать", "запись", "приём", "прием", "врач"].some(kw => lower.includes(kw))) {
    await notifyAdmin(`Потенциальная запись!\nКлиент: @${sanitize(from.username || "нет", 50)} (${sanitize(from.first_name || "", 50)})\nСообщение: ${sanitize(text, 200)}`);
  }
}

// --- Webhook auth ---
function verifyWebhook(req) {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return true;
  return req.headers['x-telegram-bot-api-secret-token'] === secret;
}

// --- Main handler ---
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!verifyWebhook(req)) return res.status(401).json({ error: "Unauthorized" });

  const update = req.body;
  if (!update) return res.status(200).json({ ok: true });

  try {
    if (update.callback_query) {
      const q = update.callback_query;
      const chatId = q.message?.chat?.id;
      if (!chatId) return res.status(200).json({ ok: true });

      await answer(q.id);
      const d = q.data;

      if (d === "menu") await handleStart(chatId, q.from || {});
      else if (d === "book") await handleBookStart(chatId);
      else if (d === "prices") await handlePrices(chatId);
      else if (d === "contacts") await handleContacts(chatId);
      else if (d.startsWith("doc:")) await handleDoctorSelect(chatId, d.slice(4));
      else if (d.startsWith("date:")) await handleDateSelect(chatId, d.slice(5));
      else if (d.startsWith("time:")) await handleTimeSelect(chatId, d.slice(5));
      else if (d === "back_dates") {
        const s = getSession(chatId);
        if (s) await send(chatId, `*${s.doctorName}*\n\nВыберите дату:`, getDateButtons());
        else await handleBookStart(chatId);
      }

      return res.status(200).json({ ok: true });
    }

    const msg = update.message;
    if (!msg?.text) return res.status(200).json({ ok: true });

    const chatId = msg.chat.id;
    const text = msg.text.trim();
    const from = msg.from || {};

    if (text === "/start") await handleStart(chatId, from);
    else if (text === "/prices" || text === "/price") await handlePrices(chatId);
    else if (text === "/book" || text === "/booking") await handleBookStart(chatId);
    else await handleTextMessage(chatId, text, from);
  } catch (err) {
    console.error("AI demo webhook error:", err);
  }

  return res.status(200).json({ ok: true });
}

export const config = { maxDuration: 25 };
