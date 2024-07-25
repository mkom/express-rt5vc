const express = require('express');
const router = express.Router();
const Upload = require('../models/upload');
const upload = require('../config/multerConfig');

const saveUpload = async (title, url) => {
    try {
        const newUpload = new Upload({
            title,
            url,
        });
        await newUpload.save();
        console.log('Upload saved successfully');
    } catch (error) {
        console.error('Error saving upload:', error);
    }
};

router.post('/', upload.single('file'), async(req, res) => {
    try {
        const file = req.file;
    
        if (!file) {
          return res.status(400).send('No file uploaded.');
        }
        res.status(200).json({
          success: true,
          message: 'File uploaded successfully',
          url: file.path // URL file yang diunggah di Cloudinary
        });
        saveUpload(file.originalname, file.path); 
      } catch (err) {
        res.status(500).json({
          success: false,
          message: 'File upload failed',
          error: err.message
        });
      }
});
module.exports = router;
