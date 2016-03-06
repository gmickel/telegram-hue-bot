import _ from 'lodash';

export function arrayToChunks(array, chunkSize) {
  return _.map(array, (item, index) => {
    return index % chunkSize === 0 ? array.slice(index, index + chunkSize) : null;
  }).filter(item => item);
}

export function createFriendlySceneName(name) {
  const index = name.search(/on\s\d.*/);
  let friendlyName;
  if (index  !== -1) {
    friendlyName = name.substring(0, index);
  } else {
    return name;
  }

  return friendlyName;
}
