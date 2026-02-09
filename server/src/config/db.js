const mongoose = require("mongoose");

const connectDb = async (mongoUri) => {
  try {
    await mongoose.connect(mongoUri, {
      autoIndex: true,
    });
    console.log("MongoDB connected");
  } catch (error) {
    console.error("MongoDB connection error:", error.message);
    throw error;
  }
};

module.exports = connectDb;
