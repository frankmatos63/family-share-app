const express = require('express');
const path = require('path');
const session = require('express-session');
const apiRoutes = require('./routes/upload');

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'fam-media-dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: false,
    maxAge: 1000 * 60 * 60 * 24
  }
}));

// Block direct public access to uploaded media.
// Media should eventually be served through protected API routes.
//app.use('/uploads', (req, res) => {
//  res.status(403).send('Forbidden');
//});

app.use('/uploads', express.static('public/uploads'));

// Serve static files from public folder
app.use(express.static('public'));

// Mount API routes
console.log('Mounting API routes...');
app.use('/api', apiRoutes);

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
