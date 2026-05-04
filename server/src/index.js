const path = require("path");
const dotenv = require("dotenv");
const http = require("http");
const { Server } = require("socket.io");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const app = require("./app");
const connectDb = require("./config/db");
const { setIo } = require("./utils/socket");

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/saferide";
const configuredEmailUser =
  process.env.RESET_EMAIL_USER || process.env.EMAIL_USER || "divyadharshana3@gmail.com";
const configuredEmailPass =
  process.env.RESET_EMAIL_PASS ||
  process.env.EMAIL_PASS ||
  process.env.GMAIL_APP_PASSWORD ||
  "";

const isExistingSafeRideServer = () =>
  new Promise((resolve) => {
    const request = http.get(
      {
        hostname: "127.0.0.1",
        port: PORT,
        path: "/health",
        timeout: 1500,
      },
      (response) => {
        let body = "";
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          try {
            const parsed = JSON.parse(body);
            const isSafeRideHealth =
              response.statusCode === 200 &&
              parsed?.service === "saferide-guardian-api";
            resolve(isSafeRideHealth);
          } catch {
            resolve(false);
          }
        });
      },
    );

    request.on("error", () => resolve(false));
    request.on("timeout", () => {
      request.destroy();
      resolve(false);
    });
  });

const startServer = async () => {
  if (!MONGO_URI) {
    console.error("Missing MONGO_URI in .env. Backend requires MongoDB.");
    process.exit(1);
  }

  try {
    await connectDb(MONGO_URI);
  } catch (error) {
    console.error("Failed to connect MongoDB:", error.message);
    process.exit(1);
  }

  if (!String(configuredEmailPass || "").trim()) {
    console.warn(
      `Email OTP disabled: set RESET_EMAIL_PASS, EMAIL_PASS, or GMAIL_APP_PASSWORD for ${configuredEmailUser}.`,
    );
  }

  console.log(`Server running on port ${PORT}`);
  
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      credentials: true,
    },
  });

  setIo(io);

  io.on("connection", (socket) => {
    socket.on("join:passenger", (passengerId) => {
      if (passengerId) {
        socket.join(`passenger:${String(passengerId)}`);
      }
    });

    socket.on("join:officer", (officerId) => {
      if (officerId) {
        socket.join(`officer:${String(officerId)}`);
      }
    });

    socket.on("join:complaint", (complaintId) => {
      if (complaintId) {
        socket.join(`complaint:${String(complaintId)}`);
      }
    });
  });

  server.listen(PORT, () => {
    // Server is listening
  });

  server.on("error", async (error) => {
    if (error?.code === "EADDRINUSE") {
      const alreadyRunningSafeRide = await isExistingSafeRideServer();
      if (alreadyRunningSafeRide) {
        process.exit(0);
      }

      console.error(`Port ${PORT} is already in use by another process.`);
      process.exit(1);
    } else {
      console.error("Server startup error:", error.message);
      process.exit(1);
    }
  });
};

startServer();
