import 'dotenv/config';
import wolfjs from 'wolf.js';
import fs from 'fs'; // مكتبة قراءة الملفات من النظام

const { WOLF } = wolfjs;
const service = new WOLF();

const ROOM_ID = 81971125;
const TARGET_USER_ID = 82641759;

const START_COMMAND = '!كلمات';

// كلمات الكشف المحددة من قبلك بالترتيب
const TEST_WORDS = [
  'الميت',
  'سبدور',
  'هنفقه',
  'شجزكط',
  'حخضذص'
];

// دالة لقراءة الكلمات من الملف الخارجي وتجهيزها
function loadDictionary() {
  try {
    if (!fs.existsSync('words.txt')) {
      // إذا لم يكن الملف موجوداً، ننشئ ملفاً تجريبياً لحماية الكود من التوقف
      console.log('⚠️ لم يتم العثور على ملف words.txt، تم إنشاء ملف افتراضي مؤقت.');
      fs.writeFileSync('words.txt', 'البيت\nالشمس\nالقمر\nسعيد\nجميل', 'utf-8');
    }

    const data = fs.readFileSync('words.txt', 'utf-8');
    
    // تقسيم الملف الأسطر، تنظيف المسافات، وتصفية الكلمات الخماسية فقط
    const words = data.split('\n')
      .map(word => word.trim())
      .filter(word => word.length === 5);

    console.log(`📚 تم تحميل القاموس بنجاح! إجمالي الكلمات المحملة: ${words.length}`);
    return words;
  } catch (error) {
    console.log('❌ خطأ أثناء قراءة ملف words.txt:', error.message);
    return [];
  }
}

// تحميل الكلمات عند بدء تشغيل البوت
let DICTIONARY = loadDictionary();
let currentIndex = 0;
let waitingResult = false;
let filteredWords = [...DICTIONARY]; 

const correctPositions = Array(5).fill(null);
const presentLetters = new Set();
const invalidLetters = new Set();
const yellowPositions = Array(5).fill(null).map(() => new Set());
let coreLetters = []; 

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
      yellowPositions[index].add(letter); 
    } else if (status.includes('invalid')) {
      if (!presentLetters.has(letter) && !correctPositions.includes(letter)) {
        invalidLetters.add(letter);
      }
    }
  });

  coreLetters = [...presentLetters];
}

function generatePermutations(arr) {
  if (arr.length <= 1) return [arr.join('')];
  let permutations = [];
  for (let i = 0; i < arr.length; i++) {
    let char = arr[i];
    let remainingChars = arr.slice(0, i).concat(arr.slice(i + 1));
    let innerPerms = generatePermutations(remainingChars);
    for (let perm of innerPerms) {
      permutations.push(char + perm);
    }
  }
  return [...new Set(permutations)];
}

function filterDictionary() {
  if (coreLetters.length === 5) {
    console.log(`💡 ذكاء اصطناعي: تم كشف جميع الحروف الخمسة (${coreLetters.join('، ')}). التبديل الذكي مفعل...`);
    
    let allPossibilities = generatePermutations(coreLetters);

    filteredWords = allPossibilities.filter(word => {
      for (let i = 0; i < 5; i++) {
        if (correctPositions[i] !== null && word[i] !== correctPositions[i]) return false;
        if (yellowPositions[i].has(word[i])) return false;
      }
      return true;
    });

    console.log(`🔍 عدد التباديل المتاحة للحل: ${filteredWords.length}`);
    return;
  }

  filteredWords = filteredWords.filter(word => {
    if (word.length !== 5) return false;

    for (let char of invalidLetters) {
      if (word.includes(char)) return false;
    }

    for (let char of presentLetters) {
      if (!word.includes(char)) return false;
    }

    for (let i = 0; i < 5; i++) {
      if (correctPositions[i] !== null && word[i] !== correctPositions[i]) return false;
      if (yellowPositions[i].has(word[i])) return false;
    }

    return true;
  });

  console.log(`🔍 عدد الكلمات المطابقة المتبقية في القاموس: ${filteredWords.length}`);
}

async function makeNextGuess() {
  if (coreLetters.length < 5 && currentIndex < TEST_WORDS.length) {
    const nextTestWord = TEST_WORDS[currentIndex];
    currentIndex++;
    waitingResult = true;
    await sleep(2500);
    await sendToRoom(nextTestWord);
    return;
  }

  if (filteredWords.length === 0) {
    console.log('❌ لم يتبق خيارات محتملة للحل! يرجى تزويد ملف words.txt بكلمات أكثر.');
    process.exit(0);
    return;
  }

  const nextGuess = filteredWords.shift(); 
  waitingResult = true;
  await sleep(2500);
  await sendToRoom(nextGuess);
}

service.on('ready', async () => {
  console.log('✅ الحساب جاهز وبانتظار بدء اللعبة...');
  try {
    await sleep(2000);
    await sendToRoom(START_COMMAND);
    await sleep(3000);
    await makeNextGuess();
  } catch (err) {
    console.log('❌ خطأ:', err.message);
    process.exit(1);
  }
});

service.on('message', async (message) => {
  const senderId = getSenderId(message);
  const text = getMessageText(message);

  if (String(senderId) !== String(TARGET_USER_ID)) return;
  
  if (text.includes('تهانينا') || text.includes('الفائز') || text.includes('الإجابة الصحيحة هي') || text.includes('انتهت المحاولات')) {
    console.log('🏁 انتهت اللعبة!');
    process.exit(0);
    return;
  }
  
  if (text.includes('بدأت لعبة جديدة')) return;
  if (!waitingResult) return;
  if (!text.includes('wolfdlebot-mp-game')) return;

  waitingResult = false;

  const result = parseWolfdleResult(text);
  updateKnowledge(result);
  
  filterDictionary();
  await makeNextGuess();
});

service.login(
  process.env.U_MAIL_1,
  process.env.U_PASS_1
);
