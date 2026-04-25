const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

const router = express.Router();

console.log('upload.js loaded');

const MEDIA_DB_FILE = path.join(process.cwd(), 'media-database.json');
const USERS_DB_FILE = path.join(process.cwd(), 'users.json');

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  },
});

const upload = multer({ storage: storage });

// Helpers
function readJsonFile(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  const data = fs.readFileSync(filePath, 'utf8');

  if (!data.trim()) {
    return fallback;
  }

  return JSON.parse(data);
}

function writeJsonFile(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function readMediaDB() {
  return readJsonFile(MEDIA_DB_FILE, []);
}

function writeMediaDB(data) {
  writeJsonFile(MEDIA_DB_FILE, data);
}

function readUsersDB() {
  return readJsonFile(USERS_DB_FILE, []);
}

function requireLogin(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  next();
}

// AUTH: Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const users = readUsersDB();
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    req.session.user = {
      id: user.id,
      username: user.username,
      displayName: user.displayName || user.username
    };

    res.json({
      success: true,
      user: req.session.user
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// AUTH: Logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

// AUTH: Current user
router.get('/me', (req, res) => {
  if (!req.session || !req.session.user) {
    return res.json({ loggedIn: false });
  }

  res.json({
    loggedIn: true,
    user: req.session.user
  });
});

// POST: Handle file upload
router.post('/upload', requireLogin, upload.array('files', 10), (req, res) => {
  console.log('Received files:', req.files);
  console.log('Form data:', req.body);

  if (!req.files || req.files.length === 0) {
    return res.status(400).send('No files were uploaded.');
  }

  const mediaDB = readMediaDB();

  req.files.forEach(file => {
    const mediaItem = {
      id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
      url: `/uploads/${file.filename}`,
      type: file.mimetype.startsWith('image/') ? 'image' : 'video',
      title: req.body.title || file.originalname,
      description: req.body.description || '',
      album: req.body.album || 'Fam Media',
      uploadedAt: new Date().toISOString(),
      uploadedBy: req.session.user.username,
      uploadedByName: req.session.user.displayName,
      comments: [],
      reactions: {}
    };

    mediaDB.push(mediaItem);
  });

  writeMediaDB(mediaDB);

  res.json({ success: true, message: 'Media uploaded successfully!' });
});

// GET: Retrieve all media
router.get('/media', requireLogin, (req, res) => {
  console.log('HIT /api/media');

  try {
    const mediaDB = readMediaDB();
    res.json(mediaDB);
  } catch (err) {
    console.error('Error reading media database:', err);
    res.status(500).json({ error: 'Failed to retrieve media' });
  }
});

// DELETE: Delete a media item
router.delete('/media/:id', requireLogin, (req, res) => {
  const mediaDB = readMediaDB();

  const item = mediaDB.find(media => media.id === req.params.id);

  if (!item) {
    return res.status(404).json({ error: 'Media not found' });
  }

  if (item.uploadedBy !== req.session.user.username) {
    return res.status(403).json({ error: 'You can only delete your own media' });
  }

  const filteredDB = mediaDB.filter(media => media.id !== req.params.id);
  writeMediaDB(filteredDB);

  res.json({ success: true, message: 'Media deleted' });
});

module.exports = router;
