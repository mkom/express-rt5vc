const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const HouseSchema = new Schema({
    house_id: {
        type: String,
        required: true,
        unique: true,
    },
    resident_name: {
        type: String,
        default: null,
    },
    user_ids: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    }],
    whatsapp_number: {
        type: String,
        default: null,
    },

    group: {
        type: String,
        default: null,
    },
    monthly_status: [{
        month: {
            type: String,
            required: true,
        },
        status: {
            type: String,
            enum: ['Kosong', 'Isi', 'Weekend', 'Tidak ada kontak','Monthly'],
            default: 'Isi'
        },
        mandatory_ipl: {
            type: Boolean,
            default: true,
        },
        mandatory_rt: {
            type: Boolean,
            default: true,
        },
    }],
    monthly_fees: [{
        month: {
            type: String,
            required: true,
        },
        status: {
            type: String,
            enum: ['Lunas', 'Belum Bayar', 'Bayar Sebagian', "TBD","Check"],
            default: 'Belum Bayar'
        },
        fee:{
            type: Number,
            default: 70000, 
            required: true
        },
        transaction_id: {
            type: Schema.Types.ObjectId,
            ref: 'Transaction',
            default: null
        },
        status_setor_rw: {
            type: String,
            enum: ['done', 'pending', 'not required'],
            default: 'pending'
        },
        fee_setor_rw: {
            type: Number,
            default: 0
        },
        tanggal_setor_rw: {
            type: Date,
            default: null
        },
        setor_rw_id:{
            type: Schema.Types.ObjectId,
            ref: 'SetorRW',
            default: null
        }
    }]
    
});

const House = mongoose.model('House', HouseSchema);
module.exports = House;