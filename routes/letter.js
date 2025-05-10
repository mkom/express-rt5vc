const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Letter = require('../models/Letter');
const protect = require('./protect');
const checkRole = require('./checkRole');
const { format } = require('date-fns');
const moment = require('moment-timezone');
const { ObjectId } = mongoose.Types;

const cors = require('cors');
const corsOptions = {
    origin: ['https://rt5vc.vercel.app', 'http://localhost:3000'],
    methods: 'GET, POST, PUT, DELETE, OPTIONS',
    allowedHeaders: 'Content-Type, Authorization',
    credentials: true,
};

// Apply CORS to all routes in this router
router.use(cors(corsOptions));

// Fungsi untuk membuat nomor surat dengan nomor urut
const romanMonths = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

const generateLetterNumber = async (house_id, rt, rw) => {
  try {
    // const lastLetter = await Letter.findOne().sort({ serial_number: -1 });
    // const serialNumber = lastLetter ? lastLetter.serial_number + 1 : 1;

    // const paddedSerial = String(serialNumber).padStart(3, '0');
    const lastLetter = await Letter.findOne().sort({ serial_number: -1 });
    const serialNumber = lastLetter ? lastLetter.serial_number + 1 : 1;
    const paddedSerial = String(serialNumber).padStart(3, '0'); 

    const now = new Date();
    const romanMonth = romanMonths[now.getMonth()];
    const year = now.getFullYear();

    const letterNumber = `${paddedSerial}/TAGIHAN/RT${rt}-RW${rw}/${house_id}/${romanMonth}/${year}`;

    return { letterNumber, serialNumber };
  } catch (error) {
    console.error('Failed to generate letter number:', error);
    throw new Error('Nomor surat gagal dibuat');
  }
};


// API endpoint untuk membuat surat
router.post('/', async (req, res) => {
    try {
      const { house_id, resident_name, periods, total_fee } = req.body;
  
     
      // Cek surat duplikat
      const existing = await Letter.findOne({
        house_id,
        periods: { $all: periods, $size: periods.length },
        total_fee,
      });

      if (existing) {
        return res.status(200).json({
          success: true,
          reused: true,
          message: 'Surat sudah ada, tidak dibuat ulang.',
          letter_number: existing.letter_number,
        });
      }

       // Generate nomor surat
       const { letterNumber, serialNumber } = await generateLetterNumber(house_id,'005','011');
  
  
      // Simpan surat ke database
      const newLetter = new Letter({
        letter_number: letterNumber,
        serial_number: serialNumber, // Ambil serial number dari nomor surat
        content: 'Isi Surat...',
        house_id,
        resident_name,
        periods,
        total_fee,
      });
  
      await newLetter.save();
  
      res.json({ success: true, letter_number: letterNumber });
    } catch (error) {
      console.error('Error saving letter:', error);
      res.status(500).json({ success: false, message: 'Failed to create letter' });
    }
});
  
module.exports = router;