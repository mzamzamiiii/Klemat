import 'dotenv/config';
import wolfjs from 'wolf.js';

const { WOLF } = wolfjs;

const ROOM_ID = 18187126;
const TARGET_USER_ID = 75423789;

const service = new WOLF();

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

let queue = [];
let isProcessing = false;
let lastText = '';

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

async function send(roomId, text) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await sleep(1500);
      await service.messaging.sendGroupMessage(roomId, text);
      console.log(`✅ تم إرسالها محاولة ${attempt}:`, text);
      return true;
    } catch (err) {
      console.log(`❌ فشل الإرسال محاولة ${attempt}:`, err.message);
      await sleep(2000);
    }
  }

  console.log('❌ فشل الإرسال نهائيًا:', text);
  return false;
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

    // فاصل بين كل إجابة والثانية
    await sleep(1200);
  }

  isProcessing = false;
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

    // منع تكرار نفس رسالة البوت مرتين
    if (text === lastText) return;
    lastText = text;

    const word = extractWord(text);
    if (!word) return;

    const answer = reverseText(word);

    queue.push({
      roomId,
      word,
      answer
    });

    processQueue();

  } catch (err) {
    console.log('❌ Message Error:', err.message);
  }
});

service.on('ready', async () => {
  console.log('✅ الحساب جاهز');

  await sleep(2000);
  await send(ROOM_ID, '!عكس');
});

service.on('disconnected', () => {
  console.log('⚠️ تم فصل الاتصال من WOLF');
});

service.login(process.env.U_MAIL_1, process.env.U_PASS_1);
