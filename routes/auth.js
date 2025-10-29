const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/user');
const PDFDocument = require('pdfkit');
const XLSX = require('xlsx');
const Leave = require('../models/leave');
const router = express.Router();

// Secure admin key - in production, this should be in environment variables
const ADMIN_SECRET_KEY = 'admin123';

// Middleware to check if user is authenticated
const isAuth = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Please login first' });
    }
    next();
};

// Middleware to check if user is admin
const isAdmin = async (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Please login first' });
    }
    
    try {
        const user = await User.findById(req.session.userId);
        if (!user || !user.isAdmin) {
            return res.status(403).json({ error: 'Admin access required' });
        }
        next();
    } catch (error) {
        res.status(500).json({ error: 'Authorization check failed' });
    }
};

// Middleware to verify admin key
const verifyAdminKey = (req, res, next) => {
    const adminKey = req.headers['admin-key'];
    if (adminKey !== ADMIN_SECRET_KEY) {
        return res.status(403).json({ error: 'Invalid admin key' });
    }
    next();
};

// Register admin (protected route)
router.post('/register-admin', async (req, res) => {
    // Check if any admin exists
    const adminExists = await User.findOne({ isAdmin: true });
    if (!adminExists) {
        // Allow first admin creation without key
        console.log('No admin exists, allowing first admin creation');
    } else {
        // Verify admin key for subsequent admin creations
        const adminKey = req.headers['admin-key'];
        if (adminKey !== ADMIN_SECRET_KEY) {
            return res.status(403).json({ error: 'Invalid admin key' });
        }
    }
    try {
        const { username, password } = req.body;
        console.log('Received admin registration request:', { username });
        
        // Check if user already exists
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            console.log('Admin user already exists:', username);
            return res.status(400).json({ error: 'Username already exists' });
        }

        const user = new User({ username, password, isAdmin: true });
        await user.save();
        console.log('Admin user registered successfully:', username);
        res.json({ message: 'Admin registered successfully' });
    } catch (error) {
        console.error('Admin registration error:', error);
        console.error('Full error details:', error);
        res.status(500).json({ error: 'Registration failed: ' + error.message });
    }
});

// Create user (admin only)
router.post('/create-user', isAdmin, async (req, res) => {
    try {
        const { username, password } = req.body;
        console.log('Received user creation request:', { username });
        
        // Check if user already exists
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            console.log('User already exists:', username);
            return res.status(400).json({ error: 'Username already exists' });
        }

        // Create regular user
        const user = new User({ username, password, isAdmin: false });
        await user.save();
        console.log('User created successfully:', username);
        res.json({ message: 'User created successfully' });
    } catch (error) {
        console.error('User creation error:', error);
        res.status(500).json({ error: 'User creation failed: ' + error.message });
    }
});

// Get all users (admin only)
router.get('/users', isAdmin, async (req, res) => {
    try {
        const users = await User.find({}, { password: 0 }); // Exclude password field
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Delete user (admin only)
router.delete('/delete-user/:userId', isAdmin, async (req, res) => {
    try {
        const userId = req.params.userId;
        
        // Don't allow deleting own account
        if (userId === req.session.userId) {
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (user.isAdmin) {
            return res.status(400).json({ error: 'Cannot delete admin users' });
        }

        await User.findByIdAndDelete(userId);
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// Debug route to check users (remove in production)
router.get('/check-users', async (req, res) => {
    try {
        const users = await User.find({}, { username: 1, isAdmin: 1 });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        console.log('Login attempt for username:', username);
        
        const user = await User.findOne({ username });
        
        if (!user) {
            console.log('User not found:', username);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            console.log('Invalid password for user:', username);
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        req.session.userId = user._id;
        req.session.isAdmin = user.isAdmin;
        console.log('Login successful for:', username, 'isAdmin:', user.isAdmin);
        res.json({ 
            message: 'Login successful',
            isAdmin: user.isAdmin
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Logout
router.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ error: 'Logout failed' });
        }
        res.json({ message: 'Logged out successfully' });
    });
});

// Export users to PDF
router.get('/export-pdf', isAdmin, async (req, res) => {
    try {
        const users = await User.find({ isAdmin: false });
        const leaves = await Leave.find().populate('user', 'username');

        const doc = new PDFDocument();
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=users-report.pdf');
        doc.pipe(res);

        // Add title
        doc.fontSize(20).text('Leave Management System - Report', { align: 'center' });
        doc.moveDown();

        // Users section
        doc.fontSize(16).text('Users List');
        doc.moveDown();
        users.forEach(user => {
            doc.fontSize(12).text(`Username: ${user.username}`);
            doc.text(`Leave Balance: ${user.casualLeaveBalance} days`);
            doc.moveDown();
        });

        // Leave applications section
        doc.fontSize(16).text('Leave Applications');
        doc.moveDown();
        leaves.forEach(leave => {
            doc.fontSize(12).text(`User: ${leave.user.username}`);
            doc.text(`From: ${leave.startDate.toLocaleDateString()}`);
            doc.text(`To: ${leave.endDate.toLocaleDateString()}`);
            doc.text(`Status: ${leave.status}`);
            doc.text(`Reason: ${leave.reason}`);
            doc.moveDown();
        });

        doc.end();
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate PDF' });
    }
});

// Export to Excel
router.get('/export-excel', isAdmin, async (req, res) => {
    try {
        const users = await User.find({ isAdmin: false });
        const leaves = await Leave.find().populate('user', 'username');

        // Create workbook
        const wb = XLSX.utils.book_new();

        // Users worksheet
        const usersData = users.map(user => ({
            Username: user.username,
            'Leave Balance': user.casualLeaveBalance
        }));
        const usersWs = XLSX.utils.json_to_sheet(usersData);
        XLSX.utils.book_append_sheet(wb, usersWs, 'Users');

        // Leave applications worksheet
        const leavesData = leaves.map(leave => ({
            Username: leave.user.username,
            'Start Date': leave.startDate.toLocaleDateString(),
            'End Date': leave.endDate.toLocaleDateString(),
            Status: leave.status,
            Reason: leave.reason
        }));
        const leavesWs = XLSX.utils.json_to_sheet(leavesData);
        XLSX.utils.book_append_sheet(wb, leavesWs, 'Leave Applications');

        // Send file
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=leave-management-report.xlsx');
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        res.send(buf);
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate Excel file' });
    }
});

module.exports = router;