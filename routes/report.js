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
                    status: 'berhasil' // Cukup di sini saja
                }
            },
            {
                $facet: {
                    income: [
                        { $match: { transaction_type: 'income' } },
                        { $sort: { date: -1 } },
                        { $group: { _id: null, totalAmount: { $sum: "$amount" }, transactions: { $push: "$$ROOT" } } }
                    ],
                    expense: [
                        { $match: { transaction_type: 'expense' } },
                        { $sort: { date: -1 } },
                        { $group: { _id: null, totalAmount: { $sum: "$amount" }, transactions: { $push: "$$ROOT" } } }
                    ],
                    ipl: [
                        { $match: { transaction_type: 'ipl' } },
                        { $sort: { date: -1 } },
                        { $group: { _id: null, totalAmount: { $sum: "$amount" }, transactions: { $push: "$$ROOT" } } }
                    ],
                    inRutin: [
                        { $match: { $or: [{ transaction_type: 'income' }, { transaction_type: 'ipl' }], transaction_category: 'Rutin' } },
                        { $sort: { date: -1 } },
                        { $group: { _id: null, totalAmount: { $sum: "$amount" }, transactions: { $push: "$$ROOT" } } }
                    ],
                    inLain: [
                        { $match: { transaction_type: 'income', transaction_category: 'Lain - Lain' } },
                        { $sort: { date: -1 } },
                        { $group: { _id: null, totalAmount: { $sum: "$amount" }, transactions: { $push: "$$ROOT" } } }
                    ],
                    inFasos: [
                        { $match: { transaction_type: 'income', transaction_category: 'Fasilitas Sosial' } },
                        { $sort: { date: -1 } },
                        { $group: { _id: null, totalAmount: { $sum: "$amount" }, transactions: { $push: "$$ROOT" } } }
                    ],
                    inFasum: [
                        { $match: { transaction_type: 'income', transaction_category: 'Fasilitas Umum' } },
                        { $sort: { date: -1 } },
                        { $group: { _id: null, totalAmount: { $sum: "$amount" }, transactions: { $push: "$$ROOT" } } }
                    ],
                    outRutin: [
                        { $match: { transaction_type: 'expense', transaction_category: 'Rutin' } },
                        { $sort: { date: -1 } },
                        { $group: { _id: null, totalAmount: { $sum: "$amount" }, transactions: { $push: "$$ROOT" } } }
                    ],
                    outLain: [
                        { $match: { transaction_type: 'expense', transaction_category: 'Lain - Lain' } },
                        { $sort: { date: -1 } },
                        { $group: { _id: null, totalAmount: { $sum: "$amount" }, transactions: { $push: "$$ROOT" } } }
                    ],
                    outFasos: [
                        { $match: { transaction_type: 'expense', transaction_category: 'Fasilitas Sosial' } },
                        { $sort: { date: -1 } },
                        { $group: { _id: null, totalAmount: { $sum: "$amount" }, transactions: { $push: "$$ROOT" } } }
                    ],
                    outFasum: [
                        { $match: { transaction_type: 'expense', transaction_category: 'Fasilitas Umum' } },
                        { $sort: { date: -1 } },
                        { $group: { _id: null, totalAmount: { $sum: "$amount" }, transactions: { $push: "$$ROOT" } } }
                    ],
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
                        },
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

        // let totalOutstandingOverall = 0;
        // const housesAll = await House.find()
        // .populate({
        //     path: 'monthly_fees.transaction_id',
        //     model: 'Transaction',
        //     select: '_id date'
        // })
        // .sort({ house_id: 1 })
        // .then(housesAll => {
        //     return housesAll.map(house => {
        //         const now = new Date();
        //         const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        //         // Filter hanya monthly_fees yang statusnya 'Belum Bayar'
        //         const filteredMonthlyFees = house.monthly_fees.filter(mf => {
        //             const mfMonth = mf.month.slice(0, 7); // extract month from monthly_fees month string
        //             const correspondingMonthlyStatus = house.monthly_status.find(ms => ms.month === mf.month);
        //             return mfMonth >= "2024-07" && mfMonth <= currentMonth && mf.status === "Belum Bayar" &&
        //                 (correspondingMonthlyStatus && (correspondingMonthlyStatus.status === "Isi" || correspondingMonthlyStatus.status === "Weekend"));
        //         });

        //         const filteredMonthlyStatus = house.monthly_status.filter(ms => {
        //             const msMonth = ms.month.slice(0, 7); // extract month from monthly_status month string
        //             return msMonth >= "2024-07" && msMonth <= currentMonth && (ms.status === "Isi" || ms.status === "Weekend");
        //         });

        //         // Filter 'Belum Bayar' dari bulan Juli 2024 sampai bulan sekarang
        //         const outstandingFees = house.monthly_fees.filter(mf => {
        //             const mfMonth = mf.month.slice(0, 7);
        //             const correspondingMonthlyStatus = house.monthly_status.find(ms => ms.month === mf.month);
        //             return mfMonth >= "2024-07" && mfMonth <= currentMonth &&
        //                 mf.status === "Belum Bayar" && (correspondingMonthlyStatus && (correspondingMonthlyStatus.status === "Isi" || correspondingMonthlyStatus.status === "Weekend"));
        //         })
        //         .map(ms => ms.month.slice(0, 7));

               
        //         // Hanya masukkan house yang memiliki outstandingFees lebih dari 0
        //         if (outstandingFees.length > 0) {
        //             const total_fee = filteredMonthlyFees.reduce((acc, mf) => acc + mf.fee, 0);

        //             return {
        //                 _id: house._id,
        //                 house_id: house.house_id,
        //                 group: house.group,
        //                 periods: outstandingFees,
        //                 monthly_status: filteredMonthlyStatus,
        //                 total_fee: total_fee
        //             };
        //         }
        //     }).filter(house => house !== undefined); // Filter out undefined (houses with no outstanding fees)
        // });

        //  totalOutstandingOverall = housesAll.reduce((acc, house) => acc + house.total_fee, 0);
       
        const houses = await House.find()
            .populate({
                path: 'monthly_fees.transaction_id',
                model: 'Transaction',
                select: '_id date'
            })
            .sort({ house_id: 1 })
            .then(houses => {
                return houses.map(house => {
                    // Filter hanya monthly_fees yang statusnya 'Belum Bayar' pada bulan yang dipilih
                    const filteredMonthlyFees = house.monthly_fees.filter(mf => 
                        mf.month.slice(0, 7) === selectedMonthFormatted && mf.status === "Belum Bayar"
                    );

                    // Filter hanya monthly_status yang sesuai dengan bulan yang dipilih
                    const filteredMonthlyStatus = house.monthly_status.filter(ms => 
                        ms.month.slice(0, 7) === selectedMonthFormatted && (ms.status === "Isi" || ms.status === "Weekend")
                       //ms.month.slice(0, 7) === selectedMonthFormatted && (ms.status === "Isi")
                    );

                    if (filteredMonthlyFees.length > 0 && filteredMonthlyStatus.length > 0) {
                        const total_fee = filteredMonthlyFees.reduce((acc, mf) => acc + mf.fee, 0);

                        return {
                            _id: house._id,
                            house_id: house.house_id,
                            group: house.group,
                            periods: [selectedMonthFormatted], // Karena hanya satu bulan yang dipilih
                            monthly_status: filteredMonthlyStatus,
                            total_fee: total_fee
                        };
                    }
                }).filter(house => house !== undefined); // Hapus data yang undefined
        });

        const total_outstanding_period = houses.reduce((acc, house) => acc + house.total_fee, 0);

        // Jika `filteredBalance` tidak kosong, tambahkan `total_outstanding`
        if (filteredBalance.length > 0) {
            filteredBalance[0].total_outstanding = total_outstanding_period;
        } else {
            // Jika tidak ada data, bisa ditambahkan sebagai objek baru
            filteredBalance.push({
                month: selectedMonthFormatted,
                total_outstanding: total_outstanding_period
            });
        }

        const incomeTrx = transactions[0]?.income?.[0]?.transactions || [];
        const totalIncome = transactions[0]?.income?.[0]?.totalAmount || 0;

        const expenseTrx = transactions[0]?.expense?.[0]?.transactions || [];
        const totalExpense = transactions[0]?.expense?.[0]?.totalAmount || 0;

        const iplTrx = transactions[0]?.ipl?.[0]?.transactions || [];
        // console.log(iplTrx);
        const totalIpl = transactions[0]?.ipl?.[0]?.totalAmount || 0;

        // const inRutinTrx = transactions[0]?.inRutin?.[0]?.transactions || [];
        // const totalInRutin = transactions[0]?.inRutin?.[0]?.totalAmount || 0;

        const inLainTrx = transactions[0]?.inLain?.[0]?.transactions || [];
        const totalInLainTrx = transactions[0]?.inLain?.[0]?.totalAmount || 0;

        const inFasosTrx = transactions[0]?.inFasos?.[0]?.transactions || [];
        const totalInFasosTrx  = transactions[0]?.inFasos?.[0]?.totalAmount || 0;

        const inFasumTrx = transactions[0]?.inFasum?.[0]?.transactions || [];
        const totalInFasumTrx  = transactions[0]?.inFasum?.[0]?.totalAmount || 0;

        const outRutinTrx = transactions[0]?.outRutin?.[0]?.transactions || [];
        const totalOutRutinTrx  = transactions[0]?.outRutin?.[0]?.totalAmount || 0;

        const outLainTrx = transactions[0]?.outLain?.[0]?.transactions || [];
        const totalOutLainTrx  = transactions[0]?.outLain?.[0]?.totalAmount || 0;

        const outFasosTrx = transactions[0]?.outFasos?.[0]?.transactions || [];
        const totalOutFasosTrx  = transactions[0]?.outFasos?.[0]?.totalAmount || 0;

        const outFasumTrx = transactions[0]?.outFasum?.[0]?.transactions || [];
        const totalOutFasumTrx  = transactions[0]?.outFasum?.[0]?.totalAmount || 0;

        const formattedIncomeTransactions = incomeTrx
            .filter(transaction => transaction != null)
            .map(transaction => ({
                ...transaction._doc,
                date: transaction.date,
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
                date: transaction.date,
                created_at: format(new Date(transaction.created_at), 'dd MMM yyyy HH:mm:ss'),
                description: transaction.description,
                amount: transaction.amount,
                transaction_type: transaction.transaction_type,
            }))
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 5);
            
        const formattedOutRutinTrxTransactions = outRutinTrx
            .filter(transaction => transaction != null)
            .map(transaction => ({
                ...transaction._doc,
                date: transaction.date,
                created_at: format(new Date(transaction.created_at), 'dd MMM yyyy HH:mm:ss'),
                description: transaction.description,
                amount: transaction.amount,
                transaction_type: transaction.transaction_type,
            }))
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 5);

        const formattedOutLainTrxTransactions = outLainTrx
            .filter(transaction => transaction != null)
            .map(transaction => ({
                ...transaction._doc,
                date: transaction.date,
                created_at: format(new Date(transaction.created_at), 'dd MMM yyyy HH:mm:ss'),
                description: transaction.description,
                amount: transaction.amount,
                transaction_type: transaction.transaction_type,
            }))
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 5);

        const formattedOutFasosTrxTransactions = outFasosTrx
            .filter(transaction => transaction != null)
            .map(transaction => ({
                ...transaction._doc,
                date: transaction.date,
                created_at: format(new Date(transaction.created_at), 'dd MMM yyyy HH:mm:ss'),
                description: transaction.description,
                amount: transaction.amount,
                transaction_type: transaction.transaction_type,
            }))
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 5);

        const formattedOutFasumTrxTransactions = outFasumTrx
            .filter(transaction => transaction != null)
            .map(transaction => ({
                ...transaction._doc,
                date: transaction.date,
                created_at: format(new Date(transaction.created_at), 'dd MMM yyyy HH:mm:ss'),
                description: transaction.description,
                amount: transaction.amount,
                transaction_type: transaction.transaction_type,
            }))
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 5);
            
        const houseIds = iplTrx.map(transaction => transaction.house_id);
        const populatedHouses = await House.find({ _id: { $in: houseIds } }).select('house_id');

        const formattedIplTransactions = iplTrx
            .filter(transaction => transaction != null)
            .map(transaction => {
                const house = populatedHouses.find(h => h._id.toString() === transaction.house_id.toString());
                return {
                    ...transaction,
                    date: moment.tz(transaction.date, "UTC").tz("Asia/Jakarta").toDate(),
                    created_at: moment.tz(transaction.date, "UTC").tz("Asia/Jakarta").toDate(),
                    description: transaction.description,
                    amount: transaction.amount,
                    transaction_type: transaction.transaction_type,
                    house_id: house ? house.house_id : null, // Populasi manual
                    related_months: transaction.related_months,
                };
            })
            .sort((a, b) => new Date(b.date) - new Date(a.date))
           // .slice(0, 5);
            
        // const formattedInRUtinTransactions = inRutinTrx
        //     .filter(transaction => transaction != null)
        //     .map(transaction => {
        //         const house = populatedHouses.find(h => h._id.toString() === transaction.house_id.toString());
        //         return {
        //             ...transaction,
        //             date: moment.tz(transaction.date, "UTC").tz("Asia/Jakarta").toDate(),
        //             created_at: moment.tz(transaction.date, "UTC").tz("Asia/Jakarta").toDate(),
        //             description: transaction.description,
        //             amount: transaction.amount,
        //             transaction_type: transaction.transaction_type,
        //             house_id: house ? house.house_id : null, // Populasi manual
        //             related_months: transaction.related_months,
        //         };
        //     })
        //     .sort((a, b) => new Date(b.date) - new Date(a.date))
        //     .slice(0, 5);

        const houseIds1 = inLainTrx.map(transaction => transaction.house_id);
        const populatedHouses1 = await House.find({ _id: { $in: houseIds1 } }).select('house_id');
        const formattedInLainTrxTransactions = inLainTrx
            .filter(transaction => transaction != null)
            .map(transaction => {
                const house = populatedHouses1.find(h => h._id.toString() === transaction.house_id.toString());
                return {
                    ...transaction,
                    date: moment.tz(transaction.date, "UTC").tz("Asia/Jakarta").toDate(),
                    created_at: moment.tz(transaction.date, "UTC").tz("Asia/Jakarta").toDate(),
                    description: transaction.description,
                    amount: transaction.amount,
                    transaction_type: transaction.transaction_type,
                    house_id: house ? house.house_id : null, // Populasi manual
                    related_months: transaction.related_months,
                };
            })
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 5);

        const houseIds2 = inLainTrx.map(transaction => transaction.house_id);
        const populatedHouses2 = await House.find({ _id: { $in: houseIds2 } }).select('house_id');
        const formattedInFasosTrxTransactions = inFasosTrx
            .filter(transaction => transaction != null)
            .map(transaction => {
                const house = populatedHouses2.find(h => h._id.toString() === transaction.house_id.toString());
                return {
                    ...transaction,
                    date: moment.tz(transaction.date, "UTC").tz("Asia/Jakarta").toDate(),
                    created_at: moment.tz(transaction.date, "UTC").tz("Asia/Jakarta").toDate(),
                    description: transaction.description,
                    amount: transaction.amount,
                    transaction_type: transaction.transaction_type,
                    house_id: house ? house.house_id : null, // Populasi manual
                    related_months: transaction.related_months,
                };
            })
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 5);

        const houseIds3 = inLainTrx.map(transaction => transaction.house_id);
        const populatedHouses3 = await House.find({ _id: { $in: houseIds3 } }).select('house_id');
        const formattedInFasumTrxTransactions = inFasumTrx
            .filter(transaction => transaction != null)
            .map(transaction => {
                const house = populatedHouses3.find(h => h._id.toString() === transaction.house_id.toString());
                return {
                    ...transaction,
                    date: moment.tz(transaction.date, "UTC").tz("Asia/Jakarta").toDate(),
                    created_at: moment.tz(transaction.date, "UTC").tz("Asia/Jakarta").toDate(),
                    description: transaction.description,
                    amount: transaction.amount,
                    transaction_type: transaction.transaction_type,
                    house_id: house ? house.house_id : null, // Populasi manual
                    related_months: transaction.related_months,
                };
            })
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
                    //totalOutstandingOverall
                },
                monthlyData: [filteredBalance],
                transactions: {
                    // income: formattedIncomeTransactions,
                    // expense: formattedExpenseTransactions,
                    ipl: formattedIplTransactions,
                    inOther:formattedInLainTrxTransactions,
                    inFasos:formattedInFasosTrxTransactions,
                    inFasum:formattedInFasumTrxTransactions,
                    OutRutin:formattedOutRutinTrxTransactions,
                    OutOther:formattedOutLainTrxTransactions,
                    OutFasos:formattedOutFasosTrxTransactions,
                    OutFasum:formattedOutFasumTrxTransactions,
                    // inRutin: formattedInRUtinTransactions,
                    // totalIncome: totalIncome,
                    // totalExpense: totalExpense,
                    totalIpl: totalIpl,
                    totalInOther: totalInLainTrx,
                    totalInFasos: totalInFasosTrx,
                    totalInFasum: totalInFasumTrx,
                    totalOutRutin: totalOutRutinTrx,
                    totalOutOther: totalOutLainTrx,
                    totalOutFasos: totalOutFasosTrx,
                    totalOutFasum: totalOutFasumTrx,
                    // totalInRutin: totalInRutin
                },
               
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

