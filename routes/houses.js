const express = require('express');
const House = require('../models/house');
const protect = require('./protect');
const checkRole = require('./checkRole');
const router = express.Router();

// Create a new house
router.post('/create', protect, checkRole(['admin', 'editor','superadmin']), async (req, res) => {
    const { house_id, resident_name,  auto_bill_date, fee, occupancy_status } = req.body;

    try {
        let house = new House({
            house_id,
            resident_name,
            auto_bill_date,
            fee,
            occupancy_status
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

    //console.log(req.query)

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

        const totalUnpaid = houses.reduce((acc, house) => {
            const unpaidFees = house.monthly_fees.filter(fee => fee.status !== 'Lunas');
            const total = unpaidFees.reduce((sum, fee) => sum + fee.fee, 0);
            return acc + total;
        }, 0);

        const totalHousesPaid = houses.filter(house => {
            const paidFees = house.monthly_fees.filter(fee => fee.status === 'Lunas');
            return paidFees.length > 0;
        }).length;

        const totalHouseUnpaid = houses.length - totalHousesPaid;
        const percentage = (totalHousesPaid / houses.length) * 100;
        const roundedPercentage = percentage.toFixed(2); // membulatkan menjadi 2 desimal

        const result = {
            data: houses,
            total: houses.length,
            total_paid: totalPaid,
            total_unpaid: totalUnpaid,
            total_houses_paid: totalHousesPaid,
            total_houses_unpaid: totalHouseUnpaid,
            percentage_paid: roundedPercentage+'%'
        };

        return res.json(result);

    } catch(err){
        console.error(err.message);
        res.status(500).send('Server error');
    }

    // if (!period) {
    //     return res.status(400).json({ error: 'Period is required' });
    // }

    // try {
    //     if (period) {
    //         // Hitung jumlah rumah yang memiliki status "Lunas" pada bulan tertentu
    //         const housesCount = await House.countDocuments({
    //             'monthly_fees': {
    //                 $elemMatch: {
    //                     month: period,
    //                     status: 'Lunas'
    //                 }
    //             }
    //         });

    //         return res.json({ totalHouses: housesCount });
    //     } else {
    //         // Ambil detail rumah yang memiliki status "Lunas" pada bulan tertentu
    //         const houses = await House.aggregate([
    //             { $match: { 'monthly_fees.month': period, 'monthly_fees.status': 'Lunas' } },
    //             { $unwind: '$monthly_fees' },
    //             { $match: { 'monthly_fees.month': period, 'monthly_fees.status': 'Lunas' } },
    //             { $group: {
    //                 _id: '$_id',
    //                 house_id: { $first: '$house_id' },
    //                 resident_name: { $first: '$resident_name' },
    //                 auto_bill_date: { $first: '$auto_bill_date' },
    //                 fee: { $first: '$fee' },
    //                 occupancy_status: { $first: '$occupancy_status' },
    //                 monthly_fees: { $push: '$monthly_fees' },
    //                 user_ids: { $first: '$user_ids' }
    //             }}
    //         ]);

    //         return res.json(houses);
    //     }
    // } catch (error) {
    //     console.error('Error fetching houses fees:', error);
    //     res.status(500).json({ error: 'Error fetching houses fees' });
    // }
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
    const { house_id, user_ids, whatsapp_number, auto_bill_date, monthly_fees, resident_name, fee, occupancy_status  } = req.body;

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
