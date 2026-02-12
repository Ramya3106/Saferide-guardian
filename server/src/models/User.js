const mongoose = require("mongoose");
const crypto = require("crypto");

// Encryption configuration
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-cbc';

// Encryption helper functions
function encrypt(text) {
  if (!text) return text;
  try {
    const iv = crypto.randomBytes(16);
    const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex');
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    return text;
  }
}

function decrypt(text) {
  if (!text || !text.includes(':')) return text;
  try {
    const parts = text.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const key = Buffer.from(ENCRYPTION_KEY.slice(0, 64), 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    return text;
  }
}

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
      set: encrypt,
      get: decrypt,
    },
    professionalId: {
      type: String,
      index: true,
      set: encrypt,
      get: decrypt,
    },
    officialEmail: {
      type: String,
      lowercase: true,
      set: encrypt,
      get: decrypt,
    },
    role: {
      type: String,
      required: true,
      enum: ["Passenger", "Driver/Conductor", "Cab/Auto", "TTR/RPF/Police"],
    },
    password: {
      type: String,
      required: true,
      select: false, // Never return password in queries by default
    },
    // Passenger specific
    travelNumber: {
      type: String,
      set: encrypt,
      get: decrypt,
    },
    travelName: String,
    travelType: String,
    travelRoute: String,
    travelTiming: String,
    driverName: String,
    conductorName: String,

    // Staff specific
    vehicleNumber: {
      type: String,
      set: encrypt,
      get: decrypt,
    },
    dutyRoute: String,
    shiftTiming: String,
    fromStop: String,
    toStop: String,

    // Official duty details (highly sensitive)
    pnrRange: {
      type: String,
      set: encrypt,
      get: decrypt,
    },
    jurisdiction: {
      type: String,
      set: encrypt,
      get: decrypt,
    },

    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "approved",
    },
    approvalRequestedAt: Date,

    isVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },

    // Password reset fields
    resetPasswordToken: String,
    resetPasswordExpires: Date,
  },
  {
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true },
  },
);

// Index for faster queries
userSchema.index({ role: 1, approvalStatus: 1 });
userSchema.index({ email: 1, role: 1 });

// Pre-save hook to ensure password is never accidentally exposed
userSchema.pre('save', function(next) {
  if (this.isModified('password')) {
    // Password should already be hashed by bcrypt in the route
    this.select('+password');
  }
  next();
});

// Method to safely return user data without sensitive fields
userSchema.methods.toSafeObject = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.resetPasswordToken;
  delete obj.resetPasswordExpires;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("User", userSchema);
