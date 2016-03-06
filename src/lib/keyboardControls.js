'use strict';

import hugh from 'hugh';
import MessageBuilder from './messageBuilder';
import state from './state';
import logger from './logger';
import validCommands from './validCommands';
import _ from 'lodash';

class KeyboardControls {
  constructor(bot, user, chatId, origMsgId, config, cache, hueCommands, messageSender) {
    this.config = config;
    this.hueCommands = hueCommands;
    this.hueApi = new hugh.HueApi(config.hue.host, config.hue.user);
    this.bot = bot;
    this.user = user;
    this.cache = cache;
    this.chatId = chatId;
    this.origMsgId = origMsgId;
    this.username = this.user.username || (this.user.first_name + (' ' + this.user.last_name || ''));
    this.sender = messageSender;
  }

  clearCache() {
    logger.debug(`user: ${this.username}, message: clearing keyboard controls cache`);

    var cacheItems = [
      'resource', 'light', 'group',
      'scene', 'id', 'command', 'state'
    ];

    return _(cacheItems).forEach((item) => {
      this.cache.del(item + this.user.id);
    });
  }

  sendResources() {
    const keyboard = [];
    keyboard.push(validCommands.list);
    this.cache.set(`state${this.user.id}`, state.RESOURCE);
    return this.sender.send('Please choose a light, group or scene', keyboard);
  };

  sendList(resource) {
    switch (resource) {
      case 'lights': {
        return this.hueApi.lights()
          .then((results) => {
            const keyboard = MessageBuilder.lightsKeyboard(results);
            this.cache.set(`state${this.user.id}`, state.LIGHT);
            this.cache.set(`resource${this.user.id}`, state.LIGHT);
            return this.sender.send('Please choose a light', keyboard);
          })
          .catch((error) => {
            this.clearCache();
            logger.error(error);
            return this.sender.send(new Error('Something went wrong!'));
          });
      }

      case 'groups': {
        return this.hueApi.groups()
          .then((results) => {
            const keyboard = MessageBuilder.groupsKeyboard(results);
            this.cache.set(`state${this.user.id}`, state.GROUP);
            this.cache.set(`resource${this.user.id}`, state.GROUP);
            return this.sender.send('Please choose a group', keyboard);
          })
          .catch((error) => {
            this.clearCache();
            logger.error(error);
            return this.sender.send(new Error('Something went wrong!'));
          });
      }

      case 'scenes': {
        return this.hueApi.scenes()
          .then((results) => {
            const keyboard = MessageBuilder.scenesKeyboard(results);
            this.cache.set(`state${this.user.id}`, state.SCENE);
            this.cache.set(`resource${this.user.id}`, state.SCENE);
            return this.sender.send('Please choose a scene', keyboard);
          })
          .catch((error) => {
            this.clearCache();
            logger.error(error);
            return this.sender.send(new Error('Something went wrong!'));
          });
      }

      default: {
        this.clearCache();
        this.sendResources();
        logger.warn(`State: ${state} message: ${resource} - Invalid resource`);
        return this.sender.send(new Error(`Invalid resource \`${resource}\``));
      }
    }
  }

  sendLightCommands(lightId) {
    return this.hueApi.lightStatusWithRGB(lightId)
      .then((results) => {
        const lightStatus = MessageBuilder.light(results);
        const textMessage = `${lightStatus}\n\nPlease choose a command`;
        const keyboard = MessageBuilder.lightCommandsKeyboard();
        this.cache.set(`state${this.user.id}`, state.COMMAND);
        this.cache.set(`resourceId${this.user.id}`, lightId);
        return this.sender.send(textMessage, keyboard);
      })
      .catch((error) => {
        this.clearCache();
        this.sendResources();
        logger.error(error);
        return this.sender.send(new Error('Something went wrong!'));
      });
  }

  sendGroupCommands(groupId) {
    return this.hueApi.groupStatus(groupId)
      .then((results) => {
        const groupStatus = MessageBuilder.group(results);
        const textMessage = `${groupStatus}\n\nPlease choose a command`;
        const keyboard = MessageBuilder.groupCommandsKeyboard();
        this.cache.set(`state${this.user.id}`, state.COMMAND);
        this.cache.set(`resourceId${this.user.id}`, groupId);
        return this.sender.send(textMessage, keyboard);
      })
      .catch((error) => {
        this.clearCache();
        this.sendResources();
        logger.error(error);
        return this.sender.send(new Error('Something went wrong!'));
      });
  }

  sendSceneCommands(sceneId) {
    return this.hueApi.groups()
      .then((results) => {
        const textMessage = `Please choose a group to apply the scene to.
Group \`0\` applies the scene to the lights which are part of the scene.
Using a different \`group id\` applies the scene to the lights in that group
and the lights which are part of the scene`;
        const keyboard = MessageBuilder.groupsKeyboard(results);
        this.cache.set(`state${this.user.id}`, state.COMMAND);
        this.cache.set(`resourceId${this.user.id}`, sceneId);
        return this.sender.send(textMessage, keyboard);
      })
      .catch((error) => {
        this.clearCache();
        this.sendResources();
        logger.error(error);
        return this.sender.send(new Error('Something went wrong!'));
      });
  }

  sendValues(command) {
    const resource = this.cache.get(`resource${this.user.id}`);
    const hueCommand = validCommands.keyboardCommands[resource][command];
    this.cache.set(`state${this.user.id}`, state.VALUE);
    this.cache.set(`command${this.user.id}`, hueCommand);
    const textMessage = `Please choose a \`${command}\` value or enter a value by hand`;
    const keyboard = MessageBuilder.valuesKeyboard(hueCommand, this.config);
    return this.sender.send(textMessage, keyboard);
  }

  setLightState(resourceId, command, value) {
    this.hueCommands.lights(resourceId, command, value)
      .then((msg) => {
        this.clearCache();
        this.sender.send(msg);
        return this.sendResources();
      })
      .catch((error) => {
        this.clearCache();
        this.sendResources();
        logger.error(error);
        return this.sender.send(new Error('Something went wrong!'));
      })
  }

  setGroupState(resourceId, command, value) {
    this.hueCommands.groups(resourceId, command, value)
      .then((msg) => {
        this.clearCache();
        this.sender.send(msg);
        return this.sendResources();
      })
      .catch((error) => {
        this.clearCache();
        this.sendResources();
        logger.error(error);
        return this.sender.send(new Error('Something went wrong!'));
      })
  }
}

export default KeyboardControls;
