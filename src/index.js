/* eslint-disable no-unused-expressions */
'use strict';

import hugh from 'hugh';
import TelegramBot from 'node-telegram-bot-api';
import config from './config';
const state = new hugh.LightState();

const bot = new TelegramBot(config.token, { polling: true });

bot.onText(/\/echo (.+)/, (msg, match) => {
  const fromId = msg.from.id;
  const resp = match[1];
  bot.sendMessage(fromId, resp);
});

bot.onText(/\/echo (.+)/, (msg, match) => {
  const fromId = msg.from.id;
  const resp = match[1];
  bot.sendMessage(fromId, resp);
});

bot.onText(/\/love/, (msg) => {
  const chatId = msg.chat.id;
  const opts = {
    reply_to_message_id: msg.message_id,
    reply_markup: JSON.stringify({
      keyboard: [
        ['Yes, you are the bot of my life ❤'],
        ['No, sorry there is another one...']]
    })
  };
  bot.sendMessage(chatId, 'Do you love me?', opts);
});
