const { createLogger, format, transports } = require('winston');

const logger = createLogger({
    level: 'error', // Log only error-level messages
    format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), // Add a timestamp
        format.errors({ stack: true }), // Include stack traces
        format.printf(({ timestamp, level, message, stack, ...meta }) => {
            let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
            if (stack) log += `\nStack Trace: ${stack}`;
            if (Object.keys(meta).length) log += `\nMetadata: ${JSON.stringify(meta)}`;
            log += `\n---------------------------------\n`; 
            return log;
        })
    ),
    transports: [
        new transports.Console({ level: 'error' }), // Log to console for debugging
        new transports.File({ filename: 'logs/error-detailed.log', level: 'error' }) // Log errors to file
    ]
});

module.exports = logger;
