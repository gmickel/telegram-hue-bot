/* eslint-disable no-unused-expressions */
'use strict';

import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import NodeCache from 'node-cache';
import acl from './lib/acl';
import config from './lib/config';
import logger from './lib/logger';
import Hue from './lib/hueCommands';
import validCommands from './lib/validCommands';
import KeyboardControls from './lib/keyboardControls';
import MessageSender from './lib/messageSender';
import state from './lib/state';

import _ from 'lodash';

const bot = new TelegramBot(config.telegram.botToken, { polling: true });
const hueCommands = new Hue(config);
const cache = new NodeCache({ stdTTL: 0, checkperiod: 150 });

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
function sendCommands(messageSender) {
  const response = [`Hi ${getTelegramName(messageSender.fromId)}!`];
  response.push('Below is a list of commands:');
  response.push('\n*General commands:*');
  response.push('`/help` displays this list of commands');
  response.push('`/quick` to display the quick command keyboard');
  response.push('\n*GUI commands:*');
  response.push('`/hue` to start controlling your lights using the telegram keyboard');
  response.push('`/clear` clears all previously entered commands, ie. restarts the current keyboard control flow'); // eslint-disable-line max-len
  response.push('\n*Text commands:*');
  response.push('\n*Listing lights, groups or scenes:*');
  response.push('`/ls|list [lights, groups, scenes]` List a resource');
  response.push('`/l|light [id]` Show a light\'s state and attributes');
  response.push('`/g|group [id]` Show a group\'s state and attributes');
  response.push('\n*Light / Group manipulation :*');
  response.push('`/l|light [id] [command] <value>`');
  response.push('`/g|group [id] [command] <value>`');
  response.push('\n*The following commands are supported for light / group manipulation :*');
  response.push('`on | off` Turn a light or a group on or off');
  response.push('`preset <red|energize|...>` Apply a preset from the config file to a light or group.'); // eslint-disable-line max-len
  response.push('`scene <sceneId>` Apply a scene to a group, use group 0 for the group defined in the scene or use another group to apply the scene to the defined group *and* the specified group.'); // eslint-disable-line max-len
  response.push('`bri <0-255>` Set the brightness of a group or light.');
  response.push('`sat <0-255>` Set the saturation of a group or light.');
  response.push('`hue <0-65535>` Set the hue of a group or light.');
  response.push('`xy <0-255>` Set the hue x and y coordinates of a color in CIE color space of a group or light.'); // eslint-disable-line max-len
  response.push('`rgb <255,255,255>` Set the colour using RGB of a group or light.');

  return messageSender.send(response.join('\n'));
}

function handleAuthorization(user, password, messageSender) {
  const message = [];
  const fromId = messageSender.fromId;
  if (isAuthorized(fromId)) {
    message.push('Already authorized.');
    message.push('Type /hue, /start, /quick or /help to begin.');
    return messageSender.send(message.join('\n'));
  }

  // make sure the user is not banned
  if (isRevoked(fromId)) {
    message.push('Your access has been revoked, you cannot reauthorize.');
    message.push('Please reach out to the bot owner for support.');
    logger.warn(`The revoked user: ${fromId} tried to reauthorize`);
    return messageSender.send(message.join('\n'));
  }

  if (password !== config.bot.password) {
    logger.warn(`The user: ${fromId} entered an invalid password.`);
    return messageSender.send(new Error('Invalid password.'));
  }

  acl.allowedUsers.push(user);
  updateACL();

  if (acl.allowedUsers.length === 1) {
    if (!config.bot.owner) {
      const ownerPromptMsg = [`Your User ID is: ${fromId}`];
      ownerPromptMsg.push(
        'Please add your User ID to the config file in the field labeled \'owner\'.'
      );
      ownerPromptMsg.push('This will allow you to use the admin commands.');
      ownerPromptMsg.push('Please restart the bot once you have updated the config file.');
      return messageSender.send(ownerPromptMsg.join('\n'));
    }
  }

  message.push('You have been authorized.');
  message.push('Type /hue, /start, /quick or /help');

  return messageSender.send(message.join('\n'));
}

