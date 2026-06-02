import 'dotenv/config';
import wolfjs from 'wolf.js';
import sharp from 'sharp';
import { createWorker } from 'tesseract.js';

const { WOLF } = wolfjs;
const client = new WOLF();

// --- الإعدادات ---
const TARGET_USER_ID = 80055399 ;
const CHANNEL_TASKS = 81889058;
const CHANNEL_ALLIANCE = 81889058;
const ALLOWED_PLAYERS = ['أوكسجينه', 'أوكسجيته', 'أوكسجيئه'];

// --- متغيرات النظام ---
let isSystemActive = false; 
let b = null; 

// --- دالة إرسال أمر الصندوق (للاستدعاء المتكرر) ---
async function sendBoxCommand() {
    try {
        console.log(`[LOG] 📤 إرسال طلب !مد صندوق (فحص الحالة)...`);
        await client.messaging.sendGroupMessage(CHANNEL_TASKS, '!مد صندوق');
    } catch (e) { console.error(`[ERROR] فشل إرسال أمر الصندوق: ${e.message}`); }
}

// --- دالة المهام ---
async function performTasks() {
    console.log(`[LOG] 🚀 بدء دورة المهام.`);
    try {
        await client.messaging.sendGroupMessage(CHANNEL_TASKS, '!مد مهام');
        await new Promise(r => setTimeout(r, 2000)); // تأخير ثانيتين
        await client.messaging.sendGroupMessage(CHANNEL_ALLIANCE, '!مد تحالف ايداع كل');
    } catch (e) { console.error(`[ERROR] ${e.message}`); }
}

// --- إدارة المؤقت ---
function manageTimer() {
    let intervalMs = isSystemActive ? 64000 : 306000;
    
    if (b) clearInterval(b);
    
    console.log(`[LOG] ⚙️ تحليل القرار: الحالة ${isSystemActive ? 'نشطة' : 'خاملة'}. المؤقت مضبوط كل ${intervalMs/1000} ثانية.`);
    
    performTasks(); 
    b = setInterval(performTasks, intervalMs);
}

// --- دوال الكابتشا ---
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

// --- معالجة الرسائل ---
client.on('groupMessage', async (message) => {
    // 1. منطق الكابتشا
    const isTargetChannel = (message.targetGroupId === CHANNEL_TASKS || message.targetGroupId === CHANNEL_ALLIANCE);
    if (isTargetChannel && message.sourceSubscriberId == TARGET_USER_ID && message.type === 'text/image_link') {
        try {
            const response = await fetch(message.body);
            const buffer = Buffer.from(await response.arrayBuffer());
            if (!(await isCaptchaByColor(buffer))) return;

            const name = await extractPlayerName(buffer);
            if (ALLOWED_PLAYERS.some(p => name.toLowerCase().includes(p.toLowerCase()))) {
                const code = await solveCaptcha(buffer);
                if (code) {
                    console.log(`[LOG] ✅ تم حل الكابتشا: ${code}`);
                    await client.messaging.sendGroupMessage(message.targetGroupId, `#${code}`);
                }
            }
        } catch (err) { console.error("⚠️ خطأ في الكابتشا:", err.message); }
        return;
    }

    // 2. معالجة النصوص (تحديث الحالة)
    if (message.sourceSubscriberId !== TARGET_USER_ID) return;
    
    const body = message.body;
    const timeMatch = body.match(/الجهاز الزمني[:\s]+(.*)/);
    const guaranteeMatch = body.match(/حالة الضمان[:\s]+(.*)/);

    if (timeMatch) {
        const timeStatus = timeMatch[1].trim();
        let isReady = guaranteeMatch ? guaranteeMatch[1].includes('جاهز') : false;

        console.log(`[LOG] 🔎 فحص الحالة: [${timeStatus}]`);

        if (timeStatus.includes('س') || timeStatus.includes('د')) {
            isSystemActive = true; 
        } 
        else if (timeStatus.includes('غير نشط')) {
            if (isReady) {
                await client.messaging.sendGroupMessage(CHANNEL_TASKS, '!مد صندوق ضمان وقت');
                isSystemActive = true; 
            } else {
                isSystemActive = false; 
            }
        }
        manageTimer(); // تحديث المؤقت بناءً على الحالة الجديدة
    }
});

// --- التشغيل ---
client.on('ready', () => {
    console.log("🚀 البوت متصل. إرسال أمر الفحص الأول...");
    sendBoxCommand(); // <--- التعديل المطلوب
    manageTimer();    // تشغيل بدائي، سيتم تحديثه فور وصول رد الصندوق
});

client.login(process.env.U_MAIL, process.env.U_PASS);
