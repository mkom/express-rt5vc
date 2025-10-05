const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const House = require('../models/house');
const Transaction = require('../models/transaction');
const protect = require('./protect');
const checkRole = require('./checkRole');
const { format } = require('date-fns');
const moment = require('moment-timezone');
const { ObjectId } = mongoose.Types;

const cors = require('cors');
const corsOptions = {
    origin: ['https://rt5vc.vercel.app', 'http://localhost:3000'],
    methods: 'GET, POST, PUT, DELETE, OPTIONS',
    allowedHeaders: 'Content-Type, Authorization',
    credentials: true,
};

// Apply CORS to all routes in this router
router.use(cors(corsOptions));

// Helper function to process proof_of_transfer and attachments
function processProofOfTransfer(proof_of_transfer) {
    if (!proof_of_transfer) return null;
    
    // If it's already a string, return as is
    if (typeof proof_of_transfer === 'string') {
        return proof_of_transfer;
    }
    
    // If it's an array, join with comma separator
    if (Array.isArray(proof_of_transfer)) {
        return proof_of_transfer.join(',');
    }
    
    return proof_of_transfer;
}

function processAttachments(attachments) {
    if (!attachments) return [];
    
    // If it's already an array of objects with proper structure, return as is
    if (Array.isArray(attachments) && attachments.length > 0 && typeof attachments[0] === 'object' && attachments[0].attachment_url) {
        return attachments;
    }
    
    // If it's a single string, convert to array format
    if (typeof attachments === 'string') {
        return [{ attachment_url: attachments }];
    }
    
    // If it's an array of strings, convert to proper attachment format
    if (Array.isArray(attachments) && typeof attachments[0] === 'string') {
        return attachments.map(url => ({ attachment_url: url }));
    }
    
    return attachments;
}

// Helper function to parse proof_of_transfer back to array for response
function parseProofOfTransferToArray(proof_of_transfer) {
    if (!proof_of_transfer) return [];
    
    if (typeof proof_of_transfer === 'string') {
        // Split by comma and trim whitespace
        return proof_of_transfer.split(',').map(url => url.trim()).filter(url => url.length > 0);
    }
    
    return Array.isArray(proof_of_transfer) ? proof_of_transfer : [proof_of_transfer];
}