// Fungsi untuk mendapatkan daftar bulan dari Juli 2024 hingga bulan yang dipilih
const getRelatedMonths = (selectedMonth) => {
    const startMonth = "2024-07"; // Mulai dari Juli 2024
    const currentMonth = new Date().toISOString().slice(0, 7); // Format YYYY-MM (bulan sekarang)

    const months = [];
    let current = startMonth;

    while (current <= currentMonth) {
        months.push(current);
        const [year, month] = current.split("-").map(Number);
        const nextMonth = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
        current = nextMonth;
    }

    return months.filter(m => m <= selectedMonth).reverse(); // Urutkan dari terbaru ke terlama
};

function getPreviousMonth(month) {
    const date = new Date(month + "-01");
    date.setMonth(date.getMonth() - 1);
    const prevMonth = date.toISOString().slice(0, 7); // Format YYYY-MM
    return prevMonth;
}
router.get("/setoranrw", async (req, res) => {
    try {
        const { month } = req.query; // Ambil bulan dari query params (format YYYY-MM)
        if (!month) {
            return res.status(400).json({ message: "Month is required" });
        }

        if (month < "2024-07") {
            return res.status(400).json({ message: "Month must be 2024-07 or later" });
        }

        const targetDate = new Date(`${month}-20T23:59:59.999Z`); // Batas tanggal 20 bulan yang dipilih
        let transactions = {};

        // Ambil transaksi dari bulan yang dipilih (date ≤ 20)
        transactions[month] = await Transaction.find({
            related_months: month,
            date: { $lte: targetDate }
        }).sort({ date: 1 });

        if (transactions[month].length === 0) {
            transactions[month] = []; // Jika tidak ada transaksi, set array kosong
        }

        // Ambil transaksi dari 3 bulan sebelumnya (hanya jika ≥ 2024-07)
        let prevMonth = month;
        for (let i = 0; i < 3; i++) {
            prevMonth = decreaseMonth(prevMonth);
            if (prevMonth < "2024-07") break; // Stop jika bulan sebelum Juli 2024

            // Tentukan prevStartDate sesuai dengan bulan yang dipilih
            let prevStartDate = new Date(`${prevMonth}-20T23:59:59.999Z`);

            // Jika bulan sebelumnya adalah Juli 2024, maka set tanggal mulai pada 21 Agustus 2024
            if (prevMonth === "2024-07") {
                prevStartDate = new Date("2024-08-21T00:00:00.000Z"); // Transaksi dimulai setelah 20 Agustus 2024
            }

            // Ambil transaksi dengan rentang tanggal yang sesuai
            let prevTransactions = await Transaction.find({
                related_months: prevMonth,
                date: { 
                    $gt: prevStartDate, // Ambil transaksi setelah tanggal 20 bulan sebelumnya (atau 20 Agustus untuk Juli)
                    $lte: targetDate // ≤ 20 bulan yang dipilih
                }
            }).sort({ date: 1 });

            transactions[prevMonth] = prevTransactions.length > 0 ? prevTransactions : [];
        }

        // Koreksi transaksi
        for (const month in transactions) {
            transactions[month] = transactions[month].map(transaction => {
                // Koreksi tanggal transaksi
                transaction.date = new Date(transaction.date);
                return transaction;
            });
        }

        res.json(transactions);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Terjadi kesalahan saat mengambil data" });
    }
});

