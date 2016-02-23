/* eslint-disable no-unused-expressions */
'use strict';

import hugh from 'hugh';
import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import acl from './lib/acl';
import config from './lib/config';
import logger from './lib/logger';
import _ from 'lodash';

const state = new hugh.LightState();

const bot = new TelegramBot(config.telegram.botToken, { polling: true });

// Todo: decorate


/*
 * check to see is user is authenticated
 * returns true/false
 */
function isAuthorized(userId) {
  return _.some(acl.allowedUsers, { 'id': userId });
}

/*
 * check to see is user is banned
 * returns true/false
 */
function isRevoked(userId) {
  return _.some(acl.revokedUsers, { 'id': userId });
}

/*
 * verify user can use the bot
 */
function verifyUser(userId) {
  if (_.some(acl.allowedUsers, { id: userId }) !== true) {
    replyWithError(userId, new Error('You are not authorized to use this bot.\n`/auth [password]` to authorize.'));
    return false;
  }

  return true;
}

/*
 * save access control list
 */
function updateACL() {
  fs.writeFile(__dirname + '/../config/acl.json', JSON.stringify(acl), function(err) {
    if (err) {
      throw new Error(err);
    }

    logger.info('the access control list was updated');
  });
}

/*
 * handle authorization
 */
bot.onText(/\/auth (.+)/, function(msg, match) {
  var fromId = msg.from.id;
  var password = match[1];

  var message = [];

  if (isAuthorized(fromId)) {
    message.push('Already authorized.');
    message.push('Type /start to begin.');
    return bot.sendMessage(fromId, message.join('\n'));
  }

  // make sure the user is not banned
  /* if (isRevoked(fromId)) {
    message.push('Your access has been revoked and cannot reauthorize.');
    message.push('Please reach out to the bot owner for support.');
    return bot.sendMessage(fromId, message.join('\n'));
  } */

  if (password !== config.bot.password) {
    return replyWithError(fromId, new Error('Invalid password.'));
  }

  acl.allowedUsers.push(msg.from);
  updateACL();

  /*if (acl.allowedUsers.length === 1) {
    promptOwnerConfig(fromId);
  }*/

  if (config.bot.owner) {
    bot.sendMessage(config.bot.owner, getTelegramName(msg.from) + ' has been granted access.');
  }

  message.push('You have been authorized.');
  message.push('Type /start to begin.');

  return bot.sendMessage(fromId, message.join('\n'));
});



bot.onText(/\/echo (.+)/, (msg, match) => {
  const fromId = msg.from.id;
  if (!verifyUser(fromId)) {
    return;
  }

  const resp = match[1];
  bot.sendMessage(fromId, resp);
  logger.info('user: %s, message: sent \'/start\' command', fromId);
});

bot.onText(/\/love/, (msg) => {
  const fromId = msg.from.id;
  if (!verifyUser(fromId)) {
    return;
  }

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

/*
 * handle removing the custom keyboard
 */
function replyWithError(userId, err) {
  logger.warn('user: %s message: %s', userId, err.message);
  return bot.sendMessage(userId, '*Oh no!* ' + err, {
    parse_mode: 'Markdown',
    reply_markup: {
      hide_keyboard: true
    }
  });
}

