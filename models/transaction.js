const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const transactionSchema = new Schema({
    transaction_id: {
        type: String,
        unique: true, // memastikan ID unik
    },

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

     attachment: {
        attachment_title: { type: String },
        attachment_url: { type: String }
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

    
    reason_cancellation: {
        type: String,
    },

    whatsapp_notification: {
        type: String,
        default: null,
      },
});

// Pre-save hook untuk mengenerate transaction_id dengan tanggal
transactionSchema.pre('save', async function (next) {
    if (!this.transaction_id) {
        const currentDate = new Date();
        const formattedDate = currentDate.toISOString().slice(0, 10).replace(/-/g, ''); // Format YYYYMMDD
        const count = await this.constructor.countDocuments(); // Hitung dokumen yang ada
        this.transaction_id = `TRX${formattedDate}${count + 1}`; // Buat ID unik
    }
    next();
});

module.exports = mongoose.model('Transaction', transactionSchema);
