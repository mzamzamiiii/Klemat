import 'dotenv/config';
import wolfjs from 'wolf.js';
const { WOLF } = wolfjs;

const settings = {
    identity: process.env.U_MAIL || 'your_email@example.com',
    secret: process.env.U_PASS || 'your_password',
    taskGroupId: 1000 ,
    depositGroupId: 224 ,
    minuteInterval: 63 * 1000,
    boxInterval: 3 * 60 * 1000
};

const MY_INFO = {
    keywords: ["شكرّا أصحابي","اونرنا"], 
    ownerId: "2481425"  
};

let canOpenBoxes = true; 
let isPaused = false;
let lastBoxCommandTime = 0; 
let lastRoutineCommandTime = 0; 

const numToWord = {'0':'صفر','1':'واحد','2':'اثنان','3':'ثلاثة','4':'أربعة','5':'خمسة','6':'ستة','7':'سبعة','8':'ثمانية','9':'تسعة','10':'عشرة'};
const wordToNum = {'صفر':'0','واحد':'1','اثنان':'2','ثلاثة':'3','أربعة':'4','خمسة':'5','ستة':'6','سبعة':'7','ثمانية':'8','تسعة':'9','عشرة':'10'};

const service = new WOLF();

// دالة مساعدة للتحقق من وجود أي من الأسماء في الرسالة
const hasMyName = (text) => MY_INFO.keywords.some(name => text.includes(name));

const sendRoutineCommands = async () => {
    if (isPaused) return;
    try {
        lastRoutineCommandTime = Date.now();
        await service.messaging.sendGroupMessage(settings.taskGroupId, "!مد مهام");
        setTimeout(async () => {
            if (!isPaused) {
                lastRoutineCommandTime = Date.now(); 
                await service.messaging.sendGroupMessage(settings.depositGroupId, "!مد تحالف ايداع كل");
            }
        }, 3000);
    } catch (e) {}
};

// --- [القسم الجديد: مراقبة الخاص] ---
service.on('privateMessage', async (message) => {
    try {
        const TARGET_SENDER_ID = 80055399; 
        const TRIGGER_COMMAND = "!مد صندوق ضمان وقت";

        if (message.sourceSubscriberId === TARGET_SENDER_ID && message.body.trim() === TRIGGER_COMMAND) {
            await service.messaging.sendGroupMessage(settings.taskGroupId, TRIGGER_COMMAND);
            console.log(`[الخاص] تم تمرير أمر الضمان من ${TARGET_SENDER_ID}`);
        }
    } catch (err) {}
});

// --- [معالجة رسائل المجموعات] ---
service.on('groupMessage', async (message) => {
    try {
        const isTargetGroup = message.targetGroupId === settings.taskGroupId || message.targetGroupId === settings.depositGroupId;
        if (!isTargetGroup) return;

        const content = message.body;

        // 1. التوقف الإنتاجي
        if (content.includes("تم إيقاف الأوامر الإنتاجية مؤقتًا") && hasMyName(content)) {
            const match = content.match(/\d+/); 
            if (match) {
                isPaused = true;
                setTimeout(() => { isPaused = false; }, parseInt(match[0]) * 60 * 1000);
            }
            return;
        }

        // 2. إيقاف الصناديق لنفاذ المفاتيح
        if (content.includes("لا تملك مفاتيح!") && message.targetGroupId === settings.taskGroupId) {
            if (Date.now() - lastBoxCommandTime < 5000) canOpenBoxes = false;
            return;
        }

        // 3. نظام الأولوية وفك الفخاخ
        const isTrap = content.includes("لأنك لاعب مجتهد جدًا اليوم") || content.includes("سؤال التحقق الخاص بك هو");
        const isSafetyAlert = content.includes("يوجد سؤال تحقق نشط");

        if ((isTrap && hasMyName(content)) || isSafetyAlert || (isTrap && content.includes("سؤال التحقق"))) {
            
            if (isSafetyAlert) {
                const now = Date.now();
                if ((now - lastRoutineCommandTime <= 1000) || (now - lastBoxCommandTime <= 1000)) {
                    await service.messaging.sendGroupMessage(message.targetGroupId, "!مد فحص");
                }
                return;
            }

            let answer = null;

            if (content.includes('عضوية')) answer = MY_INFO.ownerId;
            else if (content.includes('بالكلمات') || content.includes('بالحروف')) {
                const match = content.match(/\d+/);
                if (match && numToWord[match[0]]) answer = numToWord[match[0]];
            }
            else if (content.includes('بالأرقام') || content.includes('بالارقام')) {
                for (let word in wordToNum) { if (content.includes(word)) { answer = wordToNum[word]; break; } }
            }
            else if (content.includes('اكتب') && (content.includes('كلمة') || content.includes('كما هي'))) {
                const match = content.match(/:\s*(\S+)/) || content.match(/هي\s+(\S+)/);
                if (match) answer = match[1];
            }
            else if (content.includes('صح أم خطأ') || content.includes('صح أو خطأ') || content.includes('التحالف') || content.includes('الصناديق')) {
                answer = "صح";
            }
            else if (content.includes('أيهما') || content.includes('ايهما')) {
                const nums = content.match(/\d+/g);
                if (nums && nums.length >= 2) {
                    const n1 = parseInt(nums[0]), n2 = parseInt(nums[1]);
                    answer = (content.includes('أكبر') || content.includes('اكبر')) ? Math.max(n1, n2) : Math.min(n1, n2);
                }
            }
            else if (content.includes('ناتج') || content.includes('+') || content.includes('-') || content.includes('جمع') || content.includes('طرح')) {
                const nums = content.match(/\d+/g);
                if (nums && nums.length >= 2) {
                    const n1 = parseInt(nums[0]), n2 = parseInt(nums[1]);
                    answer = (content.includes('-') || content.includes('طرح') || content.includes('ناقص')) ? n1 - n2 : n1 + n2;
                }
            }

            if (answer !== null) {
                setTimeout(async () => {
                    await service.messaging.sendGroupMessage(message.targetGroupId, `#${answer}`);
                    setTimeout(() => sendRoutineCommands(), 2000);
                }, 5000);
            }
        }
    } catch (err) {}
});

service.on('ready', async () => {
    console.log(`🚀 البوت جاهز ويراقب الأسماء: ${MY_INFO.keywords.join(', ')}`);
  
    try {
        await service.group.joinById(settings.taskGroupId);
        await service.group.joinById(settings.depositGroupId);
        sendRoutineCommands();
        setInterval(() => sendRoutineCommands(), settings.minuteInterval);
        setInterval(() => {
            if (canOpenBoxes && !isPaused) {
                lastBoxCommandTime = Date.now();
                service.messaging.sendGroupMessage(settings.taskGroupId, "!مد صندوق فتح ");
            }
        }, settings.boxInterval);
    } catch (e) {}
});

service.login(settings.identity, settings.secret);
