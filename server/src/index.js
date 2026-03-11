const dotenv = require("dotenv");

dotenv.config();

const app = require("./app");
const connectDb = require("./config/db");

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

server.on("error", (error) => {
  if (error?.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Stop the existing server before starting a new one.`);
    process.exit(1);
  }

  console.error("Server startup error:", error.message);
  process.exit(1);
});

if (!MONGO_URI) {
  console.warn("Missing MONGO_URI in .env. Skipping database connection.");
} else {
  connectDb(MONGO_URI).catch((error) => {
    console.warn("Continuing without database connection.");
    console.warn("MongoDB error:", error.message);
  });
}
