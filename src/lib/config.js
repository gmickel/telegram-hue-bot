import fs from 'fs-extra';
import logger from './logger';
import _ from 'lodash';
import hugh from 'hugh';

const configFile = `${__dirname}/../../config/config.json`;
const configFileTemplate = `${configFile}.template`;

let config;

function discoverBridge() {
  logger.info('Hue Bridge host not specified, running Bridge discovery');
  return hugh.discoverBridges()
    .then((bridges) => {
      logger.info(`Found the following bridges, using the first one
        to use a different one, please edit your config.json.`);
      config.hue.host = bridges[0].internalipaddress;
      _.forEach(bridges, (bridge) => {
        logger.info(`${bridge.internalipaddress}`);
      });
    })
}

function createUser() {
  const hueApi = new hugh.HueApi(config.hue.host);
  return hueApi.createUser({devicetype: 'telegram-hue-bot#node'})
    .then((results) => {
      config.hue.user = results[0].success.username;
      logger.info(`${config.hue.user} created on the Hue bridge`);
    })
    .catch((error) => {
      throw new Error(error.message);
    })
}

try {
  logger.info('config file found %s', configFile);
  config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
} catch (err) {

  // JSON file is not correct
  if (err.name === 'SyntaxError') {
    throw new Error('Invalid configuration file, please make sure the file is in JSON format.');
  }

  // config file not found
  if (err.code === 'ENOENT') {
    logger.warn('config file not found, copying from template');
    fs.copySync(configFileTemplate, configFile);
    throw new Error('Please enter the required parameters in the config file.');
  }
}

if (_.isEmpty(config.telegram.botToken)) {
  throw new Error('Please enter the bot token in the config file');
}

if (_.isEmpty(config.bot.password)) {
  throw new Error('Please enter a password for your bot in the config file');
}

if (_.isEmpty(config.hue.host) && _.isEmpty(config.hue.user)) {
  discoverBridge()
    .then(() => {
      return createUser();
    })
    .then(() => {
      // TODO: do write here
      logger.info('config', config);
    })
    .catch((error) => {
      process.nextTick(() => {
        logger.error('Please press the link button on your hue Bridge and try again');
        throw new Error(error.message);
      });
    })
}

/*
if (_.isEmpty(config.hue.host)) {
  discoverBridge();
}

if (_.isEmpty(config.hue.user)) {
  discoverBridge();
}
*/

// export something better
export default config;
