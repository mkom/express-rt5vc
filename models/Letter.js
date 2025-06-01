const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const letterSchema = new mongoose.Schema({
  letter_number: { type: String, required: true },
  serial_number: { type: Number, required: true },  // Nomor urut surat
  content: { type: String },
  house_id: {type: String },
  resident_name: { type: String },
  periods: { type: [String] },
  total_fee: { type: Number },
}, { timestamps: true });

const Letter = mongoose.model('Letter', letterSchema);

module.exports = Letter;
