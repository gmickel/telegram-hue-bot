import fs from 'fs-extra';
import logger from './logger';
import _ from 'lodash';
import hugh from 'hugh';

const configFile = `${__dirname}/../../config/config.json`;
const configFileTemplate = `${configFile}.template`;

let config;

function checkRequiredConfigOptions(config) {
  if (_.isEmpty(config.telegram.botToken)) {
    throw new Error('Please enter the bot token in the config file');
  }

  if (_.isEmpty(config.bot.password)) {
    throw new Error('Please enter a password for your bot in the config file');
  }

  if (_.isEmpty(config.hue.host)) {
    logger.info('Hue Bridge host not specified, running Bridge discovery');
    hugh.discoverBridges()
      .then((bridges) => {
        logger.info(`Found the following bridges, using the first one
        to use a different one, please edit your config.json.`);
        config.hue.host = bridges[0].internalipaddress;
        _.forEach(bridges, (bridge) => {
          logger.info(`${bridge.internalipaddress}`);
        })
        return config;
      })
      .catch((error) => {
        throw new Error(error.message);
      });

    if (_.isEmpty(config.hue.user)) {
      // create user
      logger.info('Hue Bridge user not specified, creating a user');
    }
  }
}

try {
  logger.info('config file found %s', configFile);
  config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
  config = checkRequiredConfigOptions(config);
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

export default config;
