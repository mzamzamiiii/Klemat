import 'dotenv/config';
import wolfjs from 'wolf.js';
import sharp from 'sharp';
import { createWorker } from 'tesseract.js';

const { WOLF } = wolfjs;
const client = new WOLF();

// --- الإعدادات ---
const TARGET_USER_ID = 76023604; 
const CHANNEL_TASKS = 224;      // القناة 1 (المهام)
const CHANNEL_ALLIANCE = 224;   // القناة 2 (التحالف) - تأكد من الرقم

const ALLOWED_PLAYERS = ['أوكسجينه', 'أوكسجيئه', 'أوكسجيته'];

function normalizeName(name) {
    return name.replace(/[.\-_\s‎‏]/g, '').toLowerCase();
}

client.on('ready', async () => {
    console.log(`🚀 البوت متصل!`);
    await client.group.joinById(CHANNEL_TASKS);
    await client.group.joinById(CHANNEL_ALLIANCE);
    startAutomation();
});

// --- الأتمتة (التنفيذ المتسلسل) ---
async function startAutomation() {
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    while (true) {
        try {
            // 1. إرسال أمر المهام للقناة الأولى
            await client.messaging.sendGroupMessage(CHANNEL_TASKS, '!مد مهام');
            console.log(`✅ تم إرسال "!مد مهام" للقناة ${CHANNEL_TASKS}`);

            // انتظار قصير جداً بين الرسالتين لضمان عدم حدوث تداخل (اختياري)
            await sleep(1000); 

            // 2. إرسال أمر التحالف للقناة الثانية
            await client.messaging.sendGroupMessage(CHANNEL_ALLIANCE, '!مد تحالف ايداع كل');
            console.log(`✅ تم إرسال "!مد تحالف ايداع كل" للقناة ${CHANNEL_ALLIANCE}`);

            // 3. الانتظار لمدة 64 ثانية قبل إعادة الدورة
            console.log(`⏳ بانتظار 64 ثانية للدورة القادمة...`);
            await sleep(64000); 

        } catch (err) {
            console.error("❌ خطأ في الأتمتة:", err.message);
            await sleep(5000); // في حال حدوث خطأ، انتظر 5 ثواني ثم حاول مجدداً
        }
    }
}

// --- وظائف معالجة الصور ---
async function isCaptchaByColor(buffer) { /* ... نفس الكود السابق ... */ return true; } 
async function extractPlayerName(buffer) { /* ... نفس الكود السابق ... */ return ""; }
async function solveCaptcha(buffer) { /* ... نفس الكود السابق ... */ return ""; }

// --- الاستقبال (يراقب القناتين معاً) ---
client.on('groupMessage', async (message) => {
    // التأكد أن الرسالة من إحدى القناتين المحددة ومن المستخدم المستهدف
    const isTargetChannel = (message.targetGroupId == CHANNEL_TASKS || message.targetGroupId == CHANNEL_ALLIANCE);
    
    if (!isTargetChannel || message.sourceSubscriberId != TARGET_USER_ID) return;
    if (message.type !== 'text/image_link') return;

    try {
        const response = await fetch(message.body);
        const buffer = Buffer.from(await response.arrayBuffer());

        if (!(await isCaptchaByColor(buffer))) return;

        const rawName = await extractPlayerName(buffer);
        const cleanName = normalizeName(rawName);
        
        const isAuthorized = ALLOWED_PLAYERS.some(allowed => cleanName.includes(normalizeName(allowed)));
        
        if (!isAuthorized) return;

        console.log(`✅ تم العثور على سؤال في القناة ${message.targetGroupId}، جاري الحل...`);
        const code = await solveCaptcha(buffer);
        
        if (code) {
            // إرسال الحل لنفس القناة التي جاء منها السؤال
            await client.messaging.sendGroupMessage(message.targetGroupId, `#${code}`);
            console.log(`✅ تم إرسال الحل #${code} للقناة ${message.targetGroupId}`);
        }
    } catch (err) {
        console.error("⚠️ خطأ:", err.message);
    }
});

client.login(process.env.U_MAIL, process.env.U_PASS);
