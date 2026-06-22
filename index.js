import 'dotenv/config';
import wolfjs from 'wolf.js';

const { WOLF } = wolfjs;

const ROOM_ID = 18187126;
const TARGET_USER_ID = 75423789;

const client = new WOLF({
  identity: process.env.U_MAIL_1,
  secret: process.env.U_PASS_1
});

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

function reverseText(text) {
  return text.split('').reverse().join('');
}

client.on('ready', () => {
  console.log('✅ Bot Connected');
});

client.on('message', async (message) => {
  try {
    const senderId = Number(message.sourceSubscriberId);
    const text = getMessageText(message);

    console.log('--------------------');
    console.log('senderId:', senderId);
    console.log('text:', text);

    if (!text) return;
    if (senderId !== TARGET_USER_ID) return;

    await client.messaging.sendGroupMessage(ROOM_ID, '!عكس');
    console.log('📤 Sent: !عكس');

    await sleep(1000);

    const reversedText = reverseText(text);

    await client.messaging.sendGroupMessage(ROOM_ID, reversedText);
    console.log('📤 Sent:', reversedText);

  } catch (error) {
    console.error('❌ Error:', error);
  }
});

client.connect();
