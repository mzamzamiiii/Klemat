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
let isBotReady = false; // مؤشر للتحقق من جاهزية البوت الفعلية

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
    // التأكد من أن الاتصال جاهز تماماً قبل الإرسال
    if (!service || !isBotReady) {
      console.log('⏳ تخطي الإرسال لأن البوت ليس جاهزاً بعد');
      return false;
    }

    await sleep(350);

    const result = await withTimeout(
      service.messaging.sendGroupMessage(roomId, text),
      5000
    );

    console.log('✅ تم إرسالها:', text);
    return true;

  } catch (err) {
    console.log('❌ فشل/تعليق الإرسال:', err.message);
    // إذا علق الإرسال، قد يكون الاتصال بالإنترنت ضعيفاً، يفضل ترك معالج الأخطاء الرسمي يتصرف
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

    await send(item.roomId, item.answer);
    await sleep(500); // مهلة أمان بين الرسائل لمنع السبام والتعليق
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
      // إغلاق الاتصال القديم تماماً وتنظيف المستمعين منعاً للتراكم في الذاكرة
      service.removeAllListeners();
      await service.logout().catch(() => {}); 
    }
  } catch (err) {
    console.log('تنظيف العميل القديم:', err.message);
  }

  await sleep(5000); // وقت انتظار كافٍ لاستقرار السيرفر قبل الاتصال الجديد

  startBot();
}

function startBot() {
  service = new WOLF();

  service.on('message', async (message) => {
    try {
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

      console.log('📥 دخلت كلمة جديدة إلى الطابور:', word);

      processQueue();

    } catch (err) {
      console.log('❌ Message Error:', err.message);
    }
  });

  service.on('ready', async () => {
    console.log('✅ الحساب جاهز ومستقر الآن');
    isBotReady = true;
    reconnecting = false; // يتم إلغاء وضع إعادة الاتصال فقط عند نجاح الجاهزية

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

  // تسجيل الدخول
  service.login(process.env.U_MAIL_1, process.env.U_PASS_1).catch((err) => {
    console.log('❌ فشل تسجيل الدخول:', err.message);
    reconnecting = false;
    restartBot('login failed');
  });
}

// مراقب نبضات القلب الذكي: يفحص هل البوت متصل فعلياً بالمنصة أم لا كل 30 ثانية
setInterval(() => {
  if (service && isBotReady) {
    console.log('💓 البوت يعمل بشكل ممتاز ومستقر ومتصل بالروم.');
  } else if (!reconnecting) {
    console.log('💓 البوت غير متصل أو في حالة إعادة بناء الاتصال...');
  }
}, 30000);

// انطلاق البوت لأول مرة
startBot();
