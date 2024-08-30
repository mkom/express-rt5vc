const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const transactionSchema = new Schema({
    house_id: {
        type: Schema.Types.ObjectId,
        ref: 'House',
    },
    transaction_type: {
        type: String,
        enum: ['income', 'expense', 'ipl'],
        required: true
    },
    payment_type: {
        type: String,
        enum: ['cash', 'transfer'],
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    additional_note_mutasi_bca: {
        type: String,
    },
    date: {
        type: Date,
        default: Date.now
    },
    proof_of_transfer: {
        type: String,
        default: null
    },
    related_months: [{
        type: String
    }],
    created_at: {
        type: Date,
        default: Date.now
    },
    status: {
        type: String,
        enum: ['berhasil', 'gagal', 'sedang dicek'],
        //default: 'sedang dicek'
    },
    created_by: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    }],
});

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;
