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

// Apply CORS to all routes in this router
router.use(cors(corsOptions));

// Create a new house
router.post('/create', protect, checkRole(['admin', 'editor','superadmin']), async (req, res) => {
    const { house_id, resident_name,  auto_bill_date, fee, occupancy_status, mandatory_fee,group} = req.body;

    try {
        let house = new House({
            house_id,
            resident_name,
            auto_bill_date,
            fee,
            occupancy_status,
            mandatory_fee,
            group
        });

        await house.save();
        res.status(201).json(house);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Get all houses
router.get('/all', protect, checkRole(['admin', 'editor','superadmin']), async (req, res) => {
    try {
        const houses = await House.find().populate('user_ids').populate('monthly_fees.transaction_id');
        res.status(200).json(houses);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

router.get('/fee', async (req, res) => {
    const {period, status} = req.query; 

    const matchConditions = {};
    if (period) {
        matchConditions['monthly_fees.month'] = period;
    }
    if (status) {
        matchConditions['monthly_fees.status'] = status;
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

        const totalPaid = houses.reduce((acc, house) => {
            const paidFees = house.monthly_fees.filter(fee => fee.status === 'Lunas');
            const total = paidFees.reduce((sum, fee) => sum + fee.fee, 0);
            return acc + total;
        }, 0);

        const totalTbd = houses.reduce((acc, house) => {
            const paidFees = house.monthly_fees.filter(fee => fee.status === 'TBD');
            const total = paidFees.reduce((sum, fee) => sum + fee.fee, 0);
            return acc + total;
        }, 0);

        const totalUnpaid = houses.reduce((acc, house) => {
            const unpaidFees = house.monthly_fees.filter(fee => fee.status !== 'Lunas');
            const total = unpaidFees.reduce((sum, fee) => sum + fee.fee, 0);
            return acc + total;
        }, 0);

        const totalHousesPaid = houses.filter(house => {
            const paidFees = house.monthly_fees.filter(fee => fee.status !== 'Belum Bayar');
            return paidFees.length > 0;
        }).length;

        const allHouses = await House.find({ mandatory_fee: true }).populate('user_ids').populate('monthly_fees.transaction_id');

        const totalHouseUnpaid = houses.length - totalHousesPaid;
        const percentage = (totalHousesPaid / allHouses.length) * 100;
        const roundedPercentage = percentage.toFixed(2); // membulatkan menjadi 2 desimal

        const result = {
            data: houses,
            total: allHouses.length,
            total_paid: totalPaid,
            total_unpaid: totalUnpaid,
            total_houses_paid: totalHousesPaid,
            total_houses_unpaid: totalHouseUnpaid,
            percentage_paid: roundedPercentage+'%',
            total_tbd: totalTbd
        };

        return res.json(result);

    } catch(err){
        console.error(err.message);
        res.status(500).send('Server error');
    }

});

router.get('/outstanding', async (req, res) => {
    try {
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1; // bulan sekarang  

      const startYear = 2024;
      const startMonth = 7;

      const aggregationPipeline = [
        { $unwind: '$monthly_fees' },
        {
            $match: {
                'monthly_fees.month': {
                $gte: `${startYear}-${String(startMonth).padStart(2, '0')}`,
                $lte: `${currentYear}-${String(currentMonth).padStart(2, '0')}`,
                },
                'monthly_fees.status': 'Belum Bayar',
                'mandatory_fee': true,
            },
        },
        {
          $group: {
            _id: { house_id: '$house_id', month: '$monthly_fees.month' },
            total_fee: { $sum: '$monthly_fees.fee' },
            occupancy_status: { $first: '$occupancy_status' },
          },
        },
        {
          $project: {
            _id: 0,
            'house': '$_id.house_id',
            periods: '$_id.month',
            'total_fee': '$total_fee',
            'occupancy_status': '$occupancy_status', 
          },
        },
        {
            $sort: { periods: 1 }, // mengurutkan periods secara ascending
        },
        {
            $group: {
                _id: '$house',
                periods: { $push: '$periods' },
                total_fee: { $sum: '$total_fee' },
                occupancy_status: { $first: '$occupancy_status' }, 
            },
        },
        {
            $project: {
              _id: 0,
              house: '$_id',
              periods: '$periods',
              total_fee: '$total_fee',
              occupancy_status: '$occupancy_status', 
            },
        },
        { $sort: { house: 1 } },
      ];

      
  
       const data = await House.aggregate(aggregationPipeline);
    //   return res.json(result);

      const result = {
        data: data,
        total: data.length,
        total_amount: data.reduce((acc, current) => acc + current.total_fee, 0),
      };

      return res.json(result);
      
    } catch (error) {
      console.error('Error fetching outstanding data:', error);
      res.status(500).json({ error: 'Error fetching outstanding data' });
    }
});

router.get('/tbd', async (req, res) => {
    try {
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const endMonth = 12

      const startYear = 2024;
      const startMonth = 7;

      const aggregationPipeline = [
        { $unwind: '$monthly_fees' },
        {
            $match: {
                'monthly_fees.month': {
                $gte: `${startYear}-${String(startMonth).padStart(2, '0')}`,
                $lte: `${currentYear}-${String(endMonth).padStart(2, '0')}`,
                },
                'monthly_fees.status': 'TBD',
                'mandatory_fee': true,
            },
        },
        {
          $group: {
            _id: { house_id: '$house_id', month: '$monthly_fees.month' },
            total_fee: { $sum: '$monthly_fees.fee' },
          },
        },
        {
          $project: {
            _id: 0,
            'house': '$_id.house_id',
            periods: '$_id.month',
            'total_fee': '$total_fee',
          },
        },
        {
            $sort: { periods: 1 }, // mengurutkan periods secara ascending
        },
        {
            $group: {
                _id: '$house',
                periods: { $push: '$periods' },
                total_fee: { $sum: '$total_fee' },
            },
        },
        {
            $project: {
              _id: 0,
              house: '$_id',
              periods: '$periods',
              total_fee: '$total_fee',
            },
        },
        { $sort: { house: 1 } },
      ];

      
  
       const data = await House.aggregate(aggregationPipeline);
    //   return res.json(result);

      const result = {
        data: data,
        total: data.length,
        total_amount: data.reduce((acc, current) => acc + current.total_fee, 0),
      };

      return res.json(result);
      
    } catch (error) {
      console.error('Error fetching outstanding data:', error);
      res.status(500).json({ error: 'Error fetching outstanding data' });
    }
});

// Get a single house by ID
router.get('/:id', protect, checkRole(['admin', 'editor']), async (req, res) => {
    try {
        const house = await House.findById(req.params.id).populate('user_ids').populate('monthly_fees.transaction_id');
        if (!house) {
            return res.status(404).json({ msg: 'House not found' });
        }
        res.status(200).json(house);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Update a house
router.put('/update/:id', protect, checkRole(['admin', 'editor','superadmin']), async (req, res) => {
    const { house_id, user_ids, mandatory_fee, whatsapp_number, auto_bill_date, monthly_fees, resident_name, fee, occupancy_status,group  } = req.body;

    try {
        let house = await House.findById(req.params.id);
        if (!house) {
            return res.status(404).json({ msg: 'House not found' });
        }

        house.house_id = house_id || house.house_id;
        house.user_ids = user_ids || house.user_ids;
        house.auto_bill_date = auto_bill_date || house.auto_bill_date;
        house.monthly_fees = monthly_fees || house.monthly_fees;
        house.resident_name = resident_name || house.resident_name;
        house.fee = fee || house.fee;
        house.occupancy_status = occupancy_status || house.occupancy_status;
        house.whatsapp_number = whatsapp_number || house.whatsapp_number;
        house.mandatory_fee = mandatory_fee || house.mandatory_fee;
        house.group = group || house.group;

        await house.save();
        res.status(200).json(house);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Delete a house
router.delete('/delete/:id', protect, checkRole(['admin', 'editor','superadmin']), async (req, res) => {
    try {
        const house = await House.findById(req.params.id);
        if (!house) {
            return res.status(404).json({ msg: 'House not found' });
        }

        await house.remove();
        res.status(200).json({ msg: 'House removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// router.get('/lunas', protect, checkRole(['admin', 'editor', 'superadmin', 'user']), async (req, res) => {
//     const { period, count } = req.query; // Get the period and count query parameters

//     if (!period) {
//         return res.status(400).json({ error: 'Period is required' });
//     }

//     try {
//         if (count === 'true') {
//             // Hitung jumlah rumah yang memiliki status "Lunas" pada bulan tertentu
//             const housesCount = await House.countDocuments({
//                 'monthly_fees': {
//                     $elemMatch: {
//                         month: period,
//                         status: 'Lunas'
//                     }
//                 }
//             });

//             return res.json({ totalHouses: housesCount });
//         } else {
//             // Ambil detail rumah yang memiliki status "Lunas" pada bulan tertentu
//             const houses = await House.aggregate([
//                 { $match: { 'monthly_fees.month': period, 'monthly_fees.status': 'Lunas' } },
//                 { $unwind: '$monthly_fees' },
//                 { $match: { 'monthly_fees.month': period, 'monthly_fees.status': 'Lunas' } },
//                 { $group: {
//                     _id: '$_id',
//                     house_id: { $first: '$house_id' },
//                     resident_name: { $first: '$resident_name' },
//                     auto_bill_date: { $first: '$auto_bill_date' },
//                     fee: { $first: '$fee' },
//                     occupancy_status: { $first: '$occupancy_status' },
//                     monthly_fees: { $push: '$monthly_fees' },
//                     user_ids: { $first: '$user_ids' }
//                 }}
//             ]);

//             return res.json(houses);
//         }
//     } catch (error) {
//         console.error('Error fetching houses with lunas fees:', error);
//         res.status(500).json({ error: 'Error fetching houses with lunas fees' });
//     }
// });










module.exports = router;
