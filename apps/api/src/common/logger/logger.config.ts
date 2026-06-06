import { format, transports } from 'winston';
import DailyRotateFile = require('winston-daily-rotate-file');
import { WinstonModuleOptions } from 'nest-winston';

export const winstonConfig: WinstonModuleOptions = {
  level: 'info',
  transports: [
    new transports.Console({
      level: 'info',
      format: format.combine(
        format.timestamp(),
        format.ms(),
        format.printf(
          ({ timestamp, level, message, context, stack, ...meta }) => {
            const colorizer = format.colorize();
            const coloredLevel = colorizer.colorize(
              level,
              `[${level.toUpperCase()}]`,
            );
            return `${timestamp} ${coloredLevel} ${context ? `[${context}] ` : ''}${message} ${stack ? `\n${stack}` : ''} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
          },
        ),
      ),
    }),
    new DailyRotateFile({
      level: 'info',
      filename: 'logs/api-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '7d',
      format: format.combine(format.timestamp(), format.json()),
    }),
  ],
};
