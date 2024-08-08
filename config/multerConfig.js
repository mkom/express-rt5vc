// const multer = require('multer');
// const { CloudinaryStorage } = require('multer-storage-cloudinary');
// const cloudinary = require('./cloudinaryConfig');
// const { v4: uuidv4 } = require('uuid');
// const moment = require('moment');

// const storage = new CloudinaryStorage({
//   cloudinary: cloudinary,
//   params: {
//     folder: 'uploads', // Nama folder di Cloudinary
//     allowed_formats: ['jpg', 'png', 'pdf', 'jpeg'], // Jenis file yang diizinkan
//     public_id: (req, file) => {
//         const fileExtension = file.originalname.split('.').pop();
//         const uniqueSuffix = uuidv4();
//         const date = moment().format('YYYYMMDD');
//         const fileName = file.originalname.replace(`.${fileExtension}`, '');
//         return `${fileName}-${date}-${uniqueSuffix}`;
//       },
//   },
// });

// const upload = multer({ storage: storage });

// module.exports = upload;

const multer = require('multer');
const path = require('path');

// Set storage engine
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Path to save uploaded files
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + ext); // Generate a unique filename
  }
});

// Create multer instance
const upload = multer({ storage });

module.exports = upload;