// Create a new transaction
router.post('/create', protect, checkRole(['user','admin', 'editor','superadmin']), async (req, res) => {
    const { houseId, whatsapp_notification, transaction_category, additional_note_mutasi_bca, attachments, transaction_type, payment_type, amount, description, proof_of_transfer, attachment, related_months,status,paymentDate  } = req.body;
    const created_by = req.user ? req.user._id : null;

    if (!created_by) {
        return res.status(400).json({ error: 'User not authenticated or invalid user ID' });
    }
    
    try {
         // Validate `related_months`
        if (related_months && !Array.isArray(related_months)) {
            return res
            .status(400)
            .json({ error: 'related_months should be an array' });
        }

        // Process proof_of_transfer and attachments
        const processedProofOfTransfer = processProofOfTransfer(proof_of_transfer);
        const processedAttachments = processAttachments(attachments);

        let transaction;
        
        if(houseId) {
            const house = await House.findOne({ house_id: houseId });
            // Create transaction with house reference
            transaction = new Transaction({
                house_id: house._id,
                transaction_type,
                payment_type,
                amount,
                description,
                additional_note_mutasi_bca,
                proof_of_transfer: processedProofOfTransfer,
                related_months,
                created_by,
                status: status, // Default status
                date: moment.tz(paymentDate, 'Asia/Jakarta').toDate(),
                attachments: processedAttachments,
                whatsapp_notification,
                transaction_category,
            });

            await transaction.save();

            // Update the related monthly bills
            if (related_months && status == 'berhasil') {
                for (const month of related_months) {
                    const feeIndex = house.monthly_fees.findIndex(
                        (fee) => fee.month === month
                    );

                    if (feeIndex !== -1) {
                        // Update existing monthly fee
                        house.monthly_fees[feeIndex].status = 'Lunas';
                        house.monthly_fees[feeIndex].transaction_id = transaction._id;
                    } else {
                        // Add new monthly fee
                        house.monthly_fees.push({
                        month,
                        status: 'Lunas',
                        transaction_id: transaction._id,
                        });
                    }
                }
            }
            

            await house.save();
            
        } else {
            transaction = new Transaction({
                transaction_type,
                payment_type,
                amount,
                description,
                additional_note_mutasi_bca,
                proof_of_transfer: processedProofOfTransfer,
                attachment,
                created_by,
                status: status,
                date: moment.tz(paymentDate, 'Asia/Jakarta').toDate(),
                attachments: processedAttachments,
                transaction_category,
            });
    
            await transaction.save();
        }

        await transaction.populate('created_by', 'email'); 
        
        // Respond with transaction data, including user's email
        res.status(201).json({
            transaction_id: transaction.transaction_id,
            created_by: transaction.created_by[0].email,
            created_at: transaction.created_at,
            amount: transaction.amount,
            description: transaction.description,
            date: transaction.date,
            status: transaction.status,
            category: transaction.transaction_category,
            proof_of_transfer: parseProofOfTransferToArray(transaction.proof_of_transfer),
            attachments: transaction.attachments,
        });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Update an existing transaction
router.put('/update/:id', protect, checkRole(['admin', 'editor', 'superadmin']), async (req, res) => {
    const { houseId, reason_cancellation,transaction_category, additional_note_mutasi_bca, attachment, transaction_type, payment_type, amount, description, proof_of_transfer, related_months,status,paymentDate, attachments  } = req.body;
  
    try {
      let transaction = await Transaction.findById(req.params.id);
      if (!transaction) {
        return res.status(404).json({ message: 'Transaction not found' });
      }

      const house = await House.findOne({ house_id: houseId });

      // Process proof_of_transfer and attachments
      const processedProofOfTransfer = processProofOfTransfer(proof_of_transfer);
      const processedAttachments = processAttachments(attachments);

      // Update transaction fields based on whether house is found
      transaction.house_id = house ? house._id : transaction.house_id;
      transaction.transaction_type = transaction_type;
      transaction.payment_type = payment_type;
      transaction.amount = amount;
      transaction.description = description;
      transaction.additional_note_mutasi_bca = additional_note_mutasi_bca;
      transaction.proof_of_transfer = processedProofOfTransfer;
      transaction.related_months = related_months;
      transaction.status = status;
      transaction.reason_cancellation = reason_cancellation;
      transaction.transaction_category = transaction_category;
      transaction.date = moment.tz(paymentDate, 'Asia/Jakarta').toDate();
      transaction.attachments = processedAttachments;

        // Update the single attachment if provided
        if (attachment) {
            transaction.attachment = {
                attachment_title: attachment.attachment_title,
                attachment_url: attachment.attachment_url
            };
        }

        // Update `house.monthly_fees` if related_months is provided and status is "berhasil"
        if (house && related_months && Array.isArray(related_months) && status === 'berhasil') {
            for (const month of related_months) {
                const feeIndex = house.monthly_fees.findIndex((fee) => fee.month === month);

                if (feeIndex !== -1) {
                    // Update existing monthly fee
                    house.monthly_fees[feeIndex].status = 'Lunas';
                    house.monthly_fees[feeIndex].transaction_id = transaction._id;
                } else {
                    // Add new monthly fee
                    house.monthly_fees.push({
                        month,
                        status: 'Lunas',
                        transaction_id: transaction._id,
                    });
                }
            }

            await house.save();
        }

      await transaction.save();
      await transaction.populate([
        { path: 'created_by', select: 'email name whatsapp_number' },
        { path: 'house_id', select: 'house_id' }
      ]);

      res.status(201).json({
        transaction_id: transaction.transaction_id,
        created_by: {
            email: transaction.created_by[0].email,
            name: transaction.created_by[0].name,
            whatsapp_number: transaction.created_by[0].whatsapp_number,
        },
        created_at: transaction.created_at,
        amount: transaction.amount,
        description: transaction.description,
        date: transaction.date,
        status: transaction.status,
        category: transaction.transaction_category,
        additional_note: transaction.reason_cancellation ? transaction.reason_cancellation : null,
        whatsapp_notification: transaction.whatsapp_notification,
        house: transaction.house_id,
        proof_of_transfer: parseProofOfTransferToArray(transaction.proof_of_transfer),
        attachments: transaction.attachments,
    });
    
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server error');
    }
});

// Route untuk menghapus transaksi
router.delete('/delete/:id', protect, checkRole(['admin', 'editor', 'superadmin']), async (req, res) => {
    try {
      const transaction = await Transaction.findById(req.params.id);
      if (!transaction) {
        return res.status(404).json({ message: 'Transaksi tidak ditemukan' });
      }
  
      // Cek jika transaksi terkait dengan house
      if (transaction.house_id) {
        const house = await House.findById(transaction.house_id);

        // Update the related monthly bills
        for (const month of transaction.related_months) {
            let  feeIndex = house.monthly_fees.findIndex(fee => fee.month === month);

            if (feeIndex !== -1) {
                // Update existing monthly fee
                house.monthly_fees[feeIndex].status = 'Belum Bayar';
                house.monthly_fees[feeIndex].transaction_id = null;
            } 

            await house.save();
        }
      }
  
      // Hapus transaksi
      await transaction.deleteOne();
  
      res.status(200).json({ message: 'Transaksi berhasil dihapus' });
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server error');
    }
});

// Route to get all transactions
router.get('/all', async (req, res) => {
    try {
        const transactions = await Transaction.find({})
        .populate([
            { path: 'created_by', select: 'email name whatsapp_number' },
            { path: 'house_id', select: 'house_id' }
          ])
        .sort({ created_at: -1 })
        .select({ description: 1, related_months:1, created_by:1, house_id:1, additional_note_mutasi_bca:1, date: 1, created_at: 1, amount: 1,transaction_type:1,payment_type:1,status:1,proof_of_transfer:1,attachment:1,attachments:1 });
        
        // Transform proof_of_transfer for consistent response
        const transformedTransactions = transactions.map(transaction => ({
            ...transaction._doc,
            proof_of_transfer: parseProofOfTransferToArray(transaction.proof_of_transfer)
        }));

        return res.status(200).json({
            status: 200,
            message: 'Success',
            lastUpdate: transactions[0]?.created_at,
            data: {
                transactions: transformedTransactions,
            }
        });
        
    } catch (err) {
        console.error(err.message);
        res.status(500).json({
            status: 500,
            message: err.message 
        });
    }
});


router.get('/filter', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        // Validasi tanggal
        if (!startDate || !endDate) {
            return res.status(400).json({ message: 'Both startDate and endDate are required' });
        }

        const transactions = await Transaction.find({
            date: {
                $gte: new Date(startDate),
                $lte: new Date(endDate),
            },
            description: { $not: /#IPLPaguyuban/i },
        })
        .populate('created_at')
        .sort({ created_at: -1 })
        .select({ description: 1, additional_note_mutasi_bca:1, date: 1, created_at: 1, amount: 1,transaction_type:1,payment_type:1,status:1 });

        return res.status(200).json({
            status: 200,
            message: 'Suscess',
            data: {
                transactions: transactions,
            }
        });
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({
            status: 500,
            message: err.message 
        });
    }
});

router.get('/balance', async (req, res) => {
    try {
        const incomeTransactions = await Transaction.aggregate([
            { $match: { transaction_type: { $in: ['income', 'ipl'] } } },
            { $group: { _id: null, totalIncome: { $sum: "$amount" } } }
        ]);

        const expenseTransactions = await Transaction.aggregate([
            { $match: { transaction_type: 'expense' } },
            { $group: { _id: null, totalExpense: { $sum: "$amount" } } }
        ]);

        const iplPaguyabanTransactions = await Transaction.aggregate([
            { $match: { description: /#IPLPaguyuban/i } },
            { $group: { _id: null, totalIPlPaguyuban: { $sum: "$amount" } } }
        ]);

        const totalIncome = incomeTransactions[0]?.totalIncome || 0;
        const totalExpense = expenseTransactions[0]?.totalExpense || 0;
        const totalIPlPaguyuban = iplPaguyabanTransactions[0]?.totalIPlPaguyuban || 0;
        const totalBalance = totalIncome - totalExpense;

        return res.json({
            status: 200,
            message: 'suscess',
            data: {
                totalIncome,
                totalExpense,
                totalBalance,
                totalIPlPaguyuban,
            }
        });

    } catch (error) {
        console.error('Error calculating total balance:', error);
        res.status(500).json({
            status: 500,
            message: 'Error calculating total balance' 
        });
    }
});

router.get('/balance-monthly', async (req, res) => {
    const { period } = req.query;

    if (!period) {
        return res.status(400).json({ error: 'Period is required' });
    }

    const [year, month] = period.split('-');

    if (!year || !month) {
        return res.status(400).json({ error: 'Invalid period format' });
    }

    try {
        const startDate = new Date(`${year}-${month}-01T00:00:00Z`);
        const endDate = new Date(startDate);
        endDate.setMonth(startDate.getMonth() + 1);

        const monthlyBalances = await Transaction.aggregate([
            {
                $match: {
                    date: {
                        $gte: startDate,
                        $lt: endDate
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    totalIncome: {
                        $sum: {
                            $cond: [{ $in: ["$transaction_type", ["income", "ipl"]] }, "$amount", 0]
                        }
                    },
                    totalExpense: {
                        $sum: {
                            $cond: [{ $eq: ["$transaction_type", "expense"] }, "$amount", 0]
                        }
                    }
                }
            },
            {
                $project: {
                    totalIncome: 1,
                    totalExpense: 1,
                    totalBalance: { $subtract: ["$totalIncome", "$totalExpense"] }
                }
            }
        ]);

        return res.json({
            status: 200,
            message: 'suscess',
            monthlyBalances,
        });

    } catch (error) {
        console.error('Error calculating monthly total balance:', error);
        res.status(500).json({
            status: 500,
            message: 'Error calculating monthly total balance' 
        });
    }
});

router.get('/:id', async (req, res) => {
    try {
      const transaction = await Transaction.findById(req.params.id)
        .populate('created_by')
        .populate('house_id');
  
      if (!transaction) {
        return res.status(404).json({ message: 'Transaksi tidak ditemukan' });
      }
  
      const formattedTransaction = {
        ...transaction._doc,
        date: transaction.date,
        created_at: transaction.created_at,
        proof_of_transfer: parseProofOfTransferToArray(transaction.proof_of_transfer)
      };
  
      res.status(200).json(formattedTransaction);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server error');
    }
});

module.exports = router;
