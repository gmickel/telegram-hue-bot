import Winston from 'winston';

const logger = new(Winston.Logger)({
  transports: [
    new(Winston.transports.Console)({
      json: false,
      timestamp: true,
      prettyPrint: true,
      colorize: true,
      handleExceptions: true,
      level: 'info'
    }),
    new(Winston.transports.File)({
      filename: __dirname + '/../../hue-bot.log',
      json: true,
      handleExceptions: true
    })
  ]
});

export default logger;
