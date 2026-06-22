import 'dotenv/config';
import wolfjs from 'wolf.js';

const { WOLF } = wolfjs;

const ROOM_ID = 18187126;
const TARGET_USER_ID = 75423789;

const service = new WOLF();

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function getMessageText(message) {
    return (
        message.body ||
        message.content ||
        message.text ||
        message.message ||
        ''
    ).trim();
}

function getRoomId(message) {
    return Number(
        message.targetGroupId ||
        message.groupId ||
        message.channelId ||
        message.recipientGroupId ||
        message.group?.id ||
        0
    );
}

function extractWord(text) {
    const match = text.match(/\|-->\s*(.*?)\s*<--\|/);

    if (!match) return null;

    return match[1].trim();
}

function reverseText(text) {
    return text.split('').reverse().join('');
}

async function send(roomId, text) {
    try {
        await service.messaging.sendGroupMessage(roomId, text);

        console.log('📤 تم الإرسال:', text);

        return true;
    } catch (err) {
        console.log('❌ فشل الإرسال:', err.message);

        return false;
    }
}

service.on('ready', async () => {
    console.log('✅ الحساب جاهز');

    await sleep(1000);

    await send(ROOM_ID, '!عكس');
});

service.on('message', async (message) => {
    try {
        const senderId = Number(message.sourceSubscriberId);
        const roomId = getRoomId(message);
        const text = getMessageText(message);

        console.log('----------------------------');
        console.log('senderId:', senderId);
        console.log('roomId:', roomId);
        console.log('isGroup:', message.isGroup);
        console.log('text:', text);

        if (!text) {
            console.log('⚠️ رسالة فارغة');
            return;
        }

        if (!message.isGroup) {
            console.log('⚠️ ليست رسالة قناة');
            return;
        }

        if (roomId !== ROOM_ID) {
            console.log('⚠️ قناة مختلفة');
            return;
        }

        if (senderId !== TARGET_USER_ID) {
            console.log('⚠️ عضوية مختلفة');
            return;
        }

        const word = extractWord(text);

        if (!word) {
            console.log('⚠️ لم يتم العثور على كلمة');

            return;
        }

        const answer = reverseText(word);

        console.log('الكلمة:', word);
        console.log('الإجابة:', answer);

        await sleep(250);

        const sent = await send(roomId, answer);

        if (!sent) {
            console.log('⚠️ إعادة محاولة الإرسال');

            await sleep(500);

            await send(roomId, answer);
        }

    } catch (err) {
        console.log('❌ خطأ:', err.message);
    }
});

service.login(
    process.env.U_MAIL_1,
    process.env.U_PASS_1
);
