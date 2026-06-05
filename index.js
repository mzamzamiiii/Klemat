import 'dotenv/config';
import wolfjs from 'wolf.js';
import sharp from 'sharp';
import { createWorker } from 'tesseract.js';
import fetch from 'node-fetch';

const { WOLF } = wolfjs;
const client = new WOLF();

// --- الإعدادات ---
const TARGET_USER_ID = 76023604 ;
const CHANNEL_ID = 224;
const ALLOWED_PLAYERS = ['أوكسجينه', 'أوكسجيته', 'أوكسجيئه'];

// متغير عالمي للتايمر
let globalTimer = 0;

// --- الدوال الأساسية للكابتشا ---
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
        return match ? match[1].trim() : "";
    } catch (e) { return ""; }
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

// --- دالة منطق فتح الصناديق ---
async function processBoxOpening(g, s, b, currentPoints, isNotReady) {
    const sendWithDelay = async (cmd) => {
        await client.messaging.sendGroupMessage(CHANNEL_ID, cmd);
        await new Promise(resolve => setTimeout(resolve, 10000)); // انتظار 10 ثواني
    };

    if (isNotReady) {
        console.log("⚠️ الحالة 'غير جاهز' موجودة: فتح جميع الصناديق...");
        while (g > 0) { await sendWithDelay('!مد صندوق فتح ذهبي'); g--; }
        while (s > 0) { await sendWithDelay('!مد صندوق فتح فضي'); s--; }
        while (b > 0) { await sendWithDelay('!مد صندوق فتح برونزي'); b--; }
    } else if (currentPoints < 40) {
        console.log(`✅ الحالة 'جاهز' والنقاط ${currentPoints} أقل من 40: الحساب للوصول لـ 42...`);
        let needed = 42 - currentPoints;
        while (needed > 0) {
            if (needed >= 4 && g > 0) {
                await sendWithDelay('!مد صندوق فتح ذهبي');
                g--; needed -= 4;
            } else if (needed >= 2 && s > 0) {
                await sendWithDelay('!مد صندوق فتح فضي');
                s--; needed -= 2;
            } else if (needed >= 1 && b > 0) {
                await sendWithDelay('!مد صندوق فتح برونزي');
                b--; needed -= 1;
            } else { break; }
        }
    }
}

// --- المعالجة الرئيسية للكابتشا ---
client.on('groupMessage', async (message) => {
    if (message.sourceSubscriberId != TARGET_USER_ID || message.targetGroupId != CHANNEL_ID || message.type !== 'text/image_link') return;
    try {
        const response = await fetch(message.body);
        const buffer = Buffer.from(await response.arrayBuffer());
        if (!(await isCaptchaByColor(buffer))) return;
        const playerName = await extractPlayerName(buffer);
        if (ALLOWED_PLAYERS.some(n => playerName.includes(n))) {
            const code = await solveCaptcha(buffer);
            if (code) await client.messaging.sendGroupMessage(CHANNEL_ID, `#${code}`);
        }
    } catch (err) { console.error("⚠️ خطأ كابتشا:", err.message); }
});

// --- وظيفة فحص الصناديق ---
const sendBoxCommand = () => {
    return new Promise((resolve) => {
        client.messaging.sendGroupMessage(CHANNEL_ID, '!مد صندوق');
        
        const responseHandler = async (message) => {
            if (message.targetGroupId == CHANNEL_ID && message.body.startsWith('/me 📦 حالة الصناديق')) {
                // 1. استخراج المتغيرات
                const body = message.body;
                const matchA = body.match(/حالة الضمان:\s*(.*)/);
                const matchB = body.match(/الجهاز الزمني:\s*(.*)/);
                const boxesMatch = body.match(/برونزي:\s*(\d+)\s*\|\s*فضي:\s*(\d+)\s*\|\s*ذهبي:\s*(\d+)/);
                const pointsMatch = body.match(/نقاط الضمان:\s*(\d+)\/50/);

                const a = matchA ? matchA[1].trim() : "";
                const b = matchB ? matchB[1].trim() : "";
                const n = boxesMatch ? parseInt(boxesMatch[1]) : 0; // برونزي
                const s = boxesMatch ? parseInt(boxesMatch[2]) : 0; // فضي
                const g = boxesMatch ? parseInt(boxesMatch[3]) : 0; // ذهبي
                const currentPoints = pointsMatch ? parseInt(pointsMatch[1]) : 0;
                
                const isNotReady = a.includes("غير جاهز");

                // 2. تنفيذ منطق الفتح قبل أي شيء
                await processBoxOpening(g, s, n, currentPoints, isNotReady);

                // 3. حساب التايمر
                let tempTimer = 0;
                if (b.includes("غير نشط")) {
                    if (!a.includes("غير جاهز")) {
                        client.messaging.sendGroupMessage(CHANNEL_ID, '!مد صندوق ضمان وقت');
                        tempTimer = 3 * 60 * 60;
                    }
                } else {
                    const h = b.match(/(\d+)س/);
                    const m = b.match(/(\d+)د/);
                    const ts = b.match(/(\d+)ث/);
                    if (h) tempTimer += parseInt(h[1]) * 3600;
                    if (m) tempTimer += parseInt(m[1]) * 60;
                    if (ts) tempTimer += parseInt(ts[1]);
                }
                
                globalTimer = tempTimer;
                console.log(`⏱ تم التحديث. التايمر:${globalTimer} | النقاط:${currentPoints}`);
                client.removeListener('groupMessage', responseHandler);
                resolve();
            }
        };

        client.on('groupMessage', responseHandler);
        setTimeout(() => { client.removeListener('groupMessage', responseHandler); resolve(); }, 10000);
    });
};

const startTaskLoop = async () => {
    while (true) {
        try {
            await client.messaging.sendGroupMessage(CHANNEL_ID, '!مد مهام');
            await new Promise(resolve => setTimeout(resolve, 2000));
            await client.messaging.sendGroupMessage(CHANNEL_ID, '!مد تحالف ايداع كل');

            if (globalTimer > 0) {
                globalTimer = Math.max(0, globalTimer - 64);
                console.log(`⏳ التايمر يقل: ${globalTimer} ثانية متبقية.`);
                await new Promise(resolve => setTimeout(resolve, 64000));
                if (globalTimer === 0) await sendBoxCommand();
            } else {
                console.log("⏳ التايمر 0، تحديث...");
                await new Promise(resolve => setTimeout(resolve, 306000));
                await sendBoxCommand();
            }
        } catch (err) { console.error("⚠️ خطأ حلقة:", err.message); await new Promise(resolve => setTimeout(resolve, 5000)); }
    }
};

client.on('ready', async () => {
    console.log("🚀 البوت يعمل الآن");
    await sendBoxCommand();
    setInterval(sendBoxCommand, 30 * 60 * 1000);
    startTaskLoop();
});

client.login(process.env.U_MAIL, process.env.U_PASS);
