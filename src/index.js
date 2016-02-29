/* eslint-disable no-unused-expressions */
'use strict';

import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import NodeCache from 'node-cache';
import acl from './lib/acl';
import config from './lib/config';
import logger from './lib/logger';
import Hue from './lib/hue';
import validCommands from './lib/validCommands';
import state from './lib/state';

import _ from 'lodash';

const bot = new TelegramBot(config.telegram.botToken, { polling: true });
const hueApi = new Hue(config);
const cache = new NodeCache({ stdTTL: 120, checkperiod: 150 });

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
 * prompt for admin message
 */
function promptOwnerConfig(userId) {
  const message = [`Your User ID is: ${userId}`];
  message.push('Please add your User ID to the config file in the field labeled \'owner\'.');
  message.push('This will allow you to use the admin commands.');
  message.push('Please restart the bot once you have updated the config file.');
  return bot.sendMessage(userId, message.join('\n'));
}

/*
 * verify admin of the bot
 */
function verifyAdmin(userId) {
  if (isAuthorized(userId)) {
    promptOwnerConfig(userId);
  }

  if (config.bot.owner !== userId) {
    replyWithError(userId, new Error('You are not authorized to use admin commands'));
    return false;
  }

  return true;
}

/*
 * save access control list
 */
function updateACL() {
  fs.writeFile(`${__dirname}/../config/acl.json`, JSON.stringify(acl, null, 4), (err) => {
    if (err) {
      throw new Error(err);
    }

    logger.info('the access control list was updated');
  });
}

/*
 * get telegram name
 */
function getTelegramName(user) {
  let lastname = '';
  if (typeof user === 'object') {
    lastname = (user.last_name !== undefined) ? ` ${user.last_name}` : '';
    return user.username || (user.first_name + lastname);
  }

  if (typeof user === 'number') {
    const aclUser = _.filter(
      acl.allowedUsers,
      function filterAclUsers(item) { return item.id === user; })[0];

    lastname = (aclUser.last_name !== undefined) ? ` ${aclUser.last_name} ` : '';
    return aclUser.username || (aclUser.first_name + lastname);
  }

  return 'unknown user';
}

/*
 * Send Help Commands To chat
 */
function sendCommands(fromId) {
  const response = [`Hi ${getTelegramName(fromId)}!`];
  response.push('Below is a list of commands:');
  response.push('\n*General commands:*');
  response.push('/start to start this bot (also displays the keyboard)');
  response.push('/help displays this list of commands');
  response.push('\n*List commands:*');
  response.push('`/ls|list [lights, groups, scenes]` List a resource');
  response.push('`/l|light [id]` Show a light\'s state and attributes');
  response.push('`/g|group [id]` Show a group\'s state and attributes');
  response.push('\n*Light / Group manipulation :*');
  response.push('`/l|light [id] [command] <value>`');
  response.push('`/g|group [id] [command] <value>`');
  response.push('*The following commands are supported for light / group manipulation :*');
  response.push('`on | off` Turn a light or a group on or off');
  response.push('`preset <red>` Apply a preset from the config file to a light or group.');
  response.push('`scene <sceneId>` Apply a scene to a group, use group 0 for the group defined in the scene or use another group to apply the scene to the defined group *and* the specified group.'); // eslint-disable-line max-len
  response.push('`bri <0-255>` Set the brightness of a group or light.');
  response.push('`sat <0-255>` Set the saturation of a group or light.');
  response.push('`hue <0-65535>` Set the hue of a group or light.');
  response.push('`xy <0-255>` Set the hue x and y coordinates of a color in CIE color space of a group or light.');
  response.push('`rgb <255,255,255>` Set the colour using RGB of a group or light.');

  return bot.sendMessage(fromId, response.join('\n'), { parse_mode: 'Markdown', selective: 2 });
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

  if (acl.allowedUsers.length === 1) {
    if (!config.bot.owner) {
      promptOwnerConfig(fromId);
    }
  }

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
    bot.sendMessage(chatId, 'Hue bot started\n\nEnter /help for a list of commands', opts);
  });
});

/*
 * handle help command
 */
bot.onText(/^\/help/, (msg) => {
  const fromId = msg.from.id;
  if (!verifyUser(fromId)) {
    return;
  }

  logger.info(`user: ${fromId}, message: sent \'/help\' command`);
  sendCommands(fromId);
});

/**
 * matches the list command
 * valid resources are lights, groups and scenes
 */
bot.onText(/^\/(?:ls|list)? (.+)/, (msg, match) => {
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
bot.onText(/^\/a(?:ll)? (.+)/, (msg, match) => {
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
bot.onText(/^\/g(?:roup)? (.+)/, (msg, match) => {
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

bot.onText(/^\/l(?:ight)? (.+)/, (msg, match) => {
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
