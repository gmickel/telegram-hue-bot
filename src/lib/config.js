import fs from 'fs-extra';
import logger from './logger';
import _ from 'lodash';
import hugh from 'hugh';

const configFile = `${__dirname}/../../config/config.json`;
const configFileTemplate = `${configFile}.template`;

let config;

function updateConfig(config) {
  fs.writeFile(`${__dirname}/../../config/config.json`, JSON.stringify(config, null, 4), (err) => {
    if (err) {
      throw new Error(err);
    }

    logger.info('the config file has been updated, please start the telegram-hue-bot again');
    process.exit(0);
  });
}

function sleep(time) {
  return new Promise(resolve => {
    setTimeout(resolve, time)
  })
}

function discoverBridge() {
  logger.warn('Hue Bridge host not specified, running Bridge discovery');
  return hugh.discoverBridges()
    .then((bridges) => {
      logger.info(`Found the following bridges, using the first one
        to use a different one, please edit your config.json.`);
      config.hue.host = bridges[0].internalipaddress;
      _.forEach(bridges, (bridge) => {
        logger.info(`${bridge.internalipaddress}`);
      });
    })
    .catch((error) => {
      throw new Error(error.message);
    })
}

function createUser() {
  const hueApi = new hugh.HueApi(config.hue.host);
  return hueApi.createUser({ devicetype: 'telegram-hue-bot#node' })
    .then((results) => {
      config.hue.user = results[0].success.username;
      logger.info(`${config.hue.user} created on the Hue bridge`);
    })
    .catch((error) => {
      throw new Error(error.message);
    });
}

try {
  logger.info('config file found %s', configFile);
  config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
} catch (err) {

  // JSON file is not correct
  if (err.name === 'SyntaxError') {
    logger.error('Invalid configuration file, please make sure the file is in JSON format.');
    process.exit(0);
  }

  // config file not found
  if (err.code === 'ENOENT') {
    logger.warn('config file not found, copying from template');
    fs.copySync(configFileTemplate, configFile);
    logger.error('Please enter the required parameters in the config file.');
    process.exit(0);
  }
}

if (_.isEmpty(config.telegram.botToken)) {
  logger.error('Please enter the bot token in the config file');
  process.exit(0);
}

if (_.isEmpty(config.bot.password)) {
  logger.error('Please enter a password for your bot in the config file');
  process.exit(0);
}

if (_.isEmpty(config.hue.host) || _.isEmpty(config.hue.user)) {
  discoverBridge()
    .then(() => {
      if (_.isEmpty(config.hue.user)) {
        const delay = 20000;
        logger.warn('Hue Bridge user not specified, creating user');
        logger.warn(`Starting create user in ${delay / 1000} seconds, please press the link button on your Hue Bridge`);
        return sleep(delay);
      } else {
        updateConfig(config);
      }
    })
    .then(() => {
      return createUser();
    })
    .then(() => {
      updateConfig(config);
    })
    .catch((error) => {
      process.nextTick(() => {
        logger.error(error.message);
        process.exit(0);
      });
    })
}

logger.info('Config is valid, starting bot');

export default config;
