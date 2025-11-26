const jwt = require('jsonwebtoken');
const { transporter } = require('./nodemail'); // Corrected import
require('dotenv').config();
const bcrypt = require('bcrypt');

const verifyToken = async (token) => {
    try {
        const decoded = await new Promise((resolve, reject) => {
            jwt.verify(token, process.env.JWT_SECRET_KEY, (err, decoded) => {
                if (err) {
                    reject(err);``
                } else {
                    resolve(decoded);
                }
            });
        });

        return { data: decoded, message: "Token Verified" };
    } catch (error) {
        console.log(error);
    }
};

const createToken = async (reqObj) => {
    let { user } = reqObj || {};
    
  
    if (!user) {
        throw new Error('userData is undefined in the request object');
    }

    let { email , _id , roleId , name } = user;

    const payload = { email, user: _id, name ,  userType : roleId.name  };

    try {
        const token = await jwt.sign(payload, process.env.JWT_SECRET_KEY, {
            expiresIn: '2h' 
        });

        return token;
    } catch (error) {
        console.log(error);
        throw error;
    }
};



const sendEmail = async ({ from, to, subject, text, html, attachments }) => {
    try {
        let info = await transporter.sendMail({
            from: from,
            to: to,
            subject: subject,
            text: text,
            html: html,
            attachments: attachments,
        });

        console.log('Message sent: %s', info.messageId);
        return info;
    } catch (error) {
        console.error('Error sending email: ', error);
        throw error;
    }
};

const haspassword = async(plainpass) => {
    try {
        let newpassword = bcrypt.hashSync(plainpass , 10);
        return newpassword;
    } catch (error) {
        throw error;
    }
}

const comparePassword = async (hashedPassword, plainPass) => {
  try {
    const match = await bcrypt.compare(plainPass, hashedPassword);
    return match ? "Ok" : "Password Not Matched";
  } catch (error) {
    throw error;
  }
};



module.exports = {
    verifyToken,
    createToken,
    sendEmail,
    haspassword,
    comparePassword
};
