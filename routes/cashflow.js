const express = require('express');
const House = require('../models/house');
const Transaction = require('../models/transaction');
const router = express.Router();
const { format } = require('date-fns');
const moment = require('moment-timezone');

const cors = require('cors');
const corsOptions = {
    origin: ['https://rt5vc.vercel.app', 'http://localhost:3000'],
    methods: 'GET',
    allowedHeaders: 'Content-Type, Authorization',
    credentials: true,
};

router.use(cors(corsOptions));
router.get('/', async (req, res) => {
    try {
        const transactions = await Transaction.find({
            description: { $not: /#IPLPaguyuban/i },
             status: 'berhasil'
        })
        .populate('created_at')
        .sort({ created_at: -1 })
        .select({ description: 1, additional_note_mutasi_bca:1, date: 1, created_at: 1, amount: 1,transaction_type:1,payment_type:1,status:1,proof_of_transfer:1,attachment:1 });
        
        // const formattedTransactions = transactions.map(transaction => ({
        //     ...transaction._doc,
        //     date: format(new Date(transaction.date), 'dd MMM yyyy'),
        //     created_at: format(new Date(transaction.created_at), 'dd MMM yyyy HH:mm:ss')
        // }));

        return res.status(200).json({
            status: 200,
            message: 'Suscess',
            // lastUpdate: format(transactions[0].created_at, 'dd MMM yyyy HH:mm'),
            lastUpdate: transactions[0].created_at,
            data: {
                transactions: transactions,
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


module.exports = router;