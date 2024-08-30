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

    try {

        const aggregationPipeline = [
            { $unwind: '$monthly_fees' },
            { $match: matchConditions },
            {
                $lookup: {
                    from: 'transactions', // Koleksi yang akan di-join
                    localField: 'monthly_fees.transaction_id',
                    foreignField: '_id',
                    as: 'transaction_details'
                }
            },
            {
                $addFields: {
                    'monthly_fees.transaction_date': {
                        $arrayElemAt: ['$transaction_details.date', 0]
                    }
                }
            },
            {
                $group: {
                    _id: '$_id',
                    occupancy_status:  { $first: '$occupancy_status' },
                    house_id: { $first: '$house_id' },
                    monthly_fees: {
                        $push: {
                            month: '$monthly_fees.month',
                            status: '$monthly_fees.status',
                            fee: '$monthly_fees.fee',
                            transaction_date: '$monthly_fees.transaction_date'
                        }
                    }
                }
            },
            { $sort: { house_id: 1 } },
        ];

        const houses = await House.aggregate(aggregationPipeline);

        const totalNominal = houses.reduce((acc, house) => {
            const Fees = house.monthly_fees.filter(fee => fee.status === 'Lunas');
            const total = Fees.reduce((sum, fee) => sum + fee.fee, 0);
            return acc + total;
        }, 0);

        const totalTbd = houses.filter(house => {
            const Fees = house.monthly_fees.filter(fee => fee.status === 'TBD');
            return Fees.length > 0;
        }).length;

        const totalBelumBayar = houses.filter(house => {
            const Fees = house.monthly_fees.filter(fee => fee.status === 'Belum Bayar');
            return Fees.length > 0;
        }).length;

        const totalLunas = houses.filter(house => {
            const Fees = house.monthly_fees.filter(fee => fee.status === 'Lunas');
            return Fees.length > 0;
        }).length;

        const totalByGroup = houses.filter(house => {
            const Fees = house.monthly_fees.filter(fee => fee.status === 'Lunas');
            return Fees.length > 0;
        }).length;

        const totalDone = houses.filter(house => {
            const paidFees = house.monthly_fees.filter(fee => fee.status !== 'Belum Bayar');
            return paidFees.length > 0;
        }).length;

        const allHouses = await House.find({ mandatory_fee: true }).populate('user_ids').populate('monthly_fees.transaction_id');

        const totalHouseUnpaid = houses.length - totalDone;
        const percentage = (totalDone / houses.length) * 100;
        const roundedPercentage = percentage.toFixed(2); // membulatkan menjadi 2 desimal

        const result = {
            data: houses,
            total_unit: allHouses.length,
            total_nominal: totalNominal,
            total_pgyb: totalTbd,
            total_belum_bayar: totalBelumBayar,
            total_lunas: totalLunas,
            total_done: totalDone,
            //total_houses_unpaid: totalHouseUnpaid,
            percentage_paid: roundedPercentage+'%',
        };

       // console.log(result);

        return res.json(result);

    } catch(err){
        console.error(err.message);
        res.status(500).send('Server error');
    }

});

module.exports = router;