const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true, unique: true },
  email: { type: String, sparse: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ["passenger", "driver", "conductor", "ttr", "rpf", "police", "admin"],
    default: "passenger",
  },
  vehicleId: String, // For transport staff
  stationId: String, // For RPF/Police
  fcmToken: String, // For push notifications
  isVerified: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
