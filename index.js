import 'dotenv/config';
import wolfjs from 'wolf.js';

const { WOLF } = wolfjs;

const service = new WOLF();

// =====================
// الإعدادات
// =====================
const ROOM_ID = 81971125;        // غيّر رقم الغرفة هنا
const TARGET_USER_ID = 82641759; // غيّر آيدي بوت الكلمات هنا

const START_COMMAND = '!كلمات';
const FIRST_GUESS = 'سلامة';

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

async function joinRoom(roomId) {
  if (service.groups?.join) return service.groups.join(roomId);
  if (service.group?.join) return service.group.join(roomId);
  if (service.joinGroup) return service.joinGroup(roomId);

  throw new Error('لم أجد دالة دخول الغرفة في wolf.js');
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
    await joinRoom(ROOM_ID);
    console.log(`✅ دخل الغرفة: ${ROOM_ID}`);

    await sleep(2000);
    await sendToRoom(START_COMMAND);

    await sleep(3000);
    await sendToRoom(FIRST_GUESS);

    console.log('⏳ الآن أنتظر أول رد من بوت الكلمات...');

  } catch (err) {
    console.log('❌ خطأ عند البداية:', err.message);
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

  console.log('');
  console.log('========== WORD BOT ==========');
  console.log(JSON.stringify(message, null, 2));
  console.log('==============================');
  console.log('');

  // يوقف التشغيل بعد أول رسالة من البوت حتى يكون اللوق قصير
  process.exit(0);
});

// =====================
// تسجيل الدخول
// =====================
service.login(
  process.env.U_MAIL_1,
  process.env.U_PASS_1
);
