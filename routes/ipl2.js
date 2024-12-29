const express = require('express');
const House = require('../models/house');
const protect = require('./protect');
const checkRole = require('./checkRole');
const router = express.Router();

const cors = require('cors');
const corsOptions = {
    origin: ['https://rt5vc.vercel.app', 'http://localhost:3000'],
    methods: 'GET, POST, PUT, DELETE, OPTIONS',
    allowedHeaders: 'Content-Type, Authorization',
    credentials: true,
};

router.use(cors(corsOptions));

router.get('/', async (req, res) => {
    try {
  
            const houses = await House.find()
            .populate({
                path: 'monthly_fees.transaction_id',
                model: 'Transaction',
                select: '_id date'
            })
            .sort({ house_id: 1 })
            .then(houses => {
            return houses.map(house => {

              const now = new Date();
              const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
              // /const currentMonth = new Date().toISOString().slice(0, 7); // get current month in YYYY-MM format
              const filteredMonthlyFees = house.monthly_fees.filter(mf => {
                const mfMonth = mf.month.slice(0, 7); // extract month from monthly_fees month string
                const correspondingMonthlyStatus = house.monthly_status.find(ms => ms.month === mf.month);
                return mfMonth >= "2024-07" && mfMonth <= currentMonth && (correspondingMonthlyStatus && correspondingMonthlyStatus.status === "Isi");
              });

              const filteredMonthlyStatus = house.monthly_status.filter(ms => {
                const msMonth = ms.month.slice(0, 7); // extract month from monthly_status month string
                return msMonth >= "2024-07" && msMonth <= currentMonth && ms.status === "Isi";
              });

               // Filter 'Belum Bayar' dari bulan Juli 2024 sampai bulan sekarang
              const outstandingFees = house.monthly_fees.filter(mf => {
                const mfMonth = mf.month.slice(0, 7);
                const correspondingMonthlyStatus = house.monthly_status.find(ms => ms.month === mf.month);
                return mfMonth >= "2024-07" && mfMonth <= currentMonth &&
                    mf.status === "Belum Bayar" && (correspondingMonthlyStatus && correspondingMonthlyStatus.status === "Isi");
              });

              // Filter 'Lunas' dari bulan sekarang ke depan
              const futureFees = house.monthly_fees.filter(mf => {
                const mfMonth = mf.month.slice(0, 7);
                return mfMonth > currentMonth && mf.status === "Lunas";
              });
            
              return {
                _id: house._id,
                house_id: house.house_id,
                resident_name:house.resident_name,
                currentMonth: currentMonth,
                group:house.group,
                monthly_fees: filteredMonthlyFees,
                monthly_status: filteredMonthlyStatus,
                outstanding_count: outstandingFees.length, // Jumlah tunggakan
                future_count: futureFees.length // Jumlah iuran ke depan
              };
            });
          });
          
        return res.status(200).json({
            status: 200,
            message: 'success',
            data: houses,
        });
  
    } catch (err) {
      console.error(err.message);
      res.status(500).json({
        status: 500,
        error: 'Error fetching ipl data'
      });
    }
});


router.get('/:id', async (req, res) => {
  try {
    const house_id = req.params.id;
    const house = await House.findOne({house_id : house_id}) 
    .populate({
        path: 'monthly_fees.transaction_id',
        model: 'Transaction',
        select: '_id date proof_of_transfer payment_type'
    })

    if (!house) {
      return res.status(404).json({
        status: 404,
        message: 'House not found',
        data: null,
      });
    }

    const currentMonth = new Date().toISOString().slice(0, 7); // get current month in YYYY-MM format
    const filteredMonthlyFees = house.monthly_fees.filter(mf => {
      const mfMonth = mf.month.slice(0, 7); // extract month from monthly_fees month string
      const correspondingMonthlyStatus = house.monthly_status.find(ms => ms.month === mf.month);
      return mfMonth;
    });

    const filteredMonthlyStatus = house.monthly_status.filter(ms => {
      const msMonth = ms.month.slice(0, 7); // extract month from monthly_status month string
      return msMonth ;
    });

    const outstandingFees = house.monthly_fees.filter(mf => {
      const mfMonth = mf.month.slice(0, 7);
      const correspondingMonthlyStatus = house.monthly_status.find(ms => ms.month === mf.month);
      return mfMonth >= "2024-07" && mfMonth <= currentMonth &&
          mf.status === "Belum Bayar" && (correspondingMonthlyStatus && correspondingMonthlyStatus.status === "Isi");
    });

    const data = {
      _id: house._id,
      house_id: house.house_id,
      resident_name: house.resident_name,
      group: house.group,
      monthly_fees: filteredMonthlyFees,
      monthly_status: filteredMonthlyStatus,
      outstanding_count: outstandingFees.length,
    };
  
  return res.status(200).json({
      status: 200,
      message: 'success',
      data: data,
  });

  } catch (err) {
    console.error(err.message);
    res.status(500).json({
      status: 500,
      error: 'Error fetching ipl data'
  });
  }
});

module.exports = router;