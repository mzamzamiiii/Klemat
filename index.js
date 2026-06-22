import 'dotenv/config';
import wolfjs from 'wolf.js';

const { WOLF } = wolfjs;

const ROOM_ID = 18187126;
const TARGET_USER_ID = 75423789;

const service = new WOLF();

function getMessageText(message) {
  return (
    message.body ||
    message.content ||
    message.text ||
    message.message ||
    ''
  ).trim();
}

function reverseText(text) {
  return text.split('').reverse().join('');
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

service.on('message', async (message) => {
  try {
    const senderId = Number(message.sourceSubscriberId);
    const roomId = getRoomId(message);
    const text = getMessageText(message);

    console.log('--------------------');
    console.log('senderId:', senderId);
    console.log('roomId:', roomId);
    console.log('isGroup:', message.isGroup);
    console.log('text:', text);

    if (!text) return;
    if (!message.isGroup) return;
    if (roomId !== ROOM_ID) return;
    if (senderId !== TARGET_USER_ID) return;

    const reversedText = reverseText(text);

    await service.messaging.sendGroupMessage(ROOM_ID, reversedText);
    console.log('📤 Sent:', reversedText);

  } catch (err) {
    console.log('❌ Message Error:', err.message);
  }
});

service.on('ready', async () => {
  try {
    console.log('✅ الحساب جاهز');

    await service.messaging.sendGroupMessage(ROOM_ID, '!عكس');
    console.log('📤 Sent: !عكس');

  } catch (err) {
    console.log('❌ Ready Error:', err.message);
  }
});

service.login(process.env.U_MAIL_1, process.env.U_PASS_1);
