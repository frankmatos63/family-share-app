const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { execFile } = require('child_process');

const router = express.Router();

console.log('upload.js loaded');

const MEDIA_DB_FILE = path.join(process.cwd(), 'media-database.json');
const USERS_DB_FILE = path.join(process.cwd(), 'users.json');
const UPLOADS_DIR = path.join(process.cwd(), 'public/uploads');
const THUMBS_DIR = path.join(process.cwd(), 'public/uploads/thumbs');

const ALLOWED_REACTION_IDS = [
  'laugh',
  'love',
  'smile',
  'strong',
  'like',
  'celebrate',
  'heart',
  'birthday',
  'gift',
  'clap'
];

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

if (!fs.existsSync(THUMBS_DIR)) {
  fs.mkdirSync(THUMBS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  },
});

const upload = multer({ storage });

function readJsonFile(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  const data = fs.readFileSync(filePath, 'utf8');
  if (!data.trim()) return fallback;
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

function writeUsersDB(data) {
  writeJsonFile(USERS_DB_FILE, data);
}

function requireLogin(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Not logged in' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session || !req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }
  next();
}

function safeThumbName(filename) {
  const parsed = path.parse(filename);
  return `${parsed.name}.jpg`;
}

function generateVideoThumbnail(inputPath, outputPath) {
  return new Promise((resolve) => {
    execFile(
      'ffmpeg',
      [
        '-y',
        '-ss', '00:00:01',
        '-i', inputPath,
        '-frames:v', '1',
        '-q:v', '3',
        '-vf', 'scale=640:-1',
        outputPath
      ],
      (error) => {
        if (error) {
          console.error('Video thumbnail generation failed:', error.message);
          resolve(false);
          return;
        }

        resolve(fs.existsSync(outputPath));
      }
    );
  });
}

// LOGIN
router.post('/login', async (req, res) => {
  try {
    const username = String(req.body.username || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    const users = readUsersDB();
    const user = users.find(u => u.username.toLowerCase() === username);

    if (!user) return res.status(401).json({ error: 'Invalid username or password' });

    if (user.active === false) {
      return res.status(403).json({ error: 'User is deactivated' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid username or password' });

    req.session.user = {
      id: user.id,
      username: user.username,
      displayName: user.displayName || user.username,
      role: user.role || 'user'
    };

    res.json({ success: true, user: req.session.user });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// REGISTER
router.post('/register', requireLogin, requireAdmin, async (req, res) => {
  try {
    const username = String(req.body.username || '').trim().toLowerCase();
    const password = String(req.body.password || '').trim();
    const displayName = String(req.body.displayName || '').trim() || username;

    const users = readUsersDB();

    if (users.some(u => u.username === username)) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const newUser = {
      id: users.length ? Math.max(...users.map(u => u.id)) + 1 : 1,
      username,
      displayName,
      role: 'user',
      active: true,
      password: await bcrypt.hash(password, 10)
    };

    users.push(newUser);
    writeUsersDB(users);

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Register failed' });
  }
});

// RESET PASSWORD
router.post('/reset-password', requireLogin, requireAdmin, async (req, res) => {
  try {
    const username = String(req.body.username || '').trim().toLowerCase();
    const password = String(req.body.password || '').trim();

    const users = readUsersDB();
    const user = users.find(u => u.username === username);

    if (!user) return res.status(404).json({ error: 'User not found' });

    user.password = await bcrypt.hash(password, 10);
    writeUsersDB(users);

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Reset failed' });
  }
});

// DEACTIVATE
router.post('/deactivate-user', requireLogin, requireAdmin, (req, res) => {
  const username = req.body.username;
  const users = readUsersDB();
  const user = users.find(u => u.username === username);

  if (!user) return res.status(404).json({ error: 'User not found' });

  if (req.session.user.username === username) {
    return res.status(400).json({ error: 'Cannot deactivate yourself' });
  }

  user.active = false;
  writeUsersDB(users);

  res.json({ success: true });
});

// REACTIVATE
router.post('/reactivate-user', requireLogin, requireAdmin, (req, res) => {
  const username = req.body.username;
  const users = readUsersDB();
  const user = users.find(u => u.username === username);

  if (!user) return res.status(404).json({ error: 'User not found' });

  user.active = true;
  writeUsersDB(users);

  res.json({ success: true });
});

// USERS
router.get('/users', requireLogin, requireAdmin, (req, res) => {
  const users = readUsersDB();

  res.json(users.map(u => ({
    username: u.username,
    displayName: u.displayName,
    role: u.role || 'user',
    active: u.active !== false
  })));
});

// LOGOUT
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

// CURRENT USER
router.get('/me', (req, res) => {
  if (!req.session?.user) return res.json({ loggedIn: false });
  res.json({ loggedIn: true, user: req.session.user });
});

// UPLOAD
router.post('/upload', requireLogin, upload.array('files', 25), async (req, res) => {
  try {
    const mediaDB = readMediaDB();

    const caption = String(req.body.title || '').trim();
    const album = String(req.body.album || '').trim();

    for (const file of req.files) {
      const isImage = file.mimetype.startsWith('image/');
      const isVideo = !isImage;

      let thumbnailUrl = '';

      if (isVideo) {
        const thumbName = safeThumbName(file.filename);
        const inputPath = file.path;
        const outputPath = path.join(THUMBS_DIR, thumbName);

        const created = await generateVideoThumbnail(inputPath, outputPath);

        if (created) {
          thumbnailUrl = `/uploads/thumbs/${thumbName}`;
        }
      }

      mediaDB.push({
        id: Date.now() + Math.random(),
        url: `/uploads/${file.filename}`,
        type: isImage ? 'image' : 'video',
        title: caption,
        description: '',
        album,
        uploadedAt: new Date().toISOString(),
        uploadedBy: req.session.user.username,
        uploadedByName: req.session.user.displayName,
        thumbnailUrl,
        comments: [],
        reactions: {}
      });
    }

    writeMediaDB(mediaDB);
    res.json({ success: true });

  } catch (err) {
    console.error('Upload failed:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// MEDIA
router.get('/media', requireLogin, (req, res) => {
  res.json(readMediaDB());
});

// REACT TO MEDIA
router.post('/media/:id/react', requireLogin, (req, res) => {
  const reactionId = String(req.body.reactionId || '').trim();
  const username = req.session.user.username;

  if (!ALLOWED_REACTION_IDS.includes(reactionId)) {
    return res.status(400).json({ error: 'Invalid reaction' });
  }

  const mediaDB = readMediaDB();
  const item = mediaDB.find(m => m.id == req.params.id);

  if (!item) return res.status(404).json({ error: 'Media not found' });

  if (!item.reactions || typeof item.reactions !== 'object') {
    item.reactions = {};
  }

  if (!Array.isArray(item.reactions[reactionId])) {
    item.reactions[reactionId] = [];
  }

  if (item.reactions[reactionId].includes(username)) {
    item.reactions[reactionId] = item.reactions[reactionId].filter(u => u !== username);
  } else {
    item.reactions[reactionId].push(username);
  }

  writeMediaDB(mediaDB);

  res.json({
    success: true,
    item
  });
});

// EDIT MEDIA CAPTION
router.put('/media/:id', requireLogin, (req, res) => {
  const mediaDB = readMediaDB();
  const item = mediaDB.find(m => m.id == req.params.id);

  if (!item) return res.status(404).json({ error: 'Media not found' });

  const isOwner = item.uploadedBy === req.session.user.username;
  const isAdmin = req.session.user.role === 'admin';

  if (!isOwner && !isAdmin) {
    return res.status(403).json({ error: 'Not allowed' });
  }

  item.title = String(req.body.title || '').trim();

  writeMediaDB(mediaDB);

  res.json({
    success: true,
    item
  });
});

// DELETE
router.delete('/media/:id', requireLogin, (req, res) => {
  const mediaDB = readMediaDB();
  const item = mediaDB.find(m => m.id == req.params.id);

  if (!item) return res.status(404).json({ error: 'Not found' });

  if (item.uploadedBy !== req.session.user.username) {
    return res.status(403).json({ error: 'Not allowed' });
  }

  writeMediaDB(mediaDB.filter(m => m.id != req.params.id));
  res.json({ success: true });
});

module.exports = router;
