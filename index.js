import 'dotenv/config';
import wolfjs from 'wolf.js';

const { WOLF } = wolfjs;

const ROOM_ID = 18187126;
const TARGET_USER_ID = 75423789;

const service = new WOLF();

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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

async function send(roomId, text) {
  try {
    await service.messaging.sendGroupMessage(roomId, text);
    console.log('✅ تم إرسالها:', text);
    return true;
  } catch (err) {
    console.log('❌ فشل الإرسال:', err.message);
    return false;
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

    console.log('--------------------');
    console.log('الكلمة:', word);
    console.log('الإجابة:', answer);

    // تأخير بسيط حتى لا يتجاهل WOLF الرسالة
    await sleep(250);

    await send(roomId, answer);

  } catch (err) {
    console.log('❌ Message Error:', err.message);
  }
});

service.on('ready', async () => {
  console.log('✅ الحساب جاهز');

  await sleep(1000);
  await send(ROOM_ID, '!عكس');
});

service.login(process.env.U_MAIL_1, process.env.U_PASS_1);
