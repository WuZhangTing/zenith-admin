import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { config } from '../config';
import { logMetricsTransport } from './log-metrics';

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${String(timestamp)} [${level}] ${String(stack || message)}${metaStr}`;
});

const dailyRotateTransport = new DailyRotateFile({
  dirname: config.log.dir,
  filename: 'app-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxFiles: config.log.maxFiles,
  zippedArchive: true,
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    logFormat,
  ),
});

const logger = winston.createLogger({
  level: config.log.level,
  transports: [
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        errors({ stack: true }),
        logFormat,
      ),
    }),
    dailyRotateTransport,
    // 级别计数指标源（监控告警的 logErrorPerMin / logWarnPerMin），只计数不落盘
    logMetricsTransport,
  ],
});

export default logger;
