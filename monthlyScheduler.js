const fs = require('fs');
const path = require('path');

// Function to load environment variables
function loadEnvVariables() {
  // Load general .env file
  require('dotenv').config();

  // Load specific environment file
  const envFile = process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development';
  const envFilePath = path.resolve(process.cwd(), envFile);

  if (fs.existsSync(envFilePath)) {
    require('dotenv').config({ path: envFilePath });
  } else {
    console.warn(`Environment file ${envFile} does not exist`);
  }
}

loadEnvVariables();


const cron = require('node-cron');
const mongoose = require('mongoose');
const House = require('./models/house'); // Sesuaikan path ke model House

async function createMonthlyFeesForNextYear() {
    try {
        const currentYear = new Date().getFullYear();
        const houses = await House.find();

        for (const house of houses) {
            for (let month = 1; month <= 12; month++) {
                const monthString = `${currentYear}-${String(month).padStart(2, '0')}`;
                const existingFeeIndex = house.monthly_fees.findIndex(fee => fee.month === monthString);

                if (existingFeeIndex === -1) {
                    house.monthly_fees.push({
                        month: monthString,
                        fee: house.fee,
                        status: 'Belum Bayar',
                        transaction_id: null
                    });
                }
            }

            await house.save();
        }

        //console.log('Monthly fees for the next year created successfully.');
    } catch (error) {
        console.error('Error creating monthly fees for next year:', error);
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

        // Jalankan sekali untuk tahun ini
        createMonthlyFeesForNextYear();

        // Jalankan setiap tahun
        cron.schedule('0 0 1 1 *', () => {
            console.log('Running cron job at', new Date());
            createMonthlyFeesForNextYear();
        });
    })
    .catch(err => {
        console.error('Error connecting to MongoDB:', err);
    });