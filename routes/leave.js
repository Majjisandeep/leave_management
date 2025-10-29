const express = require('express');
const Leave = require('../models/leave');
const User = require('../models/user');
const router = express.Router();

// Middleware to check if user is authenticated
const isAuth = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Please login first' });
    }
    next();
};

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
    if (!req.session.isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

// Apply for leave
router.post('/apply', isAuth, async (req, res) => {
    try {
        const { startDate, endDate, reason } = req.body;
        
        // Convert dates to Date objects
        const start = new Date(startDate);
        const end = new Date(endDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Reset time to start of day
        
        // Validate dates
        if (start < today) {
            return res.status(400).json({ error: 'Start date cannot be in the past' });
        }
        
        if (end < start) {
            return res.status(400).json({ error: 'End date must be after start date' });
        }

        const leave = new Leave({
            user: req.session.userId,
            startDate: start,
            endDate: end,
            reason
        });
        await leave.save();
        res.json({ message: 'Leave application submitted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to submit leave application' });
    }
});

// Get user's leave history
router.get('/history', isAuth, async (req, res) => {
    try {
        const leaves = await Leave.find({ user: req.session.userId }).sort('-createdAt');
        res.json(leaves);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch leave history' });
    }
});

// Get leave balance
router.get('/balance', isAuth, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        res.json({ casualLeaveBalance: user.casualLeaveBalance });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch leave balance' });
    }
});

// Admin: Get all pending leaves
router.get('/pending', isAuth, isAdmin, async (req, res) => {
    try {
        const leaves = await Leave.find({ status: 'pending' })
            .populate('user', 'username')
            .sort('-createdAt');
        res.json(leaves);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch pending leaves' });
    }
});

// Admin: Approve/Reject leave
router.put('/:leaveId/status', isAuth, isAdmin, async (req, res) => {
    try {
        const { status } = req.body;
        const leave = await Leave.findById(req.params.leaveId);
        
        if (!leave) {
            return res.status(404).json({ error: 'Leave application not found' });
        }

        if (status === 'approved') {
            const user = await User.findById(leave.user);
            const days = Math.ceil((new Date(leave.endDate) - new Date(leave.startDate)) / (1000 * 60 * 60 * 24)) + 1;
            
            if (user.casualLeaveBalance < days) {
                return res.status(400).json({ error: 'Insufficient leave balance' });
            }
            
            user.casualLeaveBalance -= days;
            await user.save();
        }

        leave.status = status;
        await leave.save();
        res.json({ message: `Leave ${status} successfully` });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update leave status' });
    }
});

module.exports = router;