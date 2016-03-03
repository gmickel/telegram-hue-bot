'use strict';

import logger from './logger';

class MessageSender {

  constructor(bot, user, fromId, chatId, origMsgId) {
    this.bot = bot;
    this.user = user;
    this.fromId = fromId;
    this.chatId = chatId;
    this.origMsgId = origMsgId;
    this.username = this.user.username || (this.user.first_name + (' ' + this.user.last_name || ''));
  }

  send(message, keyboard) {
    let options;
    if (message instanceof Error) {
      logger.warn('user: %s message: %s', this.username, message.message);

      // TODO: readd reply_to_message_id: this.origMsgId ?
      message = message.message;
      options = {
        parse_mode: 'Markdown',
        disable_notification: true,
        reply_markup: {
          hide_keyboard: true,
          selective: true
        }
      };
      return this.bot.sendMessage(this.chatId, message, options);
    }

    if (keyboard) {
      options = {
        disable_web_page_preview: true,
        parse_mode: 'Markdown',
        selective: true,
        disable_notification: true,
        reply_markup: JSON.stringify({
          keyboard: keyboard,
          one_time_keyboard: true,
          resize_keyboard: true,
          selective: true
        })
      };
    } else {
      options = {
        disable_web_page_preview: true,
        parse_mode: 'Markdown',
        selective: true,
        disable_notification: true
      };
    }

    return this.bot.sendMessage(this.chatId, message, options);
  }
}

export default MessageSender;
