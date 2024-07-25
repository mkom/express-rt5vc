require('dotenv').config(); // Load environment variables from .env file
const cors = require('cors');
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const app = express();

const upload = require('./config/multerConfig');

// Routes
const userRoutes = require('./routes/users'); // Load your routes
const authRoutes  = require('./routes/auth');
const housesRouter = require('./routes/houses');
const transactionsRouter = require('./routes/transactions');
const uploadRouter = require('./routes/upload');

// Middleware
const protect = require('./routes/protect');
const checkRole = require('./routes/checkRole');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Could not connect to MongoDB', err));

// Middleware to parse JSON requests
app.use(express.json());

// Middleware
app.use(bodyParser.json());
app.use(cors());

app.use('/api/v1/users', userRoutes); 
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/houses', housesRouter);
app.use('/api/v1/transactions', transactionsRouter);

app.use('/api/v1/upload', uploadRouter);


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

app.use('/api', protect); // Apply protect middleware to all routes under /api

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

// Start the server
const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
