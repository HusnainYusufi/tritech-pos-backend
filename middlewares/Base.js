'use strict';

const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser'); // Ensure cookieParser is imported correctly
const express = require('express');
const { httpsCodes } = require('../modules/constants');
const { language } = require('../language/language');
const { unless } = require('express-unless');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const connectDB = require('../config/db');
require('dotenv').config();

class Base {
    constructor() { }

    static async init(app) {
        app.use(bodyParser.json({ limit: '100mb' }));
        app.use(bodyParser.urlencoded({ limit: '100mb', extended: false }));
        app.use(cookieParser());


        await connectDB();

        Base.authenticate.unless = unless;

        // Apply the `authenticate` middleware with `unless` condition before defining the routes
        app.use(Base.authenticate.unless({
            path: [
                { url: "/auth/login", methods: ['GET', 'PUT', 'POST'] },
                { url: "/auth/register", methods: ['GET', 'PUT', 'POST'] },
                { url: "/auth/verify/otp", methods: ['GET', 'PUT', 'POST'] },
                { url: "/t/auth/accept-invite", methods: ['GET', 'POST'] },
                { url: "/auth/accept-invite", methods: ['GET', 'POST'] },
                { url: "/warehouse/add", methods: ['GET', 'PUT', 'POST'] },
                { url: "/auth/reset-password", methods: ['GET', 'PUT', 'POST'] },
                { url: "/auth/forgotPassword", methods: ['GET', 'PUT', 'POST'] },
                { url: "/auth/verifyToken", methods: ['GET', 'PUT', 'POST'] },
                { url: "/auth/verifyToken", methods: ['GET', 'PUT', 'POST'] },
                { url: /^\/orders\/[^/]+\/status-overview$/, methods: ['GET'] },
                { url: /^\/orders\/[^/]+\/customer-tracking$/, methods: ['GET'] },
                { url: "/role/all", methods: ['GET', 'PUT', 'POST'] },
                { url: "/role/add", methods: ['GET', 'PUT', 'POST'] },
                { url: "/user/add/password", methods: ['GET', 'PUT', 'POST'] },
                { url: new RegExp('^/getFiles/.*'), methods: ['GET', 'PUT', 'POST'] },
                { url: /^\/api-docs\/?.*/, methods: ['GET'] },
                { url: '/api-docs.json', methods: ['GET'] },
                { url: "/t/auth/login", methods: ['GET', 'POST'] },
                { url: "/t/auth/login-pin", methods: ['GET', 'POST'] },
                { url: "/t/auth/forgot-password", methods: ['POST'] },
                { url: "/t/auth/reset-password", methods: ['POST'] },
                { url: "/t/auth/register-owner", methods: ['POST'] },
                
                // POS Terminal list - PUBLIC for cashier login screen
                { url: "/t/pos/terminals", methods: ['GET'] },



            ]
        }));

        // app.use((req, res, next) => {

        //     res.header('Access-Control-Allow-Origin', '*');

        //     // Allow specific headers
        //     res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

        //     // Allow specific HTTP methods
        //     res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');


        //     if (req.method === 'OPTIONS') {
        //         return res.status(200).end(); // Respond OK to preflight request
        //     }


        //     next();
        // });


        app.listen(process.env.PORT, () => {
            console.log('Server running on port', process.env.PORT);
        });

        app.get('/', async (req, res) => {
            return res.json("Welcome to ganna healing");
        });
    }

    static async authenticate(req, res, next) {
        try {
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1];
            if (token == null) {
                return res.status(httpsCodes.UNAUTHORIZE_CODE).json({ message: language.INVALID_AUTH_TOKEN });
            }

            jwt.verify(token, process.env.JWT_SECRET_KEY, (err, user) => {
                if (err) {
                    return res.status(httpsCodes.UNAUTHORIZE_CODE).json({ message: language.INVALID_AUTH_TOKEN });
                }
                req.user = user;
                next(); // Only call next() if no error occurs
            });
        } catch (error) {
            console.log(error);
            return res.status(httpsCodes.INTERNAL_SERVER_ERROR).json({ message: language.SERVER_ERROR });
        }
    }
}

module.exports = {
    Base
};
