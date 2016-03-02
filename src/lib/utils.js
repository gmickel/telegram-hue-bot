import _ from 'lodash';

export const arrayToChunks = function (array, chunkSize) {
  return _.map(array, (item, index) => {
    return index % chunkSize === 0 ? array.slice(index, index + chunkSize) : null;
  }).filter(item => item);
};
