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
    const {period, status, group} = req.query; 

    const matchConditions = {};
    if (period) {
        matchConditions['monthly_fees.month'] = period;
    }
    if (status) {
        matchConditions['monthly_fees.status'] = status;
    }
    if (group) {
        matchConditions['group'] = group;
    }
 
    matchConditions['mandatory_fee'] = true;

    const [year, month] = period.split('-'); // Memisahkan tahun dan bulan

    const startDate = new Date(`${year}-${month}-01T00:00:00Z`);
    const endDate = new Date(startDate);
    endDate.setMonth(startDate.getMonth() + 1);
    
    try {
        //total keseluruhan
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


        const total_income = incomeTransactions[0]?.totalIncome || 0;
        const total_expense = expenseTransactions[0]?.totalExpense || 0;
        const totalIPlPaguyuban = iplPaguyabanTransactions[0]?.totalIPlPaguyuban || 0;
        const totalBalance = total_income - total_expense;

        //transactions
        // const transactions = await Transaction.find({
        //     date: {
        //         $gte: startDate,
        //         $lt: endDate
        //     },
        //     description: { $not: /#IPLPaguyuban/i }
        // })
        // .select({ description: 1, date: 1, created_at: 1, amount: 1,transaction_type:1 })
        // .populate('date')
        // .sort({ date: -1 })
        
        const transactions = await Transaction.aggregate([
            {
                $match: {
                date: {
                    $gte: startDate,
                    $lt: endDate
                },
                description: { $not: /#IPLPaguyuban/i }
                }
            },
            {
                $facet: {
                income: [
                    { $match: { transaction_type: 'income' } },
                    { $group: { _id: null, totalAmount: { $sum: "$amount" }, transactions: { $push: "$$ROOT" } } },
                    { $sort: { date: -1 } }
                ],
                expense: [
                    { $match: { transaction_type: 'expense' } },
                    { $group: { _id: null, totalAmount: { $sum: "$amount" }, transactions: { $push: "$$ROOT" } } },
                    { $sort: { date: -1 } }
                ],
                ipl: [
                    { $match: { transaction_type: 'ipl' } },
                    { $group: { _id: null, totalAmount: { $sum: "$amount" }, transactions: { $push: "$$ROOT" } } },
                    { $sort: { date: -1 } }
                ]
                }
            }
        ]);
          
       
       // Calculate the period range
       const selectedMonth = moment(period, 'YYYY-MM');
       const startMonth = selectedMonth.clone().subtract(2, 'months'); // Start from July if September is selected
       const endMonth = selectedMonth.endOf('month'); // End in the selected month

       let prevPeriodBalance = 0; // Initial balance for the first month (July)
       let selectedMonthData = null; // This will hold the data for the selected period

       for (let m = startMonth.clone(); m.isSameOrBefore(endMonth, 'month'); m.add(1, 'month')) {
        const monthStartDate = m.startOf('month').toDate();
        const monthEndDate = m.endOf('month').toDate();

        // Aggregate income and expense for the current month
        const monthlyBalances = await Transaction.aggregate([
            {
                $match: {
                    date: {
                        $gte: monthStartDate,
                        $lt: monthEndDate,
                    },
                    description: { $not: /#IPLPaguyuban/i },
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
            }
        ]);

        const income = monthlyBalances[0]?.totalIncome || 0;
        const expense = monthlyBalances[0]?.totalExpense || 0;
        const closingBalance = prevPeriodBalance + income - expense; // Calculate closing balance for this month

        // If it's the selected period, store the data
        if (m.isSame(selectedMonth, 'month')) {
            selectedMonthData = {
                month: m.format('YYYY-MM'), // e.g., September
                opening_balance: prevPeriodBalance,
                income,
                expense,
                closing_balance: closingBalance
            };
        }

        // Update the previous period balance for the next iteration
        prevPeriodBalance = closingBalance;
    }

    // Return only the data for the selected period
    if (!selectedMonthData) {
        return res.status(404).json({
            status: 404,
            message: 'Data not found for the selected period'
        });
    }

    const incomeTrx = transactions[0]?.income?.[0]?.transactions || [];
    const totalIncome = transactions[0]?.income?.[0]?.totalAmount || 0;

    const expenseTrx= transactions[0]?.expense?.[0]?.transactions || [];
    const totalExpense = transactions[0]?.expense?.[0]?.totalAmount || 0;

    const iplTrx = transactions[0]?.ipl?.[0]?.transactions || [];
    const totalIpl = transactions[0]?.ipl?.[0]?.totalAmount || 0;

    const formattedIncomeTransactions = incomeTrx
    .filter(transaction => transaction != null)
    .map(transaction => ({
        ...transaction._doc,
        date: format(new Date(transaction.date), 'dd MMM yyyy'),
        created_at: format(new Date(transaction.created_at), 'dd MMM yyyy HH:mm:ss'),
        description: transaction.description,
        amount: transaction.amount,
        transaction_type: transaction.transaction_type,
    }))
    .sort((a, b) => new Date(b.date) - new Date(a.date)) 
    .slice(0, 5);
    
    const formattedExpenseTransactions = expenseTrx
    .filter(transaction => transaction != null)
    .map(transaction => ({
        ...transaction._doc,
        date: format(new Date(transaction.date), 'dd MMM yyyy'),
        created_at: format(new Date(transaction.created_at), 'dd MMM yyyy HH:mm:ss'),
        description: transaction.description,
        amount: transaction.amount,
        transaction_type: transaction.transaction_type,
    }))
    .sort((a, b) => new Date(b.date) - new Date(a.date)) 
    .slice(0, 5);
    
    const formattedIplTransactions = iplTrx
    .filter(transaction => transaction != null)
    .map(transaction => ({
        ...transaction._doc,
        date: format(new Date(transaction.date), 'dd MMM yyyy'),
        created_at: format(new Date(transaction.created_at), 'dd MMM yyyy HH:mm:ss'),
        description: transaction.description,
        amount: transaction.amount,
        transaction_type: transaction.transaction_type,
    }))
    .sort((a, b) => new Date(b.date) - new Date(a.date)) 
    .slice(0, 5);

    return res.json({
        status: 200, 
        message: 'Success', 
        data: { 
            balance: {
                final_balance: totalBalance - totalIPlPaguyuban,
                total_income: total_income - totalIPlPaguyuban,
                total_expense,
            },
            monthlyData: [selectedMonthData],
            transactions: {
                income: formattedIncomeTransactions,
                expense: formattedExpenseTransactions,
                ipl: formattedIplTransactions,
                totalIncome: totalIncome,
                totalExpense: totalExpense,
                totalIpl: totalIpl,
                   
            }
            
        }
    });


    } catch(err){
        console.error(err.message);
        res.status(500).json({
            status: 500,
            message: err.message 
        });
    }

});

module.exports = router;