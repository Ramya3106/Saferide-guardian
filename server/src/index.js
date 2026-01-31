const dotenv = require("dotenv");

dotenv.config();

const app = require("./app");
const connectDb = require("./config/db");

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error("Missing MONGO_URI in .env");
  process.exit(1);
}

connectDb(MONGO_URI).then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
