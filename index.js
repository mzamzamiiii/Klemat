import 'dotenv/config';
import wolfjs from 'wolf.js';

const { WOLF } = wolfjs;

const ROOM_ID = 18187126;
const TARGET_USER_ID = 75423789;

const service = new WOLF();

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

let isSolving = false;
let lastWord = '';

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

async function sendMessage(roomId, text) {
  await service.messaging.sendGroupMessage(roomId, text);
}

async function requestNewWord(roomId) {
  try {
    await sendMessage(roomId, '!عكس');
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

    // إذا البوت أعلن نتيجة، نسمح بحل الكلمة التالية
    if (
      senderId === TARGET_USER_ID &&
      (text.includes('مبارك') || text.includes('انتهت') || text.includes('النقاط'))
    ) {
      isSolving = false;
      return;
    }

    if (senderId !== TARGET_USER_ID) return;

    const word = extractWord(text);
    if (!word) return;

    // منع تكرار نفس الكلمة
    if (word === lastWord && isSolving) return;

    isSolving = true;
    lastWord = word;

    const answer = reverseText(word);

    console.log('--------------------');
    console.log('الكلمة:', word);
    console.log('الإجابة:', answer);

    try {
      await sendMessage(roomId, answer);
      console.log('✅ تم إرسال الإجابة:', answer);

      // مهلة قصيرة، إذا ما ظهرت نتيجة غالباً الإرسال لم يُقبل
      setTimeout(async () => {
        if (isSolving && lastWord === word) {
          console.log('⚠️ لم تظهر نتيجة، بطلب كلمة جديدة');
          isSolving = false;
          await requestNewWord(roomId);
        }
      }, 1500);

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
  await sleep(1000);
  await requestNewWord(ROOM_ID);
});

service.login(process.env.U_MAIL_1, process.env.U_PASS_1);
