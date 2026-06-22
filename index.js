import 'dotenv/config';
import wolfjs from 'wolf.js';

const { WOLF } = wolfjs;

const service = new WOLF();

// =====================
// الإعدادات
// =====================
const ROOM_ID = 81971125;        // رقم الغرفة
const TARGET_USER_ID = 82641759; // آيدي بوت الكلمات

const START_COMMAND = '!كلمات';
const FIRST_GUESS = 'سلامة';

let guessSent = false;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function getMessageText(message) {
  return message.body || message.content || message.text || message.message || '';
}

function getSenderId(message) {
  return (
    message.sourceSubscriberId ||
    message.senderId ||
    message.from ||
    message.userId ||
    message.authorId ||
    message.originatorId ||
    null
  );
}

async function sendToRoom(text) {
  await service.messaging.sendGroupMessage(ROOM_ID, text);
  console.log(`📤 تم الإرسال: ${text}`);
}

// =====================
// عند تسجيل الدخول
// =====================
service.on('ready', async () => {
  console.log('✅ الحساب جاهز');

  try {
    await sleep(2000);
    await sendToRoom(START_COMMAND);

    await sleep(3000);
    await sendToRoom(FIRST_GUESS);
    guessSent = true;

    console.log('⏳ أنتظر نتيجة التخمين...');

  } catch (err) {
    console.log('❌ خطأ عند الإرسال:', err.message);
    process.exit(1);
  }
});

// =====================
// استقبال الرسائل
// =====================
service.on('message', async (message) => {
  const senderId = getSenderId(message);
  const text = getMessageText(message);

  console.log('📩 رسالة مختصرة');
  console.log('👤 senderId:', senderId);
  console.log('📝 text:', text);

  if (String(senderId) !== String(TARGET_USER_ID)) return;

  if (text.includes('بدأت لعبة جديدة')) {
    console.log('ℹ️ تم تجاهل رسالة بداية اللعبة');
    return;
  }

  if (!guessSent) return;

  console.log('');
  console.log('========== WORD BOT RESULT ==========');
  console.log(JSON.stringify(message, null, 2));
  console.log('=====================================');
  console.log('');

  process.exit(0);
});

// =====================
// تسجيل الدخول
// =====================
service.login(
  process.env.U_MAIL_1,
  process.env.U_PASS_1
);
