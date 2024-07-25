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
    const { house_id, user_ids, auto_bill_date, monthly_fees, resident_name, fee, occupancy_status  } = req.body;

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

module.exports = router;
