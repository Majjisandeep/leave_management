const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    casualLeaveBalance: {
        type: Number,
        default: 12 // Default 12 casual leaves per year
    }
});

// Hash password before saving (only if not already hashed)
userSchema.pre('save', async function(next) {
    if (this.isModified('password') && !this.password.startsWith('$2a$')) {
        this.password = await bcrypt.hash(this.password, 12);
    }
    next();
});

module.exports = mongoose.model('User', userSchema);