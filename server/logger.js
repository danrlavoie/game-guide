var pino = require('pino');

var isProduction = process.env.NODE_ENV === 'production';

var logger = pino({
  level: process.env.LOG_LEVEL || 'info',
}, isProduction
  ? pino.destination({ dest: 2, sync: false })
  : pino.transport({
      target: 'pino-pretty',
      options: {
        destination: 2,
        colorize: true,
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname',
      }
    })
);

module.exports = logger;
