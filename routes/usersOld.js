const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');


// Login user
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  console.log(`Login attempt with email: ${email}`);

  console.log(`Request body: ${JSON.stringify(req.body)}`);

  try {
    const user = await User.findOne({ email });
    console.log(user);
    if (!user) {
        console.log(`User not found with email: ${email}`);
      return res.status(400).json({ message: 'Invalid user' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    console.log(isMatch);
    console.log(`Entered password: ${password}`);
    console.log(`Stored hashed password: ${user.password}`);
    console.log(`Password match result: ${isMatch}`);

    if (!isMatch) {
        console.log(`Incorrect password for user with email: ${email}`);
      return res.status(400).json({ message: 'Incorrect password for user with email:' });
    }

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } catch (err) {
    console.error(`Error logging in user with email ${email}: ${err.message}`);
    res.status(500).json({ message: err.message });
  }

  

  
});

// Signup user
router.post('/signup', async (req, res) => {
    const { username, email, password, role } = req.body;
  
    try {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: 'Email already in use' });
      }
  
      const hashedPassword = await bcrypt.hash(password, 10);
      const newUser = new User({ username, email, password: hashedPassword, role });
      await newUser.save();
      
      // Optionally, you can generate and return a JWT token upon signup
      const token = jwt.sign({ id: newUser._id, role: newUser.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
      
      res.status(201).json({ message: 'User registered successfully', token });
    } catch (err) {
        // Handle specific errors
        if (err.code === 11000 && err.keyPattern && err.keyPattern.username) {
        // Duplicate key error for username
        res.status(400).json({ message: 'Username already in use' });
        } else {
        // General error handling
        res.status(500).json({ message: err.message });
        }
    }
});
  

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Middleware to authenticate token
function authenticateToken(req, res, next) {
  const token = req.header('Authorization');
  if (!token) {
    return res.status(401).json({ message: 'Access denied' });
  }

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    res.status(400).json({ message: 'Invalid token' });
  }
}

// Middleware to authorize roles
function authorizeRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({ message: 'Access denied' });
    }
    next();
  }
}

// Example of a protected route for admin only
router.get('/admin', authenticateToken, authorizeRole('admin'), (req, res) => {
  res.json({ message: 'Admin content' });
});

module.exports = router;
