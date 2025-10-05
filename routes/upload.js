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
const FOLDER_ID = process.env.GOOGLE_FOLDER_ID;

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

// Multer setup with memory storage - updated to support multiple files
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
    files: 10 // Maximum 10 files
  }
});

// Function to upload single file to Google Drive
async function uploadSingleFileToGoogleDrive(file) {
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

  const result3 = await drive.files.get({
    fileId: fileId,
    fields: 'webViewLink',
  });

  // Generate accessible URL
  const fileUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
  
  return {
    originalName: file.originalname,
    fileId: fileId,
    fileUrl: fileUrl,
    mimeType: file.mimetype,
    size: file.size
  };
}

// Route untuk multiple files upload
router.post('/multiple', upload.array('files', 10), async (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).send({ error: 'No files uploaded.' });
  }

  try {
    const uploadPromises = req.files.map(file => uploadSingleFileToGoogleDrive(file));
    const uploadResults = await Promise.all(uploadPromises);

    res.status(200).send({ 
      message: `${uploadResults.length} file(s) uploaded successfully`,
      files: uploadResults,
      fileUrls: uploadResults.map(result => result.fileUrl) // Array of URLs for easy access
    });

  } catch (error) {
    console.error('Error uploading files:', error.message);
    res.status(500).send({ error: 'Error uploading files.' });
  }
});

// Original single file upload route (unchanged for backward compatibility)
router.post('/', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }

  try {
    const fileMetadata = {
      name: req.file.originalname,
      parents: [FOLDER_ID],
    };

    const bufferStream = new stream.PassThrough();
    bufferStream.end(req.file.buffer);

    const media = {
      mimeType: req.file.mimetype,
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

    const result3 = await drive.files.get({
      fileId: fileId,
      fields: 'webViewLink',
    });

    // Generate accessible URL
    const fileUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;
    res.status(200).send({ fileUrl: fileUrl });

  } catch (error) {
    console.error('Error uploading file:', error.message);
    res.status(500).send({ error: 'Error uploading file.' });
  }
});

module.exports = router;
