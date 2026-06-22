import 'dotenv/config';
import wolfjs from 'wolf.js';

const { WOLF } = wolfjs;

const ROOM_ID = 18187126;
const TARGET_USER_ID = 75423789;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

let service = null;
let queue = [];
let isProcessing = false;
let reconnecting = false;
let isBotReady = false;
let lastQuestionTime = Date.now(); // حساب وقت آخر سؤال وصلنا

function getRandomDelay(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getMessageText(message) {
  return (message.body || message.content || message.text || message.message || '').trim();
}

function getRoomId(message) {
  return Number(
    message.targetGroupId || message.groupId || message.channelId || message.recipientGroupId || message.group?.id || 0
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
    new Promise((_, reject) => setTimeout(() => reject(new Error('Send timeout')), ms))
  ]);
}

async function send(roomId, text) {
  try {
    if (!service || !isBotReady) return false;

    const humanDelay = getRandomDelay(700, 1200);
    await sleep(humanDelay);

    await withTimeout(
      service.messaging.sendGroupMessage(roomId, text),
      5000
    );

    console.log(`✅ تم إرسال [ ${text} ] بعد تأخير ${humanDelay}ms`);
    return true;

  } catch (err) {
    console.log('❌ فشل الإرسال:', err.message);
    return false;
  }
}

async function processQueue() {
  if (isProcessing) return;
  isProcessing = true;

  while (queue.length > 0) {
    const item = queue.shift();
    console.log('--------------------');
    console.log('الكلمة المستلمة:', item.word);
    console.log('الإجابة المعكوسة:', item.answer);

    const success = await send(item.roomId, item.answer);
    await sleep(success ? 800 : 2000);
  }

  isProcessing = false;
}

async function restartBot(reason) {
  if (reconnecting) return;
  reconnecting = true;
  isBotReady = false;
  console.log('🔄 إعادة تشغيل البوت بسبب:', reason);

  try {
    if (service) {
      service.removeAllListeners();
      await service.logout().catch(() => {}); 
    }
  } catch {}

  await sleep(5000);
  startBot();
}

function startBot() {
  service = new WOLF();

  service.on('message', async (message) => {
    try {
      const senderId = Number(message.sourceSubscriberId);
      const roomId = getRoomId(message);
      const text = getMessageText(message);

      if (!text || !message.isGroup || roomId !== ROOM_ID) return;

      // تحديث الوقت عند رؤية أي رسالة جديدة تخص اللعبة لضمان أنها تعمل
      if (senderId === TARGET_USER_ID) {
        lastQuestionTime = Date.now(); 
      }

      if (senderId !== TARGET_USER_ID) return;

      const word = extractWord(text);
      if (!word) return;

      const answer = reverseText(word);

      queue.push({ roomId, word, answer });
      console.log('📥 كلمة جديدة دخلت الطابور:', word);

      processQueue();

    } catch (err) {
      console.log('❌ Message Error:', err.message);
    }
  });

  service.on('ready', async () => {
    console.log('✅ الحساب جاهز ومستقر الآن');
    isBotReady = true;
    reconnecting = false; 
    lastQuestionTime = Date.now();

    await sleep(2000);
    await send(ROOM_ID, '!عكس');
  });

  service.on('error', () => restartBot('service error'));
  service.on('disconnected', () => restartBot('disconnected'));
  service.on('close', () => restartBot('close'));

  service.login(process.env.U_MAIL_1, process.env.U_PASS_1).catch(() => {
    reconnecting = false;
    restartBot('login failed');
  });
}

// مراقب الذكاء والتخطي التلقائي:
// إذا مرت 15 ثانية واللعبة معلقة على كلمة خربانة، يرسل !عكس لتوليد كلمة جديدة وتنشيط اللعبة
setInterval(async () => {
  if (service && isBotReady && !isProcessing && queue.length === 0) {
    const timeSinceLastQuestion = Date.now() - lastQuestionTime;
    
    if (timeSinceLastQuestion > 15000) { 
      console.log('⚠️ اللعبة يبدو أنها علقت على كلمة معطوبة. جاري التنشيط التلقائي...');
      lastQuestionTime = Date.now(); // تصفير العداد مؤقتاً
      await send(ROOM_ID, '!عكس');
    }
  }
}, 5000);

startBot();
