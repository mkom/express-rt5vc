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
    fee: {
        type: Number,
        default: 70000, 
        required: true
    },
    occupancy_status: {
        type: String,
        enum: ['Kosong', 'Isi', 'Weekend', 'Tidak ada kontak'],
        required: true
    },
    monthly_fees: [{
        month: {
            type: String,
            required: true,
        },
        fee: {
            type: Number,
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