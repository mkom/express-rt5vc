const express = require('express');
const User = require('../models/user');
const protect = require('./protect');
const checkRole = require('./checkRole');
const jwt = require('jsonwebtoken');
const router = express.Router();
const mongoose = require('mongoose');
const Transaction = require('../models/transaction');
// Route to list users
router.get('/list', protect, checkRole(['user','admin', 'editor','superadmin']), async (req, res) => {
    try {
        const users = await User.find().select('-password'); // Exclude passwords from the response
        return res.status(200).json({
            status: 200,
            message: 'suscess',
            data: users
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({
            status: 500,
            message: err.message 
        });
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
        
        res.status(200).json({
            status: 200,
            message: 'suscess',
            data: user
        });
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

router.put('/update/:id', protect, checkRole(['user','admin', 'editor','superadmin']), async (req, res) => {
    const { email, username, name, whatsapp_number, password , role, house_id  } = req.body;

    try {
        const user = await User.findById(req.params.id);
        
        if (!user) {
            return res.status(404).json({ status: 404, message: 'User not found' });
        }

        user.email = email || user.email;
        user.username = username || user.username;
        user.name = name || user.name;
        user.whatsapp_number = whatsapp_number || user.whatsapp_number;
        user.password = password || user.password;
        user.role = role || user.role;
        user.house_id = house_id || user.house_id;

        await user.save();
        res.status(201).json({
            status: 201, 
            message: 'Success', 
            // data: user
        });
    } catch (err) {
        console.error(err.message);
        //res.status(500).send('Server error');
        res.status(500).json({
            status: 500,
            message: err.message 
        });
    }
});

router.get('/transaction/:userId', async (req, res) => {
    const { userId } = req.params;

     // Check if userId is a valid 24-character hex string
     if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: 'Invalid userId format' });
    }

    // Convert userId to ObjectId
    const userObjectId = new mongoose.Types.ObjectId(userId);
   
    try {
       // console.log(userObjectId);  // Check if it's correctly converted

        const transaction = await Transaction.find({
            created_by: userObjectId, // Filter by userId in created_by array
            description: { $not: /#IPLPaguyuban/i }
        })
        .populate({
            path: 'house_id', // Reference to house_id in the Transaction schema
            select: 'house_id', // Only select house_id field from House collection
        })
        .sort({ created_at: -1 })
        .select({
            description: 1,
            created_by: 1,
            additional_note_mutasi_bca: 1,
            date: 1,
            created_at: 1,
            amount: 1,
            transaction_type: 1,
            payment_type: 1,
            status: 1,
            proof_of_transfer: 1,
            attachment: 1,
            transaction_id:1,
            house_id:1,
            related_months:1
        });

        if (!transaction || transaction.length === 0) {
            return res.status(404).json({ message: 'Transaksi tidak ditemukan' });
        }

        return res.status(200).json({
            status: 200,
            message: 'Success',
            data: transaction
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).json({
            status: 500,
            message: err.message
        });
    }
});


module.exports = router;
