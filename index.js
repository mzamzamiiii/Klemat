import 'dotenv/config';
import wolfjs from 'wolf.js';
import sharp from 'sharp';
import { createWorker } from 'tesseract.js';
import fetch from 'node-fetch';

const { WOLF } = wolfjs;
const client = new WOLF();

// --- الإعدادات ---
const TARGET_USER_ID = 76023604;
const CHANNEL_ID = 224;
const ALLOWED_PLAYERS = ['أوكسجينه', 'أوكسجيته', 'أوكسجيئه'];

let globalTimer = 0;

// --- الدوال الأساسية للكابتشا (صور) ---
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
        await new Promise(resolve => setTimeout(resolve, 10000));
    };

    if (isNotReady) {
        while (g > 0) { await sendWithDelay('!مد صندوق فتح ذهبي'); g--; }
        while (s > 0) { await sendWithDelay('!مد صندوق فتح فضي'); s--; }
        while (b > 0) { await sendWithDelay('!مد صندوق فتح برونزي'); b--; }
    } else if (currentPoints < 40) {
        let needed = 42 - currentPoints;
        while (needed > 0) {
            if (needed >= 4 && g > 0) { await sendWithDelay('!مد صندوق فتح ذهبي'); g--; needed -= 4; }
            else if (needed >= 2 && s > 0) { await sendWithDelay('!مد صندوق فتح فضي'); s--; needed -= 2; }
            else if (needed >= 1 && b > 0) { await sendWithDelay('!مد صندوق فتح برونزي'); b--; needed -= 1; }
            else { break; }
        }
    }
}

// --- المعالجة الرئيسية (الكابتشا الصور + النصية) ---
client.on('groupMessage', async (message) => {
    if (message.targetGroupId != CHANNEL_ID) return;

    // 1. معالجة كابتشا الصور
    if (message.type === 'text/image_link' && message.sourceSubscriberId == TARGET_USER_ID) {
        try {
            const response = await fetch(message.body);
            const buffer = Buffer.from(await response.arrayBuffer());
            if (!(await isCaptchaByColor(buffer))) return;
            const playerName = await extractPlayerName(buffer);
            if (ALLOWED_PLAYERS.some(n => playerName.includes(n))) {
                const code = await solveCaptcha(buffer);
                if (code) await client.messaging.sendGroupMessage(CHANNEL_ID, `#${code}`);
            }
        } catch (err) { console.error("⚠️ خطأ كابتشا صور:", err.message); }
    }

    // 2. معالجة كابتشا النص (التحقق السريع)
    if (message.type === 'text' && message.body.includes("اختبار تحقق سريع")) {
        try {
            const playerMatch = message.body.match(/اللاعب:\s*([^\n\r]+)/u);
            if (playerMatch && ALLOWED_PLAYERS.includes(playerMatch[1].trim())) {
                const indexMatch = message.body.match(/رقم\s+(\d+)/);
                const targetIndex = indexMatch ? parseInt(indexMatch[1]) : null;
                
                const listLine = message.body.split('\n').find(line => line.includes('|'));
                if (listLine && targetIndex) {
                    const cleanLine = listLine.replace(/[⁦⁩]/g, '');
                    const items = cleanLine.split('|').map(i => i.trim());
                    const answer = items[targetIndex - 1];
                    if (answer) {
                        await client.messaging.sendGroupMessage(CHANNEL_ID, `#${answer}`);
                    }
                }
            }
        } catch (err) { console.error("⚠️ خطأ كابتشا نص:", err.message); }
    }
});

// --- وظيفة فحص الصناديق ---
const sendBoxCommand = () => {
    return new Promise((resolve) => {
        client.messaging.sendGroupMessage(CHANNEL_ID, '!مد صندوق');
        const responseHandler = async (message) => {
            if (message.targetGroupId == CHANNEL_ID && message.body.startsWith('/me 📦 حالة الصناديق')) {
                const body = message.body;
                const matchA = body.match(/حالة الضمان:\s*(.*)/);
                const matchB = body.match(/الجهاز الزمني:\s*(.*)/);
                const boxesMatch = body.match(/برونزي:\s*(\d+)\s*\|\s*فضي:\s*(\d+)\s*\|\s*ذهبي:\s*(\d+)/);
                const pointsMatch = body.match(/نقاط الضمان:\s*(\d+)\/50/);

                const a = matchA ? matchA[1].trim() : "";
                const b = matchB ? matchB[1].trim() : "";
                const n = boxesMatch ? parseInt(boxesMatch[1]) : 0;
                const s = boxesMatch ? parseInt(boxesMatch[2]) : 0;
                const g = boxesMatch ? parseInt(boxesMatch[3]) : 0;
                const currentPoints = pointsMatch ? parseInt(pointsMatch[1]) : 0;
                
                await processBoxOpening(g, s, n, currentPoints, a.includes("غير جاهز"));

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
                await new Promise(resolve => setTimeout(resolve, 64000));
                if (globalTimer === 0) await sendBoxCommand();
            } else {
                await new Promise(resolve => setTimeout(resolve, 306000));
                await sendBoxCommand();
            }
        } catch (err) { await new Promise(resolve => setTimeout(resolve, 5000)); }
    }
};

client.on('ready', async () => {
    console.log("🚀 البوت يعمل الآن");
    await sendBoxCommand();
    setInterval(sendBoxCommand, 30 * 60 * 1000);
    startTaskLoop();
});

client.login(process.env.U_MAIL, process.env.U_PASS);
