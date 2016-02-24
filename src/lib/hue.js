'use strict';

import hugh from 'hugh';
import logger from './logger';
import config from './config';
import MessageBuilder from './messageBuilder';

class Hugh {
  constructor(host, username) {
    this.hueApi = new hugh.HueApi(host, username);
  }

  list(args) {
    const resource = args[1];
    switch (resource) {
      case 'lights': {
        return this.hueApi.lights()
          .then((results) => {
            return MessageBuilder.lights(results);
          })
          .catch((error) => {
            return error.message;
          });
      }

      case 'groups': {
        return this.hueApi.groups()
          .then((results) => {
            return MessageBuilder.groups(results);
          })
          .catch((error) => {
            return error.message;
          });
      }

      case 'scenes': {
        return this.hueApi.scenes()
          .then((results) => {
            return MessageBuilder.scenes(results);
          })
          .catch((error) => {
            return error.message;
          });
      }

      default: {
        throw new Error(`Command: ${args} - Shouldn't end up here`);
      }
    }
  }

  light(lightId) {
    return this.hueApi.lightStatus(lightId)
      .then((results) => {
        return MessageBuilder.light(results);
      })
      .catch((error) => {
        return error.message;
      });
  }

  lights(lightId, command, value) {
    const state = new hugh.LightState();
    switch (command) {
      case 'on': {
        state.on();
        return this.hueApi.setLightState(lightId, state)
          .then(() => {
            return 'Command successful';
          })
          .catch((error) => {
            return error.message;
          });
      }

      case 'off': {
        state.off();
        return this.hueApi.setLightState(lightId, state)
          .then(() => {
            return 'Command successful';
          })
          .catch((error) => {
            return error.message;
          });
      }

      case 'bri': {
        state.bri(parseInt(value));
        return this.hueApi.setLightState(lightId, state)
          .then(() => {
            return 'Command successful';
          })
          .catch((error) => {
            return error.message;
          });
      }

      case 'preset': {
        const preset = config.hue.presets.colors[value];
        if (!preset) {
          return Promise.reject(`Invalid preset (${value})`);
        }

        state.on().bri(preset.bri).hue(preset.hue).sat(preset.sat);
        return this.hueApi.setLightState(lightId, state)
          .then(() => {
            return 'Command successful';
          })
          .catch((error) => {
            return error.message;
          });
      }

      default: {
        throw new Error(`Command: ${args} - Shouldn't end up here`);
      }
    }
  }

  group(groupId) {
    return this.hueApi.groupStatus(groupId)
      .then((results) => {
        return MessageBuilder.group(results);
      })
      .catch((error) => {
        return error.message;
      });
  }

  groups(groupId, command, value) {
    const state = new hugh.LightState();
    switch (command) {
      case 'on': {
        state.on();
        return this.hueApi.setGroupState(groupId, state)
          .then(() => {
            return 'Command successful';
          })
          .catch((error) => {
            return error.message;
          });
      }

      case 'off': {
        state.off();
        return this.hueApi.setGroupState(groupId, state)
          .then(() => {
            return 'Command successful';
          })
          .catch((error) => {
            return error.message;
          });
      }

      case 'bri': {
        state.bri(parseInt(value));
        return this.hueApi.setGroupState(groupId, state)
          .then(() => {
            return 'Command successful';
          })
          .catch((error) => {
            return error.message;
          });
      }

      case 'preset': {
        const preset = config.hue.presets.colors[value];
        if (!preset) {
          return Promise.reject(`Invalid preset (${value})`);
        }

        state.on().bri(preset.bri).hue(preset.hue).sat(preset.sat);
        return this.hueApi.setGroupState(groupId, state)
          .then(() => {
            return 'Command successful';
          })
          .catch((error) => {
            return error.message;
          });
      }

      default: {
        throw new Error(`Command: ${args} - Shouldn't end up here`);
      }
    }
  }
}

export default new Hugh(config.hue.host, config.hue.user);
