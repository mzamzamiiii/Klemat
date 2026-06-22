import 'dotenv/config';
import wolfjs from 'wolf.js';

const { WOLF } = wolfjs;

const ROOM_ID = 18187126;
const TARGET_USER_ID = 75423789;

const service = new WOLF();

let roundId = 0;
let solved = true;

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
  await service.messaging.sendGroupMessage(roomId, text);
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

    if (
      text.includes('مبارك') ||
      text.includes('أجبت') ||
      text.includes('حصلت') ||
      text.includes('نقطة')
    ) {
      solved = true;
      console.log('✅ ظهرت نتيجة');
      return;
    }

    const word = extractWord(text);
    if (!word) return;

    roundId++;
    const thisRound = roundId;
    solved = false;

    const answer = reverseText(word);

    console.log('--------------------');
    console.log('الكلمة:', word);
    console.log('الإجابة:', answer);

    await send(roomId, answer);
    console.log('📤 أرسل الإجابة:', answer);

    setTimeout(async () => {
      if (!solved && roundId === thisRound) {
        try {
          console.log('🔁 إعادة إرسال الإجابة:', answer);
          await send(roomId, answer);
        } catch (err) {
          console.log('❌ خطأ إعادة الإرسال:', err.message);
        }
      }
    }, 600);

    setTimeout(async () => {
      if (!solved && roundId === thisRound) {
        try {
          console.log('⚠️ لم تنحل، طلب كلمة جديدة');
          await send(roomId, '!عكس');
        } catch (err) {
          console.log('❌ خطأ طلب كلمة جديدة:', err.message);
        }
      }
    }, 1300);

  } catch (err) {
    console.log('❌ Message Error:', err.message);
  }
});

service.on('ready', async () => {
  console.log('✅ الحساب جاهز');
  await send(ROOM_ID, '!عكس');
});

service.login(process.env.U_MAIL_1, process.env.U_PASS_1);
