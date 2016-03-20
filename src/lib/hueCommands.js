'use strict';

import _ from 'lodash';
import hugh from 'hugh';
import MessageBuilder from './messageBuilder';

class Hue {
  constructor(config) {
    this.config = config;
    this.hueApi = new hugh.HueApi(config.hue.host, config.hue.user);
  }

  getGroups() {
    return this.hueApi.groups()
      .then(results => MessageBuilder.getGroupIds(results))
      .catch(error => error.message);
  }

  list(args) {
    const resource = args[1];
    switch (resource) {
      case 'lights': {
        return this.hueApi.lightsWithRGB()
          .then(results => MessageBuilder.lights(results))
          .catch(error => error.message);
      }

      case 'groups': {
        return this.hueApi.groups()
          .then(results => MessageBuilder.groups(results))
          .catch(error => error.message);
      }

      case 'scenes': {
        return this.hueApi.scenes()
          .then(results => MessageBuilder.scenes(results))
          .catch(error => error.message);
      }

      default: {
        throw new Error(`Command: ${args} - Shouldn't end up here`);
      }
    }
  }

  light(lightId) {
    if (_.isNaN(parseInt(lightId, 10))) {
      return Promise.reject(`Invalid light ID *${lightId}*`);
    }

    return this.hueApi.lightStatusWithRGB(lightId)
      .then(results => MessageBuilder.light(results))
      .catch(error => error.message);
  }

  lightState(lightId, command, value) {
    const state = new hugh.LightState();

    switch (command) {
      case 'on': {
        state.on();
        return this.hueApi.setLightState(lightId, state)
          .then(() => 'Command successful')
          .catch(error => error.message);
      }

      case 'off': {
        state.off();
        return this.hueApi.setLightState(lightId, state)
          .then(() => 'Command successful')
          .catch(error => error.message);
      }

      case 'effect': {
        if (value === 'on') {
          value = 'colorloop';
        }
        if (value === 'off') {
          value = 'none';
        }

        state.effect(value);
        return this.hueApi.setLightState(lightId, state)
          .then(() => 'Command successful')
          .catch(error => error.message);
      }

      case 'rgb': {
        let [r, g, b] = value.split(',');
        if (!(r && g && b)) {
          return Promise.reject(`Invalid RGB value ${value}, please use the following format /light 1 rgb \`100,100,100\``); // eslint-disable-line max-len
        }

        [r, g, b] = [r, g, b].map(item => parseInt(item, 10));

        if ((_.isNaN(r) || _.isNaN(g) || _.isNaN(b))) {
          return Promise.reject(`Invalid RGB value ${value}, please use the following format /light 1 rgb \`100,100,100\``); // eslint-disable-line max-len
        }

        state.rgb([r, g, b]);
        return this.hueApi.setLightState(lightId, state)
          .then(() => 'Command successful')
          .catch(error => error.message);
      }

      case 'preset': {
        const preset = this.config.hue.presets[value];
        if (!preset) {
          return Promise.reject(`Invalid preset (${value})`);
        }

        state.on().bri(preset.bri).hue(preset.hue).sat(preset.sat);
        return this.hueApi.setLightState(lightId, state)
          .then(() => 'Command successful')
          .catch(error => error.message);
      }

      default: {
        // Handles numeric state values such as brightness, saturation and hue
        if (_.isNaN(parseInt(value, 10))) {
          return Promise.reject(`Invalid \`${command}\` value *${value}*`);
        }

        state.addValues({ [command]: parseInt(value, 10) });
        return this.hueApi.setLightState(lightId, state)
          .then(() => 'Command successful')
          .catch(error => error.message);
      }
    }
  }

  group(groupId) {
    if (_.isNaN(parseInt(groupId, 10))) {
      return Promise.reject(`Invalid group ID *${groupId}*`);
    }

    return this.hueApi.groupStatus(groupId)
      .then(results => MessageBuilder.group(results))
      .catch(error => error.message);
  }

  groupState(groupId, command, value) {
    const state = new hugh.GroupState();
    switch (command) {
      case 'on': {
        state.on();
        return this.hueApi.setGroupState(groupId, state)
          .then(() => 'Command successful')
          .catch(error => error.message);
      }

      case 'off': {
        state.off();
        return this.hueApi.setGroupState(groupId, state)
          .then(() => 'Command successful')
          .catch(error => error.message);
      }

      case 'effect': {
        if (value === 'on') {
          value = 'colorloop';
        }
        if (value === 'off') {
          value = 'none';
        }

        state.effect(value);
        return this.hueApi.setGroupState(groupId, state)
          .then(() => 'Command successful')
          .catch(error => error.message);
      }

      case 'scene': {
        state.scene(value);
        return this.hueApi.setGroupState(groupId, state)
          .then(() => 'Command successful')
          .catch(error => error.message);
      }

      case 'rgb': {
        let [r, g, b] = value.split(',');
        if (!(r && g && b)) {
          return Promise.reject(`Invalid RGB value ${value}, please use the following format /group 1 rgb \`100,100,100\``); // eslint-disable-line max-len
        }

        [r, g, b] = [r, g, b].map(item => parseInt(item, 10));

        if ((_.isNaN(r) || _.isNaN(g) || _.isNaN(b))) {
          return Promise.reject(`Invalid RGB value ${value}, please use the following format /group 1 rgb \`100,100,100\``); // eslint-disable-line max-len
        }

        state.rgb([r, g, b]);
        return this.hueApi.setGroupState(groupId, state)
          .then(() => 'Command successful')
          .catch(error => error.message);
      }

      case 'preset': {
        const preset = this.config.hue.presets[value];
        if (!preset) {
          return Promise.reject(`Invalid preset (${value})`);
        }

        state.on().bri(preset.bri).hue(preset.hue).sat(preset.sat);
        return this.hueApi.setGroupState(groupId, state)
          .then(() => 'Command successful')
          .catch(error => error.message);
      }

      default: {
        // Handles numeric state values such as brightness, saturation and hue
        if (_.isNaN(parseInt(value, 10))) {
          return Promise.reject(`Invalid \`${command}\` value *${value}*`);
        }

        state.addValues({ [command]: parseInt(value, 10) });
        return this.hueApi.setGroupState(groupId, state)
          .then(() => 'Command successful')
          .catch(error => error.message);
      }
    }
  }
}

export default Hue;
