const dotenv = require("dotenv");

dotenv.config();

const app = require("./app");
const connectDb = require("./config/db");

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/saferide";

const startServer = async () => {
  try {
    await connectDb(MONGO_URI);
    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    server.on("error", (error) => {
      if (error?.code === "EADDRINUSE") {
        console.log(
          `Server is already running on port ${PORT}. Reusing existing instance.`,
        );
        process.exit(0);
      } else {
        console.error("Server startup error:", error.message);
        process.exit(1);
      }
    });
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
};

startServer();
