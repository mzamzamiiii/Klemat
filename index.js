import 'dotenv/config';
import wolfjs from 'wolf.js';

const { WOLF } = wolfjs;

const ROOM_ID = 18187126;
const TARGET_USER_ID = 75423789;

const service = new WOLF();

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// يمنع البوت من إرسال أكثر من رد في نفس اللحظة
let isSending = false;

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

// إرسال مع 3 محاولات
async function send(roomId, text) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await service.messaging.sendGroupMessage(roomId, text);
      console.log(`✅ تم إرسالها محاولة ${attempt}:`, text);
      return true;
    } catch (err) {
      console.log(`❌ فشل الإرسال محاولة ${attempt}:`, err.message);
      await sleep(1500);
    }
  }

  console.log('❌ فشل الإرسال بعد 3 محاولات:', text);
  return false;
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

    console.log('--------------------');
    console.log('الكلمة:', word);
    console.log('الإجابة:', answer);

    // إذا كان فيه إرسال شغال، تجاهل الرسالة حتى لا يصير تداخل
    if (isSending) {
      console.log('⚠️ تم تجاهل الرسالة لأن البوت يرسل رد سابق');
      return;
    }

    isSending = true;

    // تأخير أطول حتى لا يتجاهل WOLF الرسالة
    await sleep(1200);

    await send(roomId, answer);

    isSending = false;

  } catch (err) {
    console.log('❌ Message Error:', err.message);
    isSending = false;
  }
});

service.on('ready', async () => {
  console.log('✅ الحساب جاهز');

  await sleep(1000);
  await send(ROOM_ID, '!عكس');
});

service.login(process.env.U_MAIL_1, process.env.U_PASS_1);
