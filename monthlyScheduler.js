require('dotenv').config();
const cron = require('node-cron');
const mongoose = require('mongoose');
const House = require('./models/house'); // Sesuaikan path ke model House

async function createMonthlyFeesForNewMonth() {
    try {
        const currentMonth = new Date().toISOString().slice(0, 7);
        const houses = await House.find();

        for (const house of houses) {
            const existingFeeIndex = house.monthly_fees.findIndex(fee => fee.month === currentMonth);

            if (existingFeeIndex === -1) {
                house.monthly_fees.push({
                    month: currentMonth,
                    fee: house.fee,
                    status: 'Belum Bayar',
                    transaction_id: null
                });

                await house.save();
            }
        }

        console.log('Monthly fees for the new month created successfully.');
    } catch (error) {
        console.error('Error creating monthly fees for new month:', error);
    }
}

const uri = process.env.MONGODB_URI;

if (!uri) {
    console.error('MONGODB_URI is not defined in .env file');
    process.exit(1);
}

mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverSelectionTimeoutMS: 30000 })
    .then(() => {
      // console.log('Connected to MongoDB');

        
        cron.schedule('0 0 1 * *', () => {
            console.log('Running cron job at', new Date());
            createMonthlyFeesForNewMonth();
        });
    })
    .catch(err => {
        console.error('Error connecting to MongoDB:', err);
    });
