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
const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ==========================================
// قسم 1: منطق اختبارات التحقق النصية (الفخاخ)
// ==========================================
async function handleTextVerification(message) {
    const content = message.body;
    
    // شرط التأكد أن الرسالة تحتوي على "تحقق" و الـ ID الخاص بك
    if (!(content.includes("تحقق") && content.includes(String(TARGET_USER_ID)))) return;

    try {
        console.log("🔍 تم رصد اختبار نصي، جاري التحليل...");

        // فخ 1: العلامتين
        if (content.includes("العلامتين")) {
            const symMatch = content.match(/العلامتين\s*([^\s\w\u0600-\u06FF])\s*و\s*([^\s\w\u0600-\u06FF])/u);
            if (symMatch) {
                const pattern = new RegExp(`${escapeRegExp(symMatch[1])}(.*?)${escapeRegExp(symMatch[2])}`, 'gu');
                const matches = [...content.matchAll(pattern)];
                if (matches.length > 0) {
                    const target = matches.length > 1 ? matches[1] : matches[0];
                    await client.messaging.sendGroupMessage(CHANNEL_ID, `#${target[1].trim()}`);
                }
            }
        }
        // فخ 2: القوسين ()
        else if (content.includes("داخل القوسين")) {
            const match = content.match(/\((.*?)\)/);
            if (match) await client.messaging.sendGroupMessage(CHANNEL_ID, `#${match[1].trim()}`);
        }
        // فخ 3: الأقواس المعقوفة {}
        else if (content.includes("الأقواس المعقوفة")) {
            const match = content.match(/\{(.*?)\}/);
            if (match) await client.messaging.sendGroupMessage(CHANNEL_ID, `#${match[1].trim()}`);
        }
        // فخ 4: الاتجاهات
        else if (content.includes("يمين") || content.includes("يسار")) {
            const symMatch = content.match(/للعلامة\s*([^\s])/u);
            const dirMatch = content.match(/(اليمين|يمين|اليسار|يسار)/u);
            if (symMatch && dirMatch) {
                const regex = new RegExp(`([^\\s]+)\\s*${escapeRegExp(symMatch[1])}\\s*([^\\s]+)`, 'gu');
                const matches = [...content.matchAll(regex)];
                if (matches.length > 0) {
                    const target = matches.length > 1 ? matches[1] : matches[0];
                    const answer = dirMatch[0].includes("يمين") ? target[2] : target[1];
                    await client.messaging.sendGroupMessage(CHANNEL_ID, `#${answer}`);
                }
            }
        }
        // فخ 5: القوائم (محدث ليدعم تعدد السطور)
        else if (content.includes("الرمز رقم")) {
            const indexMatch = content.match(/رقم\s*(\d+)/u);
            const listMatch = content.match(/القائمة التالية:([\s\S]*?)أرسل/u);
            
            if (indexMatch && listMatch) {
                const cleanedList = listMatch[1].replace(/[\n\r]/g, ' ');
                const items = cleanedList.split('|').map(s => s.trim()).filter(s => s !== "");
                const index = parseInt(indexMatch[1]) - 1;
                
                if (items[index]) {
                    console.log(`✅ تم حل الفخ. العنصر المطلوب: [${items[index]}]`);
                    await client.messaging.sendGroupMessage(CHANNEL_ID, `#${items[index]}`);
                }
            }
        }
    } catch (err) { console.error("⚠️ خطأ في معالجة النص:", err.message); }
}

// ==========================================
// قسم 2: منطق الكابتشا الصور
// ==========================================
async function handleImageCaptcha(message) {
    if (message.sourceSubscriberId !== TARGET_USER_ID) return;
    
    try {
        const response = await fetch(message.body);
        const buffer = Buffer.from(await response.arrayBuffer());
        
        // التحقق من اللون
        const { data, info } = await sharp(buffer).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
        let redPixels = 0;
        const totalPixels = info.width * info.height;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i] > 120 && data[i] > (data[i + 1] + 30) && data[i] > (data[i + 2] + 30)) redPixels++;
        }
        if ((redPixels / totalPixels) * 100 <= 40) return;

        // استخراج الاسم
        const processedBuffer = await sharp(buffer).greyscale().threshold(160).toBuffer();
        const worker = await createWorker('ara+eng');
        const { data: { text } } = await worker.recognize(processedBuffer);
        await worker.terminate();
        
        const match = text.match(/اللاعب[:\s]+([^\n\r]+)/u);
        const playerName = match ? match[1].trim() : "";
        
        if (ALLOWED_PLAYERS.some(n => playerName.includes(n))) {
            const solved = await solveCaptcha(buffer);
            if (solved) await client.messaging.sendGroupMessage(CHANNEL_ID, `#${solved}`);
        }
    } catch (err) { console.error("⚠️ خطأ كابتشا:", err.message); }
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

// ==========================================
// المهام التلقائية (الصناديق والتحالف)
// ==========================================
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
            else break;
        }
    }
}

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
                if (!b.includes("غير نشط")) {
                    const h = b.match(/(\d+)س/); const m = b.match(/(\d+)د/); const ts = b.match(/(\d+)ث/);
                    if (h) tempTimer += parseInt(h[1]) * 3600; if (m) tempTimer += parseInt(m[1]) * 60; if (ts) tempTimer += parseInt(ts[1]);
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
        } catch (err) { console.error("⚠️ خطأ حلقة:", err.message); await new Promise(resolve => setTimeout(resolve, 5000)); }
    }
};

// ==========================================
// المستمع الرئيسي للرسائل
// ==========================================
client.on('groupMessage', async (message) => {
    if (message.targetGroupId !== CHANNEL_ID) return;

    // 1. اختبارات نصية
    if (message.type === 'text') {
        await handleTextVerification(message);
    }
    // 2. كابتشا صور
    else if (message.type === 'text/image_link') {
        await handleImageCaptcha(message);
    }
});

client.on('ready', async () => {
    console.log("🚀 النظام يعمل: (مهام + كابتشا + فخاخ منفصلة)");
    await sendBoxCommand();
    setInterval(sendBoxCommand, 30 * 60 * 1000);
    startTaskLoop();
});

client.login(process.env.U_MAIL, process.env.U_PASS);
