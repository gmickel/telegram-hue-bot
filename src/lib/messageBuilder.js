'use strict';

import _ from 'lodash';

class MessageBuilder {
  lights(lightsObj) {
    return _.map(lightsObj, (light, id) => {
      return `*${light.name}*
       *id*: ${id} | on: ${light.state.on ? 'yes' : 'no'}
        *h*: ${light.state.hue} | *s*: ${light.state.sat} | *b*: ${light.state.bri}`;
    }).join('\n');
  }

  // TODO: save the ID here for future use
  lightsKeyboard(lightsObj) {
    return _.map(lightsObj, (light, id) => {
      return [`${id} - ${light.name} | on: ${light.state.on ? 'yes' : 'no'}`];
    });
  }


  light(lightObj) {
    return `*${lightObj.name}*
        *on*: ${lightObj.state.on ? 'yes' : 'no'} | *xy*: ${lightObj.state.xy.join(',')}
         *h*: ${lightObj.state.hue} | *s*: ${lightObj.state.sat} | *b*: ${lightObj.state.bri}`;
  }

  group(groupObj) {
    return `*${groupObj.name}*
    lights: ${groupObj.lights.join(',')}`;
  }

  groups(groupsObj) {
    return _.map(groupsObj, (group, id) => {
      return `*${group.name}* - id: ${id}
      lights: ${group.lights.join(',')}`;
    }).join('\n');
  }

  groupsKeyboard(groupsObj) {
    return _.map(groupsObj, (group, id) => {
      return [`${id} - ${group.name} - lights: ${group.lights.join(',')}`];
    });
  }

  getGroupIds(groupsObj) {
    return _.map(groupsObj, (group, id) => {
      return id;
    })
  }

  scenes(scenesObj) {
    return _.map(scenesObj, (scene, id) => {
      return `*${scene.name}* - id: ${id}
      lights: ${scene.lights.join(',')}`;
    }).join('\n');
  }

  // TODO: this isn't really useful, maybe crop
  scenesKeyboard(scenesObj) {
    return _.map(scenesObj, (scene, id) => {
      return [`${id} - ${scene.name} - lights: ${scene.lights.join(',')}`];
    });
  }

}

export default new MessageBuilder();
