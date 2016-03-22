'use strict';

import _ from 'lodash';
import validCommands from './validCommands';
import { arrayToChunks, createFriendlySceneName } from './utils';

class MessageBuilder {
  lights(lightsObj) {
    return _.map(lightsObj, (light, id) => {
      return `*${light.name}*
       *id*: \`${id}\` | on: ${light.state.on ? 'yes' : 'no'}
       *xy*: ${light.state.xy.join(', ')} | *rgb*: ${light.state.rgb.join(', ')}
        *h*: ${light.state.hue} | *s*: ${light.state.sat} | *b*: ${light.state.bri}`;
    }).join('\n');
  }

  lightsKeyboard(lightsObj) {
    return _.map(lightsObj, (light, id) => {
      return [`${id} - ${light.name} | on: ${light.state.on ? 'yes' : 'no'}`];
    });
  }

  light(lightObj) {
    return `*${lightObj.name}*
         *on*: ${lightObj.state.on ? 'yes' : 'no'}
         *xy*: ${lightObj.state.xy.join(', ')} | *rgb*: ${lightObj.state.rgb.join(', ')}
         *h*: ${lightObj.state.hue} | *s*: ${lightObj.state.sat} | *b*: ${lightObj.state.bri}`;
  }

  group(groupObj) {
    return `*${groupObj.name}*
    lights: ${groupObj.lights.join(',')}`;
  }

  groups(groupsObj) {
    return _.map(groupsObj, (group, id) => {
      return `*${group.name}* - id: \`${id}\`
      lights: ${group.lights.join(', ')}`;
    }).join('\n');
  }

  groupsKeyboard(groupsObj) {
    const groups = [['0 - All lights']];
    const realGroups = _.map(groupsObj, (group, id) => {
      return [`${id} - ${group.name} - lights: ${group.lights.join(', ')}`];
    });
    return groups.concat(realGroups);
  }

  getGroupIds(groupsObj) {
    return _.map(groupsObj, (group, id) => {
      return id;
    });
  }

  scenes(scenesObj) {
    return _.map(scenesObj, (scene, id) => {
      return `*${createFriendlySceneName(scene.name)}* - id: \`${id}\`
      lights: ${scene.lights.join(', ')}`;
    }).join('\n');
  }

  scenesKeyboard(scenesObj) {
    return _.map(scenesObj, (scene, id) => {
      return [`${id} ${createFriendlySceneName(scene.name)} - l: ${scene.lights.join(', ')}`];
    });
  }

  lightCommandsKeyboard() {
    const keyboard = [];
    const commands = arrayToChunks(Object.keys(validCommands.keyboardCommands.light), 2);
    commands.forEach((row) => {
      const rowElement = row.map((item) => item);
      keyboard.push(rowElement);
    });

    return keyboard;
  }

  groupCommandsKeyboard() {
    const keyboard = [];
    const commands = arrayToChunks(Object.keys(validCommands.keyboardCommands.group), 2);
    commands.forEach((row) => {
      const rowElement = row.map((item) => item);
      keyboard.push(rowElement);
    });

    return keyboard;
  }

  valuesKeyboard(command, config) {
    const keyboard = [];
    switch (command) {
      case 'preset': {
        const presets = arrayToChunks(Object.keys(config.hue.presets), 2);
        presets.forEach((row) => {
          const rowElement = row.map((item) => item);
          keyboard.push(rowElement);
        });
        break;
      }

      case 'effect': {
        keyboard.push(['colorloop', 'none']);
        break;
      }

      default: {
        // handles all commands that have values set in the config file
        keyboard.push(Object.keys(config.hue.values[command]).map(key => key + '%'));
      }
    }

    return keyboard;
  }
}

export default new MessageBuilder();
