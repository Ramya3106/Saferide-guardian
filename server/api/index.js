const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const app = require("../src/app");
const connectDb = require("../src/config/db");
const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/saferide";

// Connect to MongoDB if not already connected
// This ensures that the database is connected when Vercel spins up a serverless function instance
const initDb = async () => {
  if (mongoose.connection.readyState >= 1) {
    return;
  }
  try {
    await connectDb(MONGO_URI);
  } catch (error) {
    console.error("Failed to connect MongoDB in Vercel handler:", error.message);
  }
};

// Middleware to ensure database connection before processing API requests
app.use(async (req, res, next) => {
  await initDb();
  next();
});

module.exports = app;
