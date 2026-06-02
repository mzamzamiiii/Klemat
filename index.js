import 'dotenv/config';
import wolfjs from 'wolf.js';
import sharp from 'sharp';
import { createWorker } from 'tesseract.js';
import fetch from 'node-fetch';

const { WOLF } = wolfjs;
const client = new WOLF();

// --- 1. الإعدادات ---
const TARGET_USER_ID = 80055399 ;
const CHANNEL_TASKS = 81889058;
const CHANNEL_ALLIANCE = 81889058;
const ALLOWED_PLAYER_NAMES = ['.أوكسجينه.', 'أوكسجيئه.', 'أوكسجيته '];

// --- 2. متغيرات النظام ---
let currentInterval = 306000; // الافتراضي 5 دقائق
let intervalRef = null;
let isFarming = false;

// --- 3. دالة المهام الرئيسية ---
async function performTasks() {
    try {
        console.log(`[LOG] 🚀 تنفيذ المهام...`);
        await client.messaging.sendGroupMessage(CHANNEL_TASKS, '!مد مهام');
        await new Promise(r => setTimeout(r, 2000));
        await client.messaging.sendGroupMessage(CHANNEL_ALLIANCE, '!مد تحالف ايداع كل');
    } catch (e) { console.error(`[ERROR] ${e.message}`); }
}

// --- 4. منطق المؤقت الذكي (القفل) ---
async function updateBotLogic(isTimeMachineActive, isGuaranteeReady) {
    let targetInterval = 306000; // الافتراضي 5 دقايق

    // تحديد التوقيت المطلوب بناءً على حالة الجهاز والضمان
    if (isTimeMachineActive) {
        targetInterval = 64000; // الجهاز نشط -> كل دقيقة
    } else if (isGuaranteeReady) {
        await client.messaging.sendGroupMessage(CHANNEL_TASKS, '!مد صندوق ضمان وقت');
        targetInterval = 64000; // ضمان جاهز -> كل دقيقة
    } else {
        targetInterval = 306000; // لا شيء -> كل 5 دقايق
    }

    // [القفل الذكي]: التغيير يحدث فقط إذا كان التوقيت الجديد مختلفاً عن الحالي
    if (targetInterval !== currentInterval) {
        console.log(`[LOG] ⚙️ تغيير التوقيت إلى ${targetInterval/1000} ثانية.`);
        currentInterval = targetInterval;
        
        if (intervalRef) clearInterval(intervalRef);
        performTasks(); // تنفيذ فوري
        intervalRef = setInterval(performTasks, currentInterval);
    }
}

// --- 5. دوال الكابتشا ---
async function isCaptchaByColor(buffer) {
    const { data, info } = await sharp(buffer).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
    let redPixels = 0;
    const totalPixels = info.width * info.height;
    for (let i = 0; i < data.length; i += 4) {
        if (data[i] > 120 && data[i] > (data[i + 1] + 30) && data[i] > (data[i + 2] + 30)) redPixels++;
    }
    return (redPixels / totalPixels) * 100 > 40;
}

async function extractPlayerName(buffer) {
    try {
        const processedBuffer = await sharp(buffer).greyscale().threshold(160).toBuffer();
        const worker = await createWorker('ara+eng');
        const { data: { text } } = await worker.recognize(processedBuffer);
        await worker.terminate();
        const match = text.match(/اللاعب[:\s]+([^\n\r]+)/u);
        return match ? match[1].trim() : "لم يتم العثور";
    } catch (e) { return "خطأ"; }
}

async function solveCaptcha(buffer) {
    const { data, info } = await sharp(buffer).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
    let minX = info.width, minY = info.height, maxX = 0, maxY = 0, found = false;
    for (let y = 0; y < info.height; y++) {
        for (let x = 0; x < info.width; x++) {
            const idx = (y * info.width + x) * 4;
            if (data[idx] > 200 && data[idx + 1] > 200 && data[idx + 2] < 100) {
                minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
                found = true;
            }
        }
    }
    if (!found) return null;
    const margin = 10;
    const processedBuffer = await sharp(buffer)
        .extract({ left: minX + margin, top: minY + margin, width: (maxX - minX) - (margin * 2), height: (maxY - minY) - (margin * 2) })
        .greyscale().normalize().linear(1.5, -0.2).sharpen().toBuffer();
    const worker = await createWorker('eng+ara');
    await worker.setParameters({ tessedit_pageseg_mode: '7' });
    const { data: { text } } = await worker.recognize(processedBuffer);
    await worker.terminate();
    return text.replace(/[^a-zA-Z0-9\u0621-\u064A]/g, '').trim();
}

// --- 6. المعالجة الرئيسية ---
client.on('groupMessage', async (message) => {
    if (message.sourceSubscriberId != TARGET_USER_ID) return;

    // أ) معالجة الكابتشا
    const isTargetChannel = (message.targetGroupId === CHANNEL_TASKS || message.targetGroupId === CHANNEL_ALLIANCE);
    if (isTargetChannel && message.type === 'text/image_link') {
        try {
            const response = await fetch(message.body);
            const buffer = Buffer.from(await response.arrayBuffer());
            if (!(await isCaptchaByColor(buffer))) return;

            const name = await extractPlayerName(buffer);
            if (ALLOWED_PLAYER_NAMES.some(n => name.toLowerCase().includes(n.toLowerCase()))) {
                const code = await solveCaptcha(buffer);
                if (code) await client.messaging.sendGroupMessage(message.targetGroupId, `#${code}`);
            }
        } catch (err) { console.error("⚠️ خطأ في الكابتشا:", err.message); }
        return;
    }

    // ب) معالجة الحالة والمؤقت
    const body = message.body;
    const isTimeMachineActive = !body.includes('الجهاز الزمني: غير نشط');
    const isGuaranteeReady = body.includes('حالة الضمان: جاهز');
    
    // تحديث المنطق (لن يغير شيء إلا إذا تغيرت الحالة فعلياً)
    await updateBotLogic(isTimeMachineActive, isGuaranteeReady);

    // ج) فتح الصناديق
    if (body.includes('حالة الصناديق')) {
        const pMatch = body.match(/نقاط الضمان:\s*(\d+)/);
        if (pMatch && parseInt(pMatch[1]) < 40 && !isFarming) {
            isFarming = true;
            await client.messaging.sendGroupMessage(CHANNEL_TASKS, '!مد صندوق فتح ذهبي');
            await new Promise(r => setTimeout(r, 8000));
            isFarming = false;
        }
    }
});

client.on('ready', async () => {
    console.log("🚀 البوت متصل ومستعد.");
    // أمر البدء عند التشغيل
    await client.messaging.sendGroupMessage(CHANNEL_TASKS, '!مد صندوق');
    // بدء المؤقت الافتراضي
    intervalRef = setInterval(performTasks, currentInterval);
});

client.login(process.env.U_MAIL, process.env.U_PASS);
