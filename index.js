import 'dotenv/config';
import wolfjs from 'wolf.js';

const { WOLF } = wolfjs;

const ROOM_ID = 18187126;
const TARGET_USER_ID = 75423789;

const service = new WOLF();

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

let queue = [];
let isProcessing = false;

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

// مهلة تمنع الإرسال من التعليق للأبد
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Send timeout')), ms)
    )
  ]);
}

async function send(roomId, text) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await sleep(700);

      const result = await withTimeout(
        service.messaging.sendGroupMessage(roomId, text),
        8000
      );

      console.log(`✅ تم إرسالها محاولة ${attempt}:`, text);
      console.log('SEND RESULT:', result);
      return true;

    } catch (err) {
      console.log(`❌ فشل/تعليق الإرسال محاولة ${attempt}:`, err.message);
      await sleep(1200);
    }
  }

  console.log('❌ تخطيت الإجابة بسبب فشل الإرسال:', text);
  return false;
}

async function processQueue() {
  if (isProcessing) return;

  isProcessing = true;

  try {
    while (queue.length > 0) {
      const item = queue.shift();

      console.log('--------------------');
      console.log('الكلمة:', item.word);
      console.log('الإجابة:', item.answer);

      await send(item.roomId, item.answer);

      await sleep(1000);
    }
  } catch (err) {
    console.log('❌ Queue Error:', err.message);
  } finally {
    isProcessing = false;

    // لو دخلت رسائل جديدة أثناء المعالجة، يكملها
    if (queue.length > 0) {
      processQueue();
    }
  }
}

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

    console.log('📥 تمت إضافة كلمة للطابور:', word);

    processQueue();

  } catch (err) {
    console.log('❌ Message Error:', err.message);
  }
});

service.on('ready', async () => {
  console.log('✅ الحساب جاهز');

  setInterval(() => {
    console.log('💓 البوت شغال:', new Date().toLocaleTimeString());
  }, 30000);

  await sleep(2000);
  await send(ROOM_ID, '!عكس');
});

service.on('error', (err) => {
  console.log('❌ SERVICE ERROR:', err.message || err);
});

service.on('disconnected', () => {
  console.log('⚠️ تم فصل الاتصال');
});

service.on('close', () => {
  console.log('⚠️ تم إغلاق الاتصال');
});

service.login(process.env.U_MAIL_1, process.env.U_PASS_1);
