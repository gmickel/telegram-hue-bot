import fs from 'fs-extra';
import logger from './logger';

const aclListFile = `${__dirname}/../../config/acl.json`;
const aclListFileTemplate = `${aclListFile}.template`;

let acl;

try {
  logger.info(`acl file found ${aclListFile}`);
  acl = JSON.parse(fs.readFileSync(aclListFile, 'utf8'));
} catch (err) {
  if (err.name === 'SyntaxError') {
    logger.error('Invalid acl file, please make sure the file is in JSON format');
    process.exit(0);
  }

  // config file not found
  if (err.code === 'ENOENT') {
    logger.warn('acl file not found, copying from template');
    fs.copySync(aclListFileTemplate, aclListFile);
    acl = JSON.parse(fs.readFileSync(aclListFile, 'utf8'));
  }
}

export default acl;