// Fungsi untuk mendapatkan bulan sebelumnya dalam format YYYY-MM
function decreaseMonth(month) {
    let [year, m] = month.split("-").map(Number);
    m--; // Kurangi 1 bulan
    if (m === 0) { 
        year--; 
        m = 12; 
    }
    return `${year}-${String(m).padStart(2, "0")}`; // Format YYYY-MM
}









// Fungsi untuk mendapatkan semua bulan yang relevan mulai dari Juli 2024
function getAllRelatedMonths(period) {
    const startMonth = "2024-07";  // Bulan mulai
    const [year, month] = period.split("-");
    let relatedMonths = [];

    // Tambahkan bulan yang dipilih ke dalam daftar related months
    relatedMonths.push(period);

    // Loop mundur dari bulan yang dipilih dan tambahkan bulan-bulan sebelumnya
    let currentMonth = parseInt(month);
    while (`${year}-${currentMonth.toString().padStart(2, "0")}` >= startMonth) {
        relatedMonths.unshift(`${year}-${currentMonth.toString().padStart(2, "0")}`);
        currentMonth--;
        if (currentMonth === 0) {
            currentMonth = 12;
        }
    }

    return relatedMonths;
}


// Fungsi untuk mendapatkan bulan sebelumnya dari period yang dipilih
function getPreviousMonth(month) {
    const [year, monthNumber] = month.split("-"); // Misalnya "2024-08" menjadi ['2024', '08']
    let prevMonth = parseInt(monthNumber) - 1;
    if (prevMonth === 0) {
        prevMonth = 12;
    }
    return `${year}-${prevMonth.toString().padStart(2, "0")}`;
}





module.exports = router;
