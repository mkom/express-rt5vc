const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('./cloudinaryConfig');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'uploads', // Nama folder di Cloudinary
    allowed_formats: ['jpg', 'png', 'pdf'], // Jenis file yang diizinkan
    public_id: (req, file) => {
        const fileExtension = file.originalname.split('.').pop();
        const uniqueSuffix = uuidv4();
        const date = moment().format('YYYYMMDD');
        const fileName = file.originalname.replace(`.${fileExtension}`, '');
        return `${fileName}-${date}-${uniqueSuffix}`;
      },
  },
});

const upload = multer({ storage: storage });

module.exports = upload;
