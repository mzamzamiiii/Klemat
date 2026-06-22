import 'dotenv/config';
import wolfjs from 'wolf.js';

const { WOLF } = wolfjs;

const service = new WOLF();

const ROOM_ID = 81971125;
const TARGET_USER_ID = 82641759;

const START_COMMAND = '!كلمات';
const FIRST_GUESS = 'سلامة';

let guessSent = false;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function getMessageText(message) {
  return message.body || message.content || message.text || message.message || '';
}

function getSenderId(message) {
  return message.sourceSubscriberId || null;
}

async function sendToRoom(text) {
  await service.messaging.sendGroupMessage(ROOM_ID, text);
  console.log(`📤 تم الإرسال: ${text}`);
}

function parseWolfdleResult(html) {
  const results = [];

  const regex = /<div class="wolfdlebot-mp-game__content__container__item ([^"]+)" lang="ar">([^<]*)<\/div>/g;

  let match;

  while ((match = regex.exec(html)) !== null) {
    const status = match[1];
    const letter = match[2];

    if (!letter) continue;

    results.push({
      letter,
      status
    });
  }

  return results.slice(0, 5);
}

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

service.on('message', async (message) => {
  const senderId = getSenderId(message);
  const text = getMessageText(message);

  if (String(senderId) !== String(TARGET_USER_ID)) return;

  if (text.includes('بدأت لعبة جديدة')) {
    console.log('ℹ️ تم تجاهل رسالة بداية اللعبة');
    return;
  }

  if (!guessSent) return;

  const result = parseWolfdleResult(text);

  console.log('');
  console.log('========== RESULT ==========');

  for (const item of result) {
    console.log(`${item.letter} = ${item.status}`);
  }

  console.log('============================');
  console.log('');

  process.exit(0);
});

service.login(
  process.env.U_MAIL_1,
  process.env.U_PASS_1
);