function sendUnauthorizedMsg(messageSender) {
  messageSender.send(
    new Error('You are not authorized to use this bot.\n`/auth [password]` to authorize.')
  );
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
  const msgId = msg.message_id;
  let match = null;

  const messageSender = new MessageSender(bot, user, fromId, chatId, msgId);

  /*
   * handle authorization
   */
  if ((match = /^\/auth (.+)$/g.exec(message)) !== null) {
    const password = match[1];
    return handleAuthorization(user, password, messageSender);
  }

  // Reject all unauthorized commands except for /auth
  if (!verifyUser(fromId)) {
    return sendUnauthorizedMsg(messageSender);
  }

  /**
   * matches quick command
   */
  if (/^\/(?:[qQ]|[qQ]uick)/g.test(message)) {
    logger.debug(`user: ${fromId}, message: sent \'/quick\' command`);

    return hueCommands.getGroups().then((groupIds) => {
      const markup = [
        [
          '/all on',
          '/all off'
        ]
      ];

      _.forEach(groupIds, (groupId) => {
        markup.push([
          `/g ${groupId} on`,
          `/g ${groupId} off`
        ]);
      });

      messageSender.send('Quick commands\n\n', markup);
    });
  }

  /*
   * handle help command
   */
  if (/^\/(?:[hH]|[hH]elp)$/g.test(message)) {
    logger.debug(`user: ${fromId}, message: sent \'/help\' command`);
    return sendCommands(messageSender);
  }

  /*
   * handle clear command
   */
  if (/^\/[cC]lear$/g.test(message)) {
    logger.debug(`user: ${fromId}, message: sent \'/clear\' command`);
    const keyboardControls =
      new KeyboardControls(bot, user, chatId, msgId, config, cache, hueCommands, messageSender);
    keyboardControls.clearCache();
    logger.debug(`user: ${fromId}, \'/clear\' command successfully executed`);
    return messageSender.send('Successfully cleared all previous commands');
    keyboardControls.sendResources();
  }

  /**
   * matches the list command
   * valid resources are lights, groups and scenes
   */
  if ((match = /^\/(?:[lL]s|[lL]ist)? (.+)$/g.exec(message)) !== null) {
    logger.debug(`user: ${fromId}, sent ${match[0]}`);

    if (validCommands.list.indexOf(match[1]) === -1) {
      return messageSender.send(new Error(`Resource \`${match[1]}\` doesn't exist`));
    }

    return hueCommands.list(match)
      .then((lights) => {
        messageSender.send(lights);
      });
  }

  /**
   * matches the all command
   * used to easily manipulate group 0 (all lights)
   */
  if ((match = /^\/[aA](?:ll)? (.+)$/g.exec(message)) !== null) {
    logger.debug(`user: ${fromId}, sent ${match[0]}`);

    const groupId = 0;
    const command = match[1];

    if (command) {
      if (validCommands.group.indexOf(command) === -1) {
        return messageSender.send(new Error(`Command \`${command}\` doesn't exist`));
      }
    }

    return hueCommands.groups(groupId, command)
      .then((groups) => {
        messageSender.send(groups);
      })
      .catch((error) => {
        messageSender.send(new Error(error));
      });
  }

  /**
   * matches the group command
   * used to manipulate groups
   */
  if ((match = /^\/[gG](?:roup)? (.+)$/g.exec(message)) !== null) {
    logger.debug(`user: ${fromId}, sent ${match[0]}`);

    const [groupId, command, value] = match[1].split(' ');

    if (!command) {
      return hueCommands.group(groupId)
        .then((group) => {
          messageSender.send(group);
        })
        .catch((error) => {
          messageSender.send(new Error(error));
        });
    }

    if (command) {
      if (validCommands.group.indexOf(command) === -1) {
        messageSender.send(new Error(`Command \`${command}\` doesn't exist`));
      }
    }

    return hueCommands.groups(groupId, command, value)
      .then((groups) => {
        messageSender.send(groups);
      })
      .catch((error) => {
        messageSender.send(new Error(error));
      });
  }

  /**
   * matches the light command
   * used to get the attributes of a light
   */

  if ((match = /^\/[lL](?:ight)? (.+)$/g.exec(message)) !== null) {
    logger.debug(`user: ${fromId}, sent ${match[0]}`);
    const [lightId, command, value] = match[1].split(' ');

    if (!command) {
      return hueCommands.light(lightId)
        .then((light) => {
          messageSender.send(light);
        })
        .catch((error) => {
          messageSender.send(new Error(error));
        });
    }

    if (command) {
      if (validCommands.light.indexOf(command) === -1) {
        return messageSender.send(new Error(`Command \`${command}\` doesn't exist`));
      }
    }

    return hueCommands.lights(lightId, command, value)
      .then((lights) => {
        messageSender.send(lights);
      })
      .catch((error) => {
        messageSender.send(new Error(error));
      });
  }

  /**
   * Start keyboard controls, send the resources keyboard to the user
   */
  const keyboardControls =
    new KeyboardControls(bot, user, chatId, msgId, config, cache, hueCommands, messageSender);

  if (/^\/(?:(?:h|H)ue?|(?:s|S)tart)/g.test(message)) {
    if (!verifyUser(fromId)) {
      return sendUnauthorizedMsg(messageSender);
    }

    logger.debug(`Keyboard controls: ${fromId} started the keyboard controls`);
    return keyboardControls.sendResources();
  }

  const currentState = cache.get(`state${user.id}`);
  logger.debug(`Keyboard controls: current state: ${currentState}`);

  if (currentState === state.RESOURCE) {
    logger.debug(`Keyboard controls: Sending ${message} list to ${fromId}`);
    return keyboardControls.sendList(message);
  }

  if (currentState === state.LIGHT
    || currentState === state.GROUP
    || currentState === state.SCENE) {
    const resourceId = message.split(' ')[0];
    logger.debug(
      `Keyboard controls: ${fromId} requested the ${currentState} commands for ${resourceId}
      `);
    if (currentState === state.LIGHT) {
      return keyboardControls.sendLightCommands(resourceId);
    }

    if (currentState === state.GROUP) {
      return keyboardControls.sendGroupCommands(resourceId);
    }

    if (currentState === state.SCENE) {
      return keyboardControls.sendSceneCommands(resourceId);
    }
  }

  if (currentState === state.COMMAND) {
    const resourceId = cache.get(`resourceId${user.id}`);
    const resource = cache.get(`resource${user.id}`);
    logger.debug(`Keyboard controls: ${fromId} send ${message} to ${resource} ${resourceId}`);
    switch (resource) {
      case state.LIGHT: {
        const command = validCommands.keyboardCommands.light[message];
        if (_.values(validCommands.keyboardCommands.light).indexOf(command) === -1) {
          return messageSender.send(new Error(`Invalid command \`${message}\``));
        }

        if (command === 'on' || command === 'off') {
          return keyboardControls.setLightState(resourceId, command);
        }

        return keyboardControls.sendValues(message);
      }

      case state.GROUP: {
        const command = validCommands.keyboardCommands.group[message];
        if (_.values(validCommands.keyboardCommands.group).indexOf(command) === -1) {
          return messageSender.send(new Error(`Invalid command \`${message}\``));
        }

        if (command === 'on' || command === 'off') {
          return keyboardControls.setGroupState(resourceId, command);
        }

        return keyboardControls.sendValues(message);
      }

      case state.SCENE: {
        const groupId = parseInt(message.split(' ')[0], 10);
        if (!Number.isInteger(groupId)) {
          logger.error(`Apply scene: invalid group id \`${message.split(' ')[0]}\``);
          return messageSender.send(new Error(`Invalid group id \`${message.split(' ')[0]}\``));
        }

        return keyboardControls.setGroupState(groupId, resource, resourceId);
      }

      default: {
        logger.error(`Resource ${resource} not found`);
        return messageSender.send(new Error(`Resource \`${resource}\` not found`));
      }
    }
  }

  if (currentState === state.VALUE) {
    const resourceId = cache.get(`resourceId${user.id}`);
    const resource = cache.get(`resource${user.id}`);
    const command = cache.get(`command${user.id}`);
    logger.debug(
      `Keyboard controls: ${fromId} send ${command} ${message} to ${resource} ${resourceId}`);

    let value = message;

    if (command.match(/(preset|scene)/) === null) {
      if (message.endsWith('%')) {
        const key = message.substring(0, message.length - 1);
        value = config.hue.values[command][key];
      } else {
        value = parseInt(message, 10);
        if (_.isNaN(value)) {
          return messageSender.send(`Invalid \`${command}\` value *${message}*`);
        }
      }
    }

    switch (resource) {
      case state.LIGHT: {
        return keyboardControls.setLightState(resourceId, command, value);
      }

      case state.GROUP: {
        return keyboardControls.setGroupState(resourceId, command, value);
      }

      default: {
        logger.error(`Resource ${resource} not found`);
        return messageSender.send(new Error(`Resource \`${resource}\` not found`));
      }
    }
  }

  keyboardControls.clearCache();
  return keyboardControls.sendResources();
});
