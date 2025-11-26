const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: 'notifications.vmeals@gmail.com',
      pass: 'scirxseibfucmbyt '
    },
    tls: {
        // do not fail on invalid certs
        rejectUnauthorized: false
    },
});

module.exports = {
    transporter
}

