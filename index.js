import 'dotenv/config';
import wolfjs from 'wolf.js';

const { WOLF } = wolfjs;

const ROOM_ID = 18187126;
const TARGET_USER_ID = 75423789;

const client = new WOLF();

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
    0
  );
}

function reverseText(text) {
  return text.split('').reverse().join('');
}

client.on('message', async (message) => {
  try {
    const senderId = Number(message.sourceSubscriberId);
    const roomId = getRoomId(message);
    const text = getMessageText(message);

    console.log('--------------------');
    console.log('senderId:', senderId);
    console.log('roomId:', roomId);
    console.log('text:', text);

    if (!text) return;
    if (roomId !== ROOM_ID) return;
    if (senderId !== TARGET_USER_ID) return;

    console.log('✅ TARGET MATCHED');

    await client.messaging.sendGroupMessage(ROOM_ID, '!عكس');
    console.log('📤 Sent: !عكس');

    await sleep(1000);

    const reversedText = reverseText(text);

    await client.messaging.sendGroupMessage(ROOM_ID, reversedText);
    console.log('📤 Sent:', reversedText);

  } catch (error) {
    console.error('❌ Message Error:', error);
  }
});

async function start() {
  try {
    console.log('🔐 Login...');
    await client.login(process.env.U_MAIL_1, process.env.U_PASS_1);
    console.log('✅ Login Success');
  } catch (error) {
    console.error('❌ Login Error:', error);
  }
}

start();
