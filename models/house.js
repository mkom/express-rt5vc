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
    // auto_bill_date: {
    //     type: Number,
    //     default: 10, // Example default value, you can adjust as needed
    // },
    mandatory_fee: {
        type: Boolean,
        default: true,
    },
    group: {
        type: String,
        default: null,
    },
    Ipl_fee: {
        type: Number,
        default: 50000, 
        required: true
    },
    Rt_fee: {
        type: Number,
        default: 20000, 
        required: true
    },
    occupancy_status: {
        type: String,
        enum: ['Kosong', 'Isi', 'Weekend', 'Tidak ada kontak'],
        required: true
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
            enum: ['Lunas', 'Belum Bayar', 'Bayar Sebagian', "TBD"],
            default: 'Belum Bayar'
        },
        transaction_id: {
            type: Schema.Types.ObjectId,
            ref: 'Transaction',
            default: null
        }
    }]
    
});

const House = mongoose.model('House', HouseSchema);
module.exports = House;