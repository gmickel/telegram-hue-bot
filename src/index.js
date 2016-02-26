/* eslint-disable no-unused-expressions */
'use strict';

import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import acl from './lib/acl';
import config from './lib/config';
import logger from './lib/logger';
import Hue from './lib/hue';
import validCommands from './lib/validCommands';

import _ from 'lodash';

const bot = new TelegramBot(config.telegram.botToken, { polling: true });
const hueApi = new Hue(config);

/*
 * default message sender with markdown
 */
function sendMessage(userId, message) {
  return bot.sendMessage(userId, message, {
    parse_mode: 'Markdown'
  });
}

/*
 * handle removing the custom keyboard
 */
function replyWithError(userId, err) {
  logger.warn('user: %s message: %s', userId, err.message);
  return bot.sendMessage(userId, `*Error:* ${err.message}`, {
    parse_mode: 'Markdown',
    reply_markup: {
      hide_keyboard: true
    }
  });
}

/*
 * check to see is user is authenticated
 * returns true/false
 */
function isAuthorized(userId) {
  return _.some(acl.allowedUsers, { id: userId });
}

/*
 * check to see is user is banned
 * returns true/false
 */
function isRevoked(userId) {
  return _.some(acl.revokedUsers, { id: userId });
}

/*
 * verify user can use the bot
 */
function verifyUser(userId) {
  if (_.some(acl.allowedUsers, { id: userId }) !== true) {
    replyWithError(
      userId,
      new Error('You are not authorized to use this bot.\n`/auth [password]` to authorize.'));
    return false;
  }

  return true;
}

/*
 * save access control list
 */
function updateACL() {
  fs.writeFile(`${__dirname}/../config/acl.json`, JSON.stringify(acl), (err) => {
    if (err) {
      throw new Error(err);
    }

    logger.info('the access control list was updated');
  });
}

/*
 * get the bot name
 */
bot.getMe()
  .then((msg) => {
    logger.info(`hue bot ${msg.username} initialized`);
  })
  .catch((err) => {
    throw new Error(err);
  });

/*
 * handle authorization
 */
bot.onText(/\/auth (.+)/, (msg, match) => {
  const fromId = msg.from.id;
  const password = match[1];

  const message = [];

  if (isAuthorized(fromId)) {
    message.push('Already authorized.');
    message.push('Type /start to begin.');
    return sendMessage(fromId, message.join('\n'));
  }

  // make sure the user is not banned
  if (isRevoked(fromId)) {
    message.push('Your access has been revoked, you cannot reauthorize.');
    message.push('Please reach out to the bot owner for support.');
    logger.warn(`The revoked user: ${fromId} tried to reauthorize`);
    return sendMessage(fromId, message.join('\n'));
  }

  if (password !== config.bot.password) {
    logger.warn(`The user: ${fromId} entered an invalid password.`);
    return replyWithError(fromId, new Error('Invalid password.'));
  }

  acl.allowedUsers.push(msg.from);
  updateACL();
  message.push('You have been authorized.');
  message.push('Type /start to begin.');

  return sendMessage(fromId, message.join('\n'));
});

/**
 * matches start command
 */
bot.onText(/\/start/, (msg) => {
  const fromId = msg.from.id;
  if (!verifyUser(fromId)) {
    return;
  }

  hueApi.getGroups().then((groupIds) => {
    const markup = [['/all on', '/all off']];

    _.forEach(groupIds, (groupId) => {
      markup.push([`/g ${groupId} on`, `/g ${groupId} off`]);
    });

    const chatId = msg.chat.id;
    const opts = {
      reply_to_message_id: msg.message_id,
      reply_markup: JSON.stringify({
        keyboard: markup,
        resize_keyboard: true
      })
    };
    bot.sendMessage(chatId, 'Hue bot started', opts);
  });
});

/**
 * matches the list command
 * valid resources are lights, groups and scenes
 */
bot.onText(/\/(?:ls|list)? (.+)/, (msg, match) => {
  const fromId = msg.from.id;
  logger.info(`user: ${fromId}, sent ${match[0]}`);
  if (!verifyUser(fromId)) {
    return;
  }

  if (validCommands.list.indexOf(match[1]) === -1) {
    const error = new Error('Resource doesn\'t exist');
    replyWithError(fromId, error);
    return;
  }

  hueApi.list(match)
    .then((message) => {
      sendMessage(fromId, message);
    });
});

/**
 * matches the all command
 * used to easily manipulate group 0 (all lights)
 */
bot.onText(/\/a(?:ll)? (.+)/, (msg, match) => {
  const fromId = msg.from.id;
  logger.info(`user: ${fromId}, sent ${match[0]}`);
  if (!verifyUser(fromId)) {
    return;
  }

  const groupId = 0;
  const command = match[1];

  if (command) {
    if (validCommands.group.indexOf(command) === -1) {
      replyWithError(fromId, new Error('Resource doesn\'t exist'));
      return;
    }
  }

  hueApi.groups(groupId, command)
    .then((message) => {
      sendMessage(fromId, message);
    })
    .catch((error) => {
      replyWithError(fromId, new Error(error));
    });
});

/**
 * matches the group command
 * used to manipulate groups
 */
bot.onText(/\/g(?:roup)? (.+)/, (msg, match) => {
  const fromId = msg.from.id;
  logger.info(`user: ${fromId}, sent ${match[0]}`);
  if (!verifyUser(fromId)) {
    return;
  }

  const [groupId, command, value] = match[1].split(' ');

  if (!command) {
    hueApi.group(groupId)
      .then((message) => {
        sendMessage(fromId, message);
      });
    return;
  }

  if (command) {
    if (validCommands.group.indexOf(command) === -1) {
      replyWithError(fromId, new Error('Resource doesn\'t exist'));
      return;
    }
  }

  hueApi.groups(groupId, command, value)
    .then((message) => {
      sendMessage(fromId, message);
    })
    .catch((error) => {
      replyWithError(fromId, new Error(error));
    });
});

/**
 * matches the light command
 * used to get the attributes of a light
 */

bot.onText(/\/l(?:ight)? (.+)/, (msg, match) => {
  const fromId = msg.from.id;
  logger.info(`user: ${fromId}, sent ${match[0]}`);
  if (!verifyUser(fromId)) {
    return;
  }

  const [lightId, command, value] = match[1].split(' ');

  if (!command) {
    hueApi.light(lightId)
      .then((message) => {
        sendMessage(fromId, message);
      });
    return;
  }

  if (command) {
    if (validCommands.light.indexOf(command) === -1) {
      replyWithError(fromId, new Error('Resource doesn\'t exist'));
      return;
    }
  }

  hueApi.lights(lightId, command, value)
    .then((message) => {
      sendMessage(fromId, message);
    })
    .catch((error) => {
      replyWithError(fromId, new Error(error));
    });
});
