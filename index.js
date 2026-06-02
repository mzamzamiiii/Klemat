import 'dotenv/config';
import wolfjs from 'wolf.js';
import sharp from 'sharp';
import { createWorker } from 'tesseract.js';
import fetch from 'node-fetch';

const { WOLF } = wolfjs;
const client = new WOLF();

// --- الإعدادات ---
const TARGET_USER_ID = 729373 ;
const CHANNEL_ID = 81889058; // تأكد من وضع رقم القناة هنا
const ALLOWED_PLAYERS = ['أوكسجينه', 'أوكسجيته', 'أوكسجيئه'];

// --- المعالجة الرئيسية ---
client.on('groupMessage', async (message) => {
    // 1. الفلاتر الأساسية
    if (message.sourceSubscriberId != TARGET_USER_ID) return;
    if (message.targetGroupId != CHANNEL_ID) return;
    if (message.type !== 'text/image_link') return;

    try {
        const response = await fetch(message.body);
        const buffer = Buffer.from(await response.arrayBuffer());

        // 2. التحقق من أنها كابتشا (بناءً على اللون الأحمر كما في كودك السابق)
        if (!(await isCaptchaByColor(buffer))) return;

        // 3. استخراج اسم اللاعب
        const playerName = await extractPlayerName(buffer);
        
        // 4. التحقق من الاسم
        if (ALLOWED_PLAYERS.some(n => playerName.includes(n))) {
            console.log(`✅ تم التعرف على اللاعب: ${playerName} - جاري الحل...`);
            
            // 5. حل الكابتشا
            const code = await solveCaptcha(buffer);
            if (code) {
                await client.messaging.sendGroupMessage(CHANNEL_ID, `#${code}`);
                console.log(`🚀 تم إرسال الحل: #${code}`);
            }
        } else {
            console.log(`❌ اسم اللاعب غير مسموح: ${playerName}`);
        }
    } catch (err) {
        console.error("⚠️ خطأ في معالجة الكابتشا:", err.message);
    }
});

// --- الدوال ---

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

client.on('ready', () => console.log("🚀 البوت يعمل الآن (مراقب للكابتشا فقط)"));
client.login(process.env.U_MAIL, process.env.U_PASS);
