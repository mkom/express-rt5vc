const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { Schema } = mongoose;

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  googleId:{ type: String, unique: true},
  password: { type: String, required: function() { return !this.googleId; } },
  role: { type: String, required: true, enum: ['user', 'admin','superadmin','editor', 'visitor'], default: 'visitor' },
  house_id: { type: Schema.Types.ObjectId, ref: 'House', default: null },
});

// Encrypt the password before saving the user
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Method to compare passwords
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);