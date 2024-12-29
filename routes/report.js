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
    const { period, status, group } = req.query;

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

    const [year, month] = period.split('-');
    const startDate = new Date(`${year}-${month}-01T00:00:00Z`);
    const endDate = new Date(startDate);
    endDate.setMonth(startDate.getMonth() + 1);

    try {
        // Menghitung total keseluruhan
        const incomeTransactions = await Transaction.aggregate([
            { $match: { transaction_type: { $in: ['income', 'ipl'] },status: 'berhasil' }  },
            { $group: { _id: null, totalIncome: { $sum: "$amount" } } }
        ]);

        const expenseTransactions = await Transaction.aggregate([
            { $match: { transaction_type: 'expense',status: 'berhasil'  } },
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

        // Mengambil transaksi
        const transactions = await Transaction.aggregate([
            {
                $match: {
                    date: {
                        $gte: startDate,
                        $lt: endDate
                    },
                    description: { $not: /#IPLPaguyuban/i },
                    status: 'berhasil' 
                }
            },
            {
                $facet: {
                    income: [
                        { $match: { transaction_type: 'income', status: 'berhasil' } },
                        { $group: { _id: null, totalAmount: { $sum: "$amount" }, transactions: { $push: "$$ROOT" } } },
                        { $sort: { date: -1 } }
                    ],
                    expense: [
                        { $match: { transaction_type: 'expense', status: 'berhasil' } },
                        { $group: { _id: null, totalAmount: { $sum: "$amount" }, transactions: { $push: "$$ROOT" } } },
                        { $sort: { date: -1 } }
                    ],
                    ipl: [
                        { $match: { transaction_type: 'ipl', status: 'berhasil' } },
                        { $group: { _id: null, totalAmount: { $sum: "$amount" }, transactions: { $push: "$$ROOT" } } },
                        { $sort: { date: -1 } }
                    ]
                }
            }
        ]);

        //monthlyBalances 
        const selectedMonth = moment(period, 'YYYY-MM');
        const startMonth = moment('2024-07-01'); // Starting from July 2024
        const endMonth = selectedMonth.clone().endOf('month');

        let monthlyBalances = [];
        for (let m = startMonth.clone(); m.isSameOrBefore(endMonth, 'month'); m.add(1, 'month')) {
            const monthStartDate = m.startOf('month').toDate();
            const monthEndDate = m.endOf('month').toDate();

            const transactions = await Transaction.aggregate([
                {
                    $match: {
                        date: { $gte: monthStartDate, $lte: monthEndDate },
                        description: { $not: /#IPLPaguyuban/i },
                        status: 'berhasil' 
                    }
                },
                {
                    $group: {
                        _id: null,
                        income: {
                            $sum: {
                                $cond: [{ $in: ["$transaction_type", ["income", "ipl"]] }, "$amount", 0]
                            }
                        },
                        expense: {
                            $sum: {
                                $cond: [{ $eq: ["$transaction_type", "expense"] }, "$amount", 0]
                            }
                        }
                    }
                }
            ]);

            const income = transactions[0]?.income || 0;
            const expense = transactions[0]?.expense || 0;

            monthlyBalances.push({
                month: m.format('YYYY-MM'),
                income,
                expense
            });
        }

        // Assuming `period` is defined as the selected month in 'YYYY-MM' format
        const selectedMonthFormatted = moment(period, 'YYYY-MM').format('YYYY-MM');

        // Calculate opening and closing balances
        let prevClosingBalance = 0;
        monthlyBalances = monthlyBalances.map((balance) => {
            const openingBalance = prevClosingBalance;
            const closingBalance = openingBalance + balance.income - balance.expense;
            prevClosingBalance = closingBalance;

            return {
                month: balance.month,
                opening_balance: openingBalance,
                income: balance.income,
                expense: balance.expense,
                closing_balance: closingBalance
            };
        });
        const filteredBalance = monthlyBalances.filter(balance => balance.month === selectedMonthFormatted);

        //console.log(filteredBalance);
        
        // if (!selectedMonthData) {
        //     return res.status(404).json({
        //         status: 404,
        //         message: 'Data not found for the selected period'
        //     });
        // }

        const incomeTrx = transactions[0]?.income?.[0]?.transactions || [];
        const totalIncome = transactions[0]?.income?.[0]?.totalAmount || 0;

        const expenseTrx = transactions[0]?.expense?.[0]?.transactions || [];
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
                monthlyData: [filteredBalance],
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

    } catch (err) {
        console.error(err.message);
        res.status(500).json({
            status: 500,
            message: err.message
        });
    }
});



module.exports = router;