const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const SetorRWSchema = new Schema({
    related_months: [{
        month: { type: String, required: true },  // Format bulan (YYYY-MM)
        total: { type: Number, required: true }  // Total transaksi di bulan tersebut
    }],
    fee_setor_rw: {
        type: Number,
        required: true,
    },
    total_setor_rw:{
        type: Number,
        required: true,
    },
    tanggal_setor_rw: {
        type: Date,
        required: true,
    }
},{ timestamps: true });

const SetorRW = mongoose.model('SetorRW', SetorRWSchema);
module.exports = SetorRW;
