const dotenv = require("dotenv");

dotenv.config();

const app = require("./app");
const connectDb = require("./config/db");

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

if (!MONGO_URI) {
  console.warn("Missing MONGO_URI in .env. Skipping database connection.");
} else {
  connectDb(MONGO_URI).catch(() => {
    console.warn("Continuing without database connection.");
  });
}
