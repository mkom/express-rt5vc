const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const House = require('../models/house');
const Transaction = require('../models/transaction');
const protect = require('./protect');
const checkRole = require('./checkRole');
const { format } = require('date-fns');

// Create a new transaction
router.post('/create', protect, checkRole(['admin', 'editor','superadmin']), async (req, res) => {
    const { houseId, transaction_type, amount, description, proof_of_transfer, related_months,status,paymentDate  } = req.body;
    const created_by = req.user._id;
    try {
        // Find the house

        //const houseId = req.body.houseId;
       // console.log('houseId:', houseId);
        const house = await House.findOne({ house_id: houseId });
        //console.log(house)
        if(transaction_type !== 'ipl') {
            const transaction = new Transaction({
                transaction_type,
                amount,
                description,
                proof_of_transfer,
                created_by,
                status,
                date:paymentDate
            });
    
            await transaction.save();

            res.status(201).json(transaction);
        }

        if (transaction_type === 'ipl'){

            if (!house) {
                throw new Error('House not found');
            }

           // console.log(related_months);

            if (!Array.isArray(related_months)) {
                throw new Error('elatedMonths should be an array');
                //return res.status(400).json({ msg: 'relatedMonths should be an array' });
            }

            // Create a new transaction
            const transaction = new Transaction({
                house_id: house._id,
                transaction_type,
                amount,
                description,
                proof_of_transfer,
                related_months,
                created_by,
                status,
                date:paymentDate
            });

            await transaction.save();

            // Update the related monthly bills
            for (const month of related_months) {
                let  feeIndex = house.monthly_fees.findIndex(fee => fee.month === month);

                if (feeIndex !== -1) {
                    // Update existing monthly fee
                    house.monthly_fees[feeIndex].status = 'Lunas';
                    house.monthly_fees[feeIndex].transaction_id = transaction._id;
                } else {
                    // Add new monthly fee
                    house.monthly_fees.push({
                        month,
                        fee: house.fee, // Use the fee from the house
                        status: 'Lunas',
                        transaction_id: transaction._id
                    });
                }
            }
            await house.save();

            res.status(201).json(transaction);
        }
        

        
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Update an existing transaction
router.put('/update/:id', protect, checkRole(['admin', 'editor', 'superadmin']), async (req, res) => {
    const { house_id, transaction_type, amount, description, proof_of_transfer, related_months, status } = req.body;
  
    try {
      let transaction = await Transaction.findById(req.params.id);
      if (!transaction) {
        return res.status(404).json({ msg: 'Transaction not found' });
      }
  
      transaction.house_id = house_id;
      transaction.transaction_type = transaction_type;
      transaction.amount = amount;
      transaction.description = description;
      transaction.proof_of_transfer = proof_of_transfer;
      transaction.related_months = related_months;
      transaction.status = status;
  
      await transaction.save();
      res.status(200).json(transaction);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server error');
    }
});


// Route to get all transactions
router.get('/all', async (req, res) => {
    try {
      const transactions = await Transaction.find()
      .populate('created_by')
      .sort({ created_at: -1 }); // Mengurutkan berdasarkan tanggal terbaru
      ;
      const formattedTransactions = transactions.map(transaction => ({
        ...transaction._doc,
        date: format(new Date(transaction.date), 'dd MMM yyyy'),
        created_at: format(new Date(transaction.created_at), 'dd MMM yyyy HH:mm:ss')
      }));
      res.status(200).json(formattedTransactions);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server error');
    }
});

module.exports = router;
