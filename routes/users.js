const express = require('express');
const User = require('../models/user');
const protect = require('./protect');
const checkRole = require('./checkRole');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Route to list users
router.get('/list', protect, checkRole(['admin', 'editor']), async (req, res) => {
    try {
        const users = await User.find().select('-password'); // Exclude passwords from the response
        res.status(200).json(users);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

router.get('/me', async (req, res) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const token = authHeader.split(' ')[1];
    
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        const user = await User.findById(decoded.id);
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json(user);
    } catch (error) {
        console.error('JWT Verification Error:', error.message);
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token' });
        } else if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired' });
        } else {
            return res.status(401).json({ error: 'Unauthorized' });
        }
    }
});

module.exports = router;
