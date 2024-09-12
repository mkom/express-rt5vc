const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const House = require('../models/house');
const Transaction = require('../models/transaction');
const protect = require('./protect');
const checkRole = require('./checkRole');
const { format } = require('date-fns');
const moment = require('moment-timezone');

const cors = require('cors');
const corsOptions = {
    origin: ['https://rt5vc.vercel.app', 'http://localhost:3000'],
    methods: 'GET, POST, PUT, DELETE, OPTIONS',
    allowedHeaders: 'Content-Type, Authorization',
    credentials: true,
};

// Apply CORS to all routes in this router
router.use(cors(corsOptions));

// Create a new transaction
router.post('/create', protect, checkRole(['admin', 'editor','superadmin']), async (req, res) => {
    const { houseId, additional_note_mutasi_bca, transaction_type, payment_type, amount, description, proof_of_transfer, related_months,status,paymentDate  } = req.body;
    const created_by = req.user._id;
    try {
        // Find the house

        //const houseId = req.body.houseId;
       // console.log('houseId:', houseId);
        const house = await House.findOne({ house_id: houseId });
        //console.log(house)
        if(!house) {
            const transaction = new Transaction({
                transaction_type,
                payment_type,
                amount,
                description,
                additional_note_mutasi_bca,
                proof_of_transfer,
                created_by,
                status,
                date:moment.tz(paymentDate, 'Asia/Jakarta').format('YYYY-MM-DD HH:mm:ss')
            });
    
            await transaction.save();

            res.status(201).json(transaction);
        }

        if (house){

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
                payment_type,
                amount,
                description,
                additional_note_mutasi_bca,
                proof_of_transfer,
                related_months,
                created_by,
                status,
                date:moment.tz(paymentDate, 'Asia/Jakarta').format('YYYY-MM-DD HH:mm:ss')
            });

            await transaction.save();

            // Update the related monthly bills
            //console.log(related_months)
            if(related_months) {
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
                            //fee: house.fee, // Use the fee from the house
                            status: 'Lunas',
                            transaction_id: transaction._id
                        });
                    }
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
    const { houseId, additional_note_mutasi_bca, transaction_type, payment_type, amount, description, proof_of_transfer, related_months,status,paymentDate  } = req.body;
  
    try {
      let transaction = await Transaction.findById(req.params.id);
      if (!transaction) {
        return res.status(404).json({ message: 'Transaction not found' });
      }

      const house = await House.findOne({ house_id: houseId });

      if(house) {
        transaction.house_id = house._id;
        transaction.transaction_type = transaction_type;
        transaction.payment_type = payment_type;
        transaction.amount = amount;
        transaction.description = description;
        transaction.additional_note_mutasi_bca = additional_note_mutasi_bca;
        transaction.proof_of_transfer = proof_of_transfer;
        transaction.related_months = related_months;
        transaction.status = status;
        transaction.date=moment.tz(paymentDate, 'Asia/Jakarta').format('YYYY-MM-DD HH:mm:ss')
      } else {
        transaction.transaction_type = transaction_type;
        transaction.payment_type = payment_type;
        transaction.amount = amount;
        transaction.description = description;
        transaction.additional_note_mutasi_bca = additional_note_mutasi_bca;
        transaction.proof_of_transfer = proof_of_transfer;
        transaction.related_months = related_months;
        transaction.status = status;
        transaction.date=moment.tz(paymentDate, 'Asia/Jakarta').format('YYYY-MM-DD HH:mm:ss')
      }
  
      
  
      await transaction.save();
      res.status(200).json(transaction);
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
        // if (house) {
        //   // Hapus transaksi dari house
        //   house.monthly_fees = house.monthly_fees.map(fee => {
        //     if (fee.transaction_id === transaction._id) {
        //       fee.status = 'Belum Bayar';
        //       fee.transaction_id = null;
        //     }
        //     return fee;
        //   });
        //   await house.save();
        // }

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
        const transactions = await Transaction.find({
            description: { $not: /#IPLPaguyuban/i }
        })
        .populate('created_at')
        .sort({ created_at: -1 })
        .select({ description: 1, additional_note_mutasi_bca:1, date: 1, created_at: 1, amount: 1,transaction_type:1,payment_type:1,status:1 });
        
        // const formattedTransactions = transactions.map(transaction => ({
        //     ...transaction._doc,
        //     date: format(new Date(transaction.date), 'dd MMM yyyy'),
        //     created_at: format(new Date(transaction.created_at), 'dd MMM yyyy HH:mm:ss')
        // }));

        return res.status(200).json({
            status: 200,
            message: 'Suscess',
            lastUpdate: format(transactions[0].created_at, 'dd MMM yyyy HH:mm'),
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

        // const formattedTransactions = transactions.map(transaction => ({
        //     ...transaction._doc,
        //     date: format(new Date(transaction.date), 'dd MMM yyyy'),
        //     created_at: format(new Date(transaction.created_at), 'dd MMM yyyy HH:mm:ss')
        //   }));

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

        //res.json({ totalIncome, totalExpense, totalBalance, totalIPlPaguyuban });

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
    const { period } = req.query; // Mengambil parameter period

    if (!period) {
        return res.status(400).json({ error: 'Period is required' });
    }

    const [year, month] = period.split('-'); // Memisahkan tahun dan bulan

    if (!year || !month) {
        return res.status(400).json({ error: 'Invalid period format' });
    }

    try {
        // Menghasilkan tanggal mulai dari periode yang diberikan
        const startDate = new Date(`${year}-${month}-01T00:00:00Z`);
        // Menghasilkan tanggal akhir, yaitu awal bulan berikutnya
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

       // res.json(monthlyBalances.length > 0 ? monthlyBalances : [{ totalIncome: 0, totalExpense: 0, totalBalance: 0 }]);

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
        date: format(new Date(transaction.date), 'dd MMM yyyy'),
        created_at: format(new Date(transaction.created_at), 'dd MMM yyyy HH:mm:ss')
      };
  
      res.status(200).json(formattedTransaction);
    } catch (err) {
      console.error(err.message);
      res.status(500).send('Server error');
    }
});


module.exports = router;
