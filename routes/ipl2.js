const express = require('express');
const House = require('../models/house');
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
              const currentMonth = new Date().toISOString().slice(0, 7); // get current month in YYYY-MM format
              const filteredMonthlyFees = house.monthly_fees.filter(mf => {
                const mfMonth = mf.month.slice(0, 7); // extract month from monthly_fees month string
                const correspondingMonthlyStatus = house.monthly_status.find(ms => ms.month === mf.month);
                return mfMonth >= "2024-07" && mfMonth <= currentMonth && (correspondingMonthlyStatus && correspondingMonthlyStatus.status === "Isi");
              });
              const filteredMonthlyStatus = house.monthly_status.filter(ms => {
                const msMonth = ms.month.slice(0, 7); // extract month from monthly_status month string
                return msMonth >= "2024-07" && msMonth <= currentMonth && ms.status === "Isi";
              });
              return {
                _id: house._id,
                house_id: house.house_id,
                resident_name:house.resident_name,
                Ipl_fee: house.Ipl_fee,
                Rt_fee: house.Rt_fee,
                group:house.group,
                monthly_fees: filteredMonthlyFees,
                monthly_status: filteredMonthlyStatus
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

module.exports = router;