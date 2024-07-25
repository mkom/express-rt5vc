const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/user');
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
dotenv.config();
const router = express.Router();

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
// Generate JWT
const generateToken = (user) => {

    // return jwt.sign({ id: user._id, email: user.email, role: user.role }, process.env.JWT_SECRET, {
    //     expiresIn: process.env.JWT_EXPIRES_IN,
    // });

    return jwt.sign({ id: user._id, email: user.email}, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN,
    });
};


// login with google

router.post('/google', async (req, res) => {
    const { token } = req.body;
  
    try {
      const ticket = await client.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
  
      const { name, email, sub: googleId } = ticket.getPayload();
  
      let user = await User.findOne({ googleId });
  
      if (!user) {
        user = new User({
          googleId,
          username: name,
          email,
          role: 'user', // Default role, can be customized
        });
  
        await user.save();
      }
  
      const payload = {
        id: user.id,
        email: user.email,
      };
  
      const jwtToken = generateToken(user);
      res.status(200).json({ jwtToken, user: { id: user._id, email: user.email, role: user.role } });

    //   const jwtToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });
    //   res.json({ token: jwtToken });
      
    } catch (error) {
      console.error(error);
      res.status(500).json({ msg: 'Server error' });
    }
});

// Register a new user
router.post('/register', async (req, res) => {
    const { username, email, password, role,house_id } = req.body;

    try {
        // Check if the user already exists
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ msg: 'User already exists' });
        }

        // Handle house_id
        const houseId = house_id ? house_id : null;

        // Create a new user
        user = new User({ username, email, password, role });

        // Save the user to the database
        await user.save();

        res.status(201).json({ msg: 'User registered successfully' });
    } catch (err) {
         // Handle specific errors
        if (err.code === 11000 && err.keyPattern && err.keyPattern.username) {
        // Duplicate key error for username
        res.status(400).json({ message: 'Username already in use' });
        } else {
        // General error handling
        res.status(500).json({ message: err.message });
        }
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Login a user
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Check if the user exists
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ msg: 'Invalid credentials' });
        }

        // Check if password matches
        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid credentials' });
        }

        // Generate a token
        const token = generateToken(user);

        res.status(200).json({ token, user: { id: user._id, email: user.email, role: user.role } });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Middleware to protect routes
const protect = (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        return res.status(401).json({ msg: 'Not authorized, token missing' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        console.error(err.message);
        res.status(401).json({ msg: 'Not authorized, token failed' });
    }
};

// // Middleware to check user roles
// const checkRole = (roles) => {
//     return (req, res, next) => {
//         if (!roles.includes(req.user.role)) {
//             return res.status(403).json({ msg: 'Access denied' });
//         }
//         next();
//     };
// };



module.exports = router;
