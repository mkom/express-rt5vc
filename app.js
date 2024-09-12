const fs = require('fs');
const path = require('path');

// Function to load environment variables
function loadEnvVariables() {
  // Load general .env file
  require('dotenv').config();

  // Load specific environment file
  const envFile = `.env.${process.env.NODE_ENV}`;
  const envFilePath = path.resolve(process.cwd(), envFile);

  if (fs.existsSync(envFilePath)) {
    require('dotenv').config({ path: envFilePath });
  } else {
    console.warn(`Environment file ${envFile} does not exist`);
  }
}



const cors = require('cors');
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');

const upload = require('./config/multerConfig');

// Routes
const userRoutes = require('./routes/users'); // Load your routes
const authRoutes  = require('./routes/auth');
const housesRouter = require('./routes/houses');
const transactionsRouter = require('./routes/transactions');
const uploadRouter = require('./routes/upload');
const iplRouter = require('./routes/ipl');
const ipl2Router = require('./routes/ipl2');
const reportRouter = require('./routes/report');

// Middleware
const protect = require('./routes/protect');
const checkRole = require('./routes/checkRole');


loadEnvVariables();
const app = express();

// Middleware to parse JSON requests
app.use(express.json());
app.use(bodyParser.json());

// CORS configuration
const corsOptions = {
  origin: ['https://rt5vc.vercel.app', 'http://localhost:3000'], // Replace with your allowed origin
  methods: 'GET, POST, PUT, DELETE, OPTIONS',
  allowedHeaders: 'Content-Type, Authorization',
};

app.use(cors(corsOptions));

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI,{
  serverSelectionTimeoutMS: 50000 // 50 seconds
})
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Could not connect to MongoDB', err));



app.use('/api/v1/users', userRoutes); 
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/houses', housesRouter);
app.use('/api/v1/transactions', transactionsRouter);

app.use('/api/v1/upload', uploadRouter);
app.use('/api/v1/ipl', iplRouter);
app.use('/api/v1/ipl2', ipl2Router);
app.use('/api/v1/report', reportRouter);


//upload

// app.post('/api/v1/upload', upload.single('file'), (req, res) => {
//   try {
//     const file = req.file;

//     if (!file) {
//       return res.status(400).send('No file uploaded.');
//     }
//     res.status(200).json({
//       success: true,
//       message: 'File uploaded successfully',
//       url: file.path // URL file yang diunggah di Cloudinary
//     });
//   } catch (err) {
//     res.status(500).json({
//       success: false,
//       message: 'File upload failed',
//       error: err.message
//     });
//   }
// });

//app.use('/api', protect); // Apply protect middleware to all routes under /api

// Root route
app.get('/api/v1/', (req, res) => {
  res.send('Welcome to API v1'); // Replace with your desired response
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// Start the billing scheduler

require('./monthlyScheduler');

// Handle preflight requests
app.options('*', cors(corsOptions));

// Start the server
const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
