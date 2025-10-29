const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
const path = require('path');
const bcrypt = require('bcryptjs');
const User = require('./models/user');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = 'mongodb://127.0.0.1:27017/leave_management';

// Set up session store
const store = new MongoDBStore({
    uri: MONGODB_URI,
    collection: 'sessions'
});

// Catch errors in the session store
store.on('error', function(error) {
    console.error('Session store error:', error);
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: false,
    store: store
}));

// Routes
app.use('/auth', require('./routes/auth'));
app.use('/leave', require('./routes/leave'));

// Connect to MongoDB and initialize app
async function initializeApp() {
    try {
        // Connect to MongoDB
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to MongoDB');

        // Force create/update admin account
        try {
            console.log('Setting up admin account...');
            const plainPassword = 'admin123';
            const hashedPassword = await bcrypt.hash(plainPassword, 12);
            
            // Try to find existing admin
            let adminUser = await User.findOne({ username: 'admin' });
            
            if (adminUser) {
                // Update existing admin
                adminUser.password = hashedPassword;
                adminUser.isAdmin = true;
                adminUser.casualLeaveBalance = 30;
                await adminUser.save();
                console.log('Admin account updated successfully');
            } else {
                // Create new admin
                adminUser = new User({
                    username: 'admin',
                    password: hashedPassword,
                    isAdmin: true,
                    casualLeaveBalance: 30
                });
                await adminUser.save();
                console.log('Admin account created successfully');
            }
            console.log('Admin credentials - Username: admin, Password: admin123');
        } catch (error) {
            console.error('Error setting up admin account:', error);
        }

        // Start the server
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`Server is running on port ${PORT}`);
            console.log('Try accessing the server at:');
            console.log(`http://localhost:${PORT}`);
            console.log(`http://127.0.0.1:${PORT}`);
        });
    } catch (error) {
        console.error('Initialization error:', error);
        process.exit(1);
    }
}

// Start the application
initializeApp();