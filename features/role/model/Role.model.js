const mongoose = require('mongoose');

try {
    'use strict';

    const RoleSchema = new mongoose.Schema({
        name: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            minlength: 3,
            maxlength: 30
        },

        createdAt : {
            type: Date,
            default: Date.now
        },
        updatedAt: {
            type: Date,
            default: Date.now
        }
    });

    RoleSchema.pre('save', function (next) {
        this.updatedAt = Date.now();
        next();
    })

    const Role = mongoose.model('Role', RoleSchema);

    module.exports = Role;

} catch (error) {
    console.error('Error creating the User schema:', error);
}
