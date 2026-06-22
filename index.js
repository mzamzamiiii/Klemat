import 'dotenv/config';
import wolfjs from 'wolf.js';

const { WOLF } = wolfjs;
const service = new WOLF();

const ROOM_ID = 81971125;
const TARGET_USER_ID = 82641759;

const START_COMMAND = '!كلمات';

const TEST_WORDS = [
  'الميت',
  'سبدور',
  'هنفقه',
  'شجزكط',
  'حخضذص'
];

let currentIndex = 0;
let waitingResult = false;

const correctPositions = Array(5).fill(null);
const presentLetters = new Set();
const invalidLetters = new Set();

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

    results.push({ letter, status });
  }

  return results.slice(-5);
}

function updateKnowledge(result) {
  result.forEach((item, index) => {
    const { letter, status } = item;

    if (status.includes('correct')) {
      correctPositions[index] = letter;
      presentLetters.add(letter);
    } else if (status.includes('present')) {
      presentLetters.add(letter);
    } else if (status.includes('invalid')) {
      if (!presentLetters.has(letter) && !correctPositions.includes(letter)) {
        invalidLetters.add(letter);
      }
    }
  });
}

function printSummary() {
  console.log('');
  console.log('========== ملخص الحروف ==========');

  console.log('الخانات:');
  correctPositions.forEach((letter, i) => {
    console.log(`الخانة ${i + 1}: ${letter || 'غير معروف'}`);
  });

  console.log('');
  console.log('الأحرف الموجودة:', [...presentLetters].join('، ') || 'لا يوجد');
  console.log('الأحرف المستبعدة:', [...invalidLetters].join('، ') || 'لا يوجد');

  console.log('=================================');
  console.log('');
}

async function sendNextTestWord() {
  if (currentIndex >= TEST_WORDS.length) {
    console.log('✅ انتهت كلمات الكشف');
    printSummary();
    process.exit(0);
    return;
  }

  const word = TEST_WORDS[currentIndex];
  currentIndex++;
  waitingResult = true;

  await sleep(2500);
  await sendToRoom(word);
}

service.on('ready', async () => {
  console.log('✅ الحساب جاهز');

  try {
    await sleep(2000);
    await sendToRoom(START_COMMAND);

    await sleep(3000);
    await sendNextTestWord();

  } catch (err) {
    console.log('❌ خطأ:', err.message);
    process.exit(1);
  }
});

service.on('message', async (message) => {
  const senderId = getSenderId(message);
  const text = getMessageText(message);

  if (String(senderId) !== String(TARGET_USER_ID)) return;
  if (text.includes('بدأت لعبة جديدة')) return;
  if (!waitingResult) return;
  if (!text.includes('wolfdlebot-mp-game')) return;

  waitingResult = false;

  const result = parseWolfdleResult(text);

  console.log('');
  console.log('========== نتيجة التخمين ==========');
  result.forEach(item => {
    console.log(`${item.letter} = ${item.status}`);
  });
  console.log('===================================');

  updateKnowledge(result);
  printSummary();

  await sendNextTestWord();
});

service.login(
  process.env.U_MAIL_1,
  process.env.U_PASS_1
);
