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
import KeyboardControls from './lib/keyboardControls';
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
function replyWithError(userId, chatId, err) {
  logger.warn('user: %s message: %s', userId, err.message);
  return bot.sendMessage(chatId, `*Error:* ${err.message}`, {
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
  return _.some(acl.allowedUsers, { id: userId }) === true;
}

/*
 * prompt for admin message
 */
function promptOwnerConfig(userId, chatId) {
  const message = [`Your User ID is: ${userId}`];
  message.push('Please add your User ID to the config file in the field labeled \'owner\'.');
  message.push('This will allow you to use the admin commands.');
  message.push('Please restart the bot once you have updated the config file.');
  return bot.sendMessage(chatId, message.join('\n'));
}

/*
 * verify admin of the bot

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
 */

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
function sendCommands(fromId, chatId) {
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

  return bot.sendMessage(chatId, response.join('\n'), { parse_mode: 'Markdown', selective: 2 });
}

function handleAuthorization(fromId, chatId, user, password) {
  const message = [];

  if (isAuthorized(fromId)) {
    message.push('Already authorized.');
    message.push('Type /start to begin.');
    return sendMessage(chatId, message.join('\n'));
  }

  // make sure the user is not banned
  if (isRevoked(fromId)) {
    message.push('Your access has been revoked, you cannot reauthorize.');
    message.push('Please reach out to the bot owner for support.');
    logger.warn(`The revoked user: ${fromId} tried to reauthorize`);
    return sendMessage(chatId, message.join('\n'));
  }

  if (password !== config.bot.password) {
    logger.warn(`The user: ${fromId} entered an invalid password.`);
    return replyWithError(fromId, chatId, new Error('Invalid password.'));
  }

  acl.allowedUsers.push(user);
  updateACL();

  if (acl.allowedUsers.length === 1) {
    if (!config.bot.owner) {
      promptOwnerConfig(fromId, chatId);
    }
  }

  message.push('You have been authorized.');
  message.push('Type /help, /quick or /hue');

  return sendMessage(chatId, message.join('\n'));
}

function sendUnauthorizedMsg(userId, chatId) {
  replyWithError(
    userId,
    chatId,
    new Error('You are not authorized to use this bot.\n`/auth [password]` to authorize.'));
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

bot.on('message', (msg) => {
  const user = msg.from;
  const fromId = msg.from.id;
  const message = msg.text;
  const chatId = msg.chat.id;
  let match = null;

  /*
   * handle authorization
   */
  if ((match = /^\/auth (.+)$/g.exec(message)) !== null) {
    const password = match[1];
    return handleAuthorization(fromId, chatId, user, password);
  }

  // Reject all unauthorized commands except for /auth
  if (!verifyUser(fromId)) {
    return sendUnauthorizedMsg(fromId, chatId);
  }

  /**
   * matches quick command
   */
  if (/^\/quick$/g.test(message)) {
    logger.info(`user: ${fromId}, message: sent \'/quick\' command`);

    hueApi.getGroups().then((groupIds) => {
      const markup = [['/all on', '/all off']];

      _.forEach(groupIds, (groupId) => {
        markup.push([`/g ${groupId} on`, `/g ${groupId} off`]);
      });

      const opts = {
        reply_to_message_id: msg.message_id,
        reply_markup: JSON.stringify({
          keyboard: markup,
          resize_keyboard: true
        })
      };
      bot.sendMessage(chatId,
        'Hue bot started\n\nEnter /hue for keyboard control or /help for a list of commands', opts);
    });
    return;
  }

  /*
   * handle help command
   */
  if (/^\/help$/g.test(message)) {
    logger.info(`user: ${fromId}, message: sent \'/help\' command`);
    return sendCommands(fromId, chatId);
  }

  /**
   * matches the list command
   * valid resources are lights, groups and scenes
   */
  if ((match = /^\/(?:ls|list)? (.+)$/g.exec(message)) !== null) {
    logger.info(`user: ${fromId}, sent ${match[0]}`);

    if (validCommands.list.indexOf(match[1]) === -1) {
      const error = new Error('Resource doesn\'t exist');
      return replyWithError(fromId, error);
    }

    hueApi.list(match)
      .then((lights) => {
        sendMessage(chatId, lights);
      });
    return;
  }

  /**
   * matches the all command
   * used to easily manipulate group 0 (all lights)
   */
  if ((match = /^\/a(?:ll)? (.+)$/g.exec(message)) !== null) {
    logger.info(`user: ${fromId}, sent ${match[0]}`);

    const groupId = 0;
    const command = match[1];

    if (command) {
      if (validCommands.group.indexOf(command) === -1) {
        return replyWithError(fromId, chatId, new Error('Resource doesn\'t exist'));
      }
    }

    hueApi.groups(groupId, command)
      .then((groups) => {
        sendMessage(chatId, groups);
      })
      .catch((error) => {
        replyWithError(fromId, chatId, new Error(error));
      });
    return;
  }

  /**
   * matches the group command
   * used to manipulate groups
   */
  if ((match = /^\/g(?:roup)? (.+)$/g.exec(message)) !== null) {
    logger.info(`user: ${fromId}, sent ${match[0]}`);

    const [groupId, command, value] = match[1].split(' ');

    if (!command) {
      hueApi.group(groupId)
        .then((group) => {
          sendMessage(chatId, group);
        });
      return;
    }

    if (command) {
      if (validCommands.group.indexOf(command) === -1) {
        return replyWithError(fromId, chatId, new Error('Resource doesn\'t exist'));
      }
    }

    hueApi.groups(groupId, command, value)
      .then((message) => {
        sendMessage(chatId, message);
      })
      .catch((error) => {
        replyWithError(fromId, chatId, new Error(error));
      });
  }

  /**
   * matches the light command
   * used to get the attributes of a light
   */

  if ((match = /^\/l(?:ight)? (.+)$/g.exec(message)) !== null) {
    logger.info(`user: ${fromId}, sent ${match[0]}`);
    const [lightId, command, value] = match[1].split(' ');

    if (!command) {
      hueApi.light(lightId)
        .then((light) => {
          sendMessage(chatId, light);
        });
      return;
    }

    if (command) {
      if (validCommands.light.indexOf(command) === -1) {
        return replyWithError(fromId, chatId, new Error('Resource doesn\'t exist'));
      }
    }

    hueApi.lights(lightId, command, value)
      .then((message) => {
        sendMessage(chatId, message);
      })
      .catch((error) => {
        replyWithError(fromId, chatId, new Error(error));
      });
  }

  const keyboardControls = new KeyboardControls(bot, user, config, cache);

  // Start keyboard controls, send the resources keyboard to the user
  if (/^\/(?:h|H)ue?/g.test(message)) {
    if (!verifyUser(fromId)) {
      return sendUnauthorizedMsg(fromId, chatId);
    }

    return keyboardControls.sendResources();
  }

  const currentState = cache.get(`state${user.id}`);
  logger.info(currentState);

  if (currentState === state.RESOURCE) {
    logger.info(message);
    return keyboardControls.sendList(message);
  }

  // next maybe return a message with the selected thing etc
});
