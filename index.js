import 'dotenv/config';
import wolfjs from 'wolf.js';

const { WOLF } = wolfjs;

const ROOM_ID = 18187126;
const TARGET_USER_ID = 75423789;

const service = new WOLF();

let currentRound = 0;
let timeoutTimer = null;
let isSolving = false;

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

function clearOldTimer() {
  if (timeoutTimer) {
    clearTimeout(timeoutTimer);
    timeoutTimer = null;
  }
}

async function sendMsg(roomId, text) {
  await service.messaging.sendGroupMessage(roomId, text);
}

async function requestNewWord(roomId) {
  try {
    await sendMsg(roomId, '!عكس');
    console.log('📤 طلب كلمة جديدة: !عكس');
  } catch (err) {
    console.log('❌ خطأ طلب كلمة:', err.message);
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

    // إذا ظهرت نتيجة، نلغي مؤقت إعادة !عكس
    if (
      text.includes('مبارك') ||
      text.includes('أجبت') ||
      text.includes('حصلت') ||
      text.includes('نقطة') ||
      text.includes('النقاط')
    ) {
      clearOldTimer();
      isSolving = false;
      console.log('✅ ظهرت نتيجة، ننتظر الكلمة التالية');
      return;
    }

    const word = extractWord(text);
    if (!word) return;

    // وصلت كلمة جديدة، نلغي أي مؤقت قديم
    clearOldTimer();

    currentRound++;
    const roundId = currentRound;

    isSolving = true;

    const answer = reverseText(word);

    console.log('--------------------');
    console.log('الكلمة:', word);
    console.log('الإجابة:', answer);

    try {
      await sendMsg(roomId, answer);
      console.log('✅ تم إرسال الإجابة:', answer);

      timeoutTimer = setTimeout(async () => {
        if (isSolving && currentRound === roundId) {
          console.log('⚠️ لم تظهر نتيجة لهذه الكلمة، بطلب كلمة جديدة');
          isSolving = false;
          await requestNewWord(roomId);
        }
      }, 2000);

    } catch (err) {
      console.log('❌ فشل إرسال الإجابة:', err.message);
      isSolving = false;
      await requestNewWord(roomId);
    }

  } catch (err) {
    console.log('❌ Message Error:', err.message);
  }
});

service.on('ready', async () => {
  console.log('✅ الحساب جاهز');
  await requestNewWord(ROOM_ID);
});

service.login(process.env.U_MAIL_1, process.env.U_PASS_1);
