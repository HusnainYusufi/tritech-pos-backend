'use strict';

const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser'); // Ensure cookieParser is imported correctly
const express = require('express');
const cors = require('cors');
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

        // CORS (must run BEFORE auth middleware, and must properly answer OPTIONS preflights)
        const parseOrigins = (val) =>
            String(val || '')
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);

        const allowedOrigins = parseOrigins(process.env.CORS_ORIGINS);
        // Safe defaults for local/dev if env isn't set (do NOT add "*" if using credentials)
        if (allowedOrigins.length === 0) {
            allowedOrigins.push('http://localhost:3003', 'http://localhost:3000', 'http://localhost:5173');
        }

        const corsOptions = {
            origin: (origin, cb) => {
                // allow non-browser clients (no Origin header)
                if (!origin) return cb(null, true);
                if (allowedOrigins.includes(origin)) return cb(null, true);
                return cb(null, false);
            },
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
            allowedHeaders: [
                'Origin',
                'X-Requested-With',
                'Content-Type',
                'Accept',
                'Authorization',
                'x-tenant-id',
                'x-branch-id',
                'x-pos-id',
                'x-terminal-id'
            ],
            optionsSuccessStatus: 204,
            maxAge: 86400
        };

        app.use(cors(corsOptions));
        app.options('*', cors(corsOptions));


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
                { url: "/t/auth/login-pin", methods: ['POST'], rateLimit: { windowMs: 15 * 60 * 1000, max: 10 } },
                { url: "/t/auth/forgot-password", methods: ['POST'] },
                { url: "/t/auth/reset-password", methods: ['POST'] },
                { url: "/t/auth/register-owner", methods: ['POST'] },
                
                // OTP-based password reset endpoints (PUBLIC)
                { url: "/auth/password-reset/request-otp", methods: ['POST'] },
                { url: "/auth/password-reset/verify-otp", methods: ['POST'] },
                { url: "/auth/password-reset/reset", methods: ['POST'] },
                { url: "/t/auth/password-reset/request-otp", methods: ['POST'] },
                { url: "/t/auth/password-reset/verify-otp", methods: ['POST'] },
                { url: "/t/auth/password-reset/reset", methods: ['POST'] },
                
                // PUBLIC endpoints for cashier login screen
                // Cashiers need to see branches and terminals BEFORE logging in
                { url: "/t/branches", methods: ['GET'] },           // Branch list for dropdown
                { url: "/t/pos/terminals", methods: ['GET'] },      // Terminal list for dropdown

                // Boomerangme Integration (PUBLIC - called by Boomerangme platform)
                // These endpoints validate credentials internally, JWT not required
                { url: "/integrations/boomerangme/check-credentials", methods: ['POST'] },
                { url: "/integrations/boomerangme/get-inventory", methods: ['POST'] },

            ]
        }));

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
