'use strict';

import hugh from 'hugh';
import MessageBuilder from './messageBuilder';
import state from './state';
import logger from './logger';
import validCommands from './validCommands';

class KeyboardControls {
  constructor(bot, user, config, cache) {
    this.config = config;
    this.hueApi = new hugh.HueApi(config.hue.host, config.hue.user);
    this.bot = bot;
    this.user = user;
    this.cache = cache;
    this.username = this.user.username || (this.user.first_name + (' ' + this.user.last_name || ''));
  }

  sendResources() {
    const keyboard = [];
    keyboard.push(validCommands.list);
    this.cache.set(`state${this.user.id}`, state.RESOURCE);
    return this.sendMessage('Please choose a light, group or scene', keyboard);
  };

  // TODO: ERROR HANDLING
  sendList(resource) {
    const keyboard = [];
    switch (resource) {
      case 'lights': {
        return this.hueApi.lights()
          .then((results) => {
            const keyboard = MessageBuilder.lightsKeyboard(results);
            this.cache.set(`state${this.user.id}`, state.LIGHT);
            return this.sendMessage('Please choose a light', keyboard);
          })
          .catch((error) => {
            logger.error(`Error: State: ${state} message: ${resource}`);
            return this.sendMessage(error);
          });
      }

      case 'groups': {
        return this.hueApi.groups()
          .then((results) => {
            const keyboard = MessageBuilder.groupsKeyboard(results);
            this.cache.set(`state${this.user.id}`, state.GROUP);
            return this.sendMessage('Please choose a group', keyboard);
          })
          .catch((error) => {
            logger.error(`Error: State: ${state} message: ${resource}`);
            return this.sendMessage(error);
          });
      }

      case 'scenes': {
        return this.hueApi.scenes()
          .then((results) => {
            const keyboard = MessageBuilder.scenesKeyboard(results);
            this.cache.set(`state${this.user.id}`, state.SCENE);
            return this.sendMessage('Please choose a scene', keyboard);
          })
          .catch((error) => {
            logger.error(`Error: State: ${state} message: ${resource}`);
            return this.sendMessage(error);
          });
      }

      default: {
        throw new Error(`State: ${state} message: ${resource} - Shouldn't end up here`);
      }
    }


  }

  sendMessage(message, keyboard) {
    keyboard = keyboard || null;

    var options;
    if (message instanceof Error) {
      logger.warn('user: %s message: %s', this.username, message.message);

      message = message.message;
      options = {
        parse_mode: 'Markdown',
        reply_markup: {
          hide_keyboard: true
        }
      };
    } else {
      options = {
        disable_web_page_preview: true,
        parse_mode: 'Markdown',
        selective: 2,
        reply_markup: JSON.stringify({ keyboard: keyboard, one_time_keyboard: true })
      };
    }

    return this.bot.sendMessage(this.user.id, message, options);
  }

}

export default KeyboardControls;
