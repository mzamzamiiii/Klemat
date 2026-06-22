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
  return text.split('').reverse().join('');
}

async function processQueue() {
  if (isProcessing) return;

  isProcessing = true;

  while (queue.length > 0) {
    const item = queue.shift();

    try {
      await service.messaging.sendGroupMessage(item.roomId, item.answer);

      console.log('✅ تم الإرسال');
      console.log('الكلمة:', item.word);
      console.log('الإجابة:', item.answer);

      await sleep(700); // تأخير بسيط يمنع تجاهل الرسائل

    } catch (err) {
      console.log('❌ Send Error:', err.message);
    }
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
  try {
    console.log('✅ الحساب جاهز');

    await service.messaging.sendGroupMessage(ROOM_ID, '!عكس');
    console.log('📤 Sent: !عكس');

  } catch (err) {
    console.log('❌ Ready Error:', err.message);
  }
});

service.login(process.env.U_MAIL_1, process.env.U_PASS_1);
