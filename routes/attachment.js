const express = require('express');
const router = express.Router();
const multer = require('multer');
const { google } = require('googleapis');
const stream = require('stream');
// Setup Google Drive API
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const REFRESH_TOKEN = process.env.REFRESH_TOKEN;
const FOLDER_ID = process.env.GOOGLE_FOLDER_ID_ATC;

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

//console.log('toekn'+ REFRESH_TOKEN)

oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

const drive = google.drive({
  version: 'v3',
  auth: oauth2Client,
});

// Multer setup with memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Update route for multiple file uploads
router.post('/', upload.array('file', 10), async (req, res) => {
  if (!req.file || req.files.length === 0) {
    return res.status(400).send('No file uploaded.');
  }

  try {
    const fileUrls = [];
    
    for (const file of req.files) {
      const fileMetadata = {
        name: file.originalname,
        parents: [FOLDER_ID],
      };

      const bufferStream = new stream.PassThrough();
      bufferStream.end(file.buffer);

      const media = {
        mimeType: file.mimetype,
        body: bufferStream,
      };

      const response = await drive.files.create({
        requestBody: fileMetadata,
        media: media,
        fields: 'id',
      });

      const fileId = response.data.id;

      await drive.permissions.create({
        fileId: fileId,
        requestBody: {
          role: 'reader',
          type: 'anyone',
        },
      });

      const fileUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
      fileUrls.push(fileUrl);  // Add file URL to array
    }

    // Return all file URLs
    res.status(200).send({ fileUrls });

  } catch (error) {
    console.error('Error uploading files:', error.message);
    res.status(500).send({ error: 'Error uploading files.' });
  }
});

module.exports = router;
