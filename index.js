import 'dotenv/config';
import wolfjs from 'wolf.js';

const { WOLF } = wolfjs;

const ROOM_ID = 18187126;
const TARGET_USER_ID = 75423789;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

let service = null;
let queue = [];
let isProcessing = false;
let lastMessageTime = Date.now();
let reconnecting = false;

function getMessageText(message) {
  return (
    message.body ||
    message.content ||
    message.text ||
    message.message ||
    ''
  ).trim();
}

function getRoomId(message) {
  return Number(
    message.targetGroupId ||
    message.groupId ||
    message.channelId ||
    message.recipientGroupId ||
    message.group?.id ||
    0
  );
}

function extractWord(text) {
  const match = text.match(/\|-->\s*(.*?)\s*<--\|/);
  return match ? match[1].trim() : null;
}

function reverseText(text) {
  return [...text].reverse().join('');
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Send timeout')), ms)
    )
  ]);
}

async function send(roomId, text) {
  try {
    await sleep(350);

    const result = await withTimeout(
      service.messaging.sendGroupMessage(roomId, text),
      5000
    );

    console.log('✅ تم إرسالها:', text);
    console.log('SEND RESULT:', result);
    return true;

  } catch (err) {
    console.log('❌ فشل/تعليق الإرسال:', err.message);
    return false;
  }
}

async function processQueue() {
  if (isProcessing) return;

  isProcessing = true;

  while (queue.length > 0) {
    const item = queue.shift();

    console.log('--------------------');
    console.log('الكلمة:', item.word);
    console.log('الإجابة:', item.answer);

    await send(item.roomId, item.answer);
    await sleep(500);
  }

  isProcessing = false;
}

async function restartBot(reason) {
  if (reconnecting) return;

  reconnecting = true;
  console.log('🔄 إعادة تشغيل البوت بسبب:', reason);

  try {
    if (service) {
      try {
        service.removeAllListeners();
      } catch {}
    }
  } catch {}

  await sleep(5000);

  startBot();

  reconnecting = false;
}

function startBot() {
  service = new WOLF();

  service.on('message', async (message) => {
    try {
      lastMessageTime = Date.now();

      const senderId = Number(message.sourceSubscriberId);
      const roomId = getRoomId(message);
      const text = getMessageText(message);

      if (!text) return;
      if (!message.isGroup) return;
      if (roomId !== ROOM_ID) return;
      if (senderId !== TARGET_USER_ID) return;

      const word = extractWord(text);
      if (!word) return;

      const answer = reverseText(word);

      queue.push({
        roomId,
        word,
        answer
      });

      console.log('📥 دخلت كلمة جديدة:', word);

      processQueue();

    } catch (err) {
      console.log('❌ Message Error:', err.message);
    }
  });

  service.on('ready', async () => {
    console.log('✅ الحساب جاهز');

    lastMessageTime = Date.now();

    await sleep(2000);
    await send(ROOM_ID, '!عكس');
  });

  service.on('error', (err) => {
    console.log('❌ SERVICE ERROR:', err.message || err);
    restartBot('service error');
  });

  service.on('disconnected', () => {
    console.log('⚠️ تم فصل الاتصال');
    restartBot('disconnected');
  });

  service.on('close', () => {
    console.log('⚠️ تم إغلاق الاتصال');
    restartBot('close');
  });

  service.login(process.env.U_MAIL_1, process.env.U_PASS_1);
}

// مراقب: إذا ما استقبل أي رسالة لمدة 60 ثانية يعيد التشغيل
setInterval(() => {
  const diff = Date.now() - lastMessageTime;

  console.log('💓 البوت شغال - آخر رسالة قبل:', Math.round(diff / 1000), 'ثانية');

  if (diff > 60000) {
    restartBot('لم يستقبل رسائل لمدة 60 ثانية');
  }
}, 30000);

startBot();
