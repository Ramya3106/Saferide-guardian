const path = require("path");
const dotenv = require("dotenv");
const http = require("http");
const { Server } = require("socket.io");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const app = require("./app");
const connectDb = require("./config/db");
const { setIo } = require("./utils/socket");
const { startAutoEscalationService } = require("./services/autoEscalationService");

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

    // Officers join their duty-unit room to receive real-time train complaint alerts
    // e.g., all TTR officers on duty join "duty:TTR" — like Rapido driver pool
    socket.on("join:duty", (dutyUnit) => {
      if (dutyUnit) {
        socket.join(`duty:${String(dutyUnit).toUpperCase()}`);
      }
    });

    socket.on("leave:duty", (dutyUnit) => {
      if (dutyUnit) {
        socket.leave(`duty:${String(dutyUnit).toUpperCase()}`);
      }
    });

    // Relay typing indicator to other participants in complaint room
    socket.on("chat:typing", (payload) => {
      try {
        if (payload && payload.complaintId) {
          socket.to(`complaint:${String(payload.complaintId)}`).emit("chat:typing", payload);
        }
      } catch (e) { /* ignore */ }
    });

    // Handle read receipts - update ChatMessage readBy and notify room
    socket.on("chat:read", async (payload) => {
      try {
        const ChatMessage = require("./models/ChatMessage");
        if (!payload) return;
        const { complaintId, messageIds, readerId } = payload;
        if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) return;
        const now = new Date();
        await ChatMessage.updateMany(
          { _id: { $in: messageIds } },
          { $push: { readBy: { userId: readerId || null, readAt: now } } }
        );
        if (complaintId) {
          socket.to(`complaint:${String(complaintId)}`).emit("chat:read", { complaintId, messageIds, readerId, readAt: now });
        }
      } catch (e) { console.error("chat:read handler error:", e.message); }
    });

    // Allow clients to send chat messages over socket (server will persist and re-emit)
    socket.on("chat:message", async (payload) => {
      try {
        const ChatMessage = require("./models/ChatMessage");
        if (!payload || !payload.complaintId) return;
        const msg = await ChatMessage.create({
          complaintId: payload.complaintId,
          senderType: payload.senderType || "PASSENGER",
          senderId: payload.senderId || null,
          senderName: payload.senderName || null,
          senderRole: payload.senderRole || null,
          messageText: payload.messageText || null,
          messageType: payload.messageType || (payload.attachmentUrl ? "image" : "text"),
          attachmentUrl: payload.attachmentUrl || null,
          quickReplyKey: payload.quickReplyKey || null,
          createdAt: new Date(),
        });

        const emitPayload = {
          complaintId: String(payload.complaintId),
          message: msg.toObject ? msg.toObject() : msg,
        };
        // Emit to complaint room and passenger/officer rooms
        socket.to(`complaint:${String(payload.complaintId)}`).emit("chat:message", emitPayload);
        // Also emit back to sender to confirm
        socket.emit("chat:message:sent", emitPayload);
      } catch (e) { console.error("chat:message handler error:", e.message); }
    });

    // Receive officer live location updates and persist + broadcast
    socket.on("location:update", async (payload) => {
      try {
        if (!payload) return;
        const LiveLocation = require("./models/LiveLocation");
        const officerKey = String(payload.officerKey || payload.senderId || payload.staffId || "").trim();
        const trainNumber = payload.trainNumber || payload.assignedTrain || null;
        const latitude = Number(payload.latitude ?? payload.lat ?? payload.latitude) || null;
        const longitude = Number(payload.longitude ?? payload.lng ?? payload.longitude) || null;
        const now = new Date();

        if (!officerKey || latitude == null || longitude == null) {
          // insufficient data
          return;
        }

        const doc = await LiveLocation.create({
          officerKey,
          trainNumber: trainNumber || null,
          latitude,
          longitude,
          accuracy: payload.accuracy || null,
          speed: payload.speed || null,
          heading: payload.heading || null,
          liveLocationSnapshot: payload || null,
          recordedAt: now,
        });

        const emitPayload = {
          officerKey,
          officerId: payload.senderId || payload.staffId || null,
          officerName: payload.senderName || null,
          trainNumber: trainNumber || null,
          latitude,
          longitude,
          accuracy: payload.accuracy || null,
          speed: payload.speed || null,
          heading: payload.heading || null,
          recordedAt: now,
        };

        // Broadcast to complaint room if provided, and to passenger and officer rooms
        if (payload.complaintId) {
          socket.to(`complaint:${String(payload.complaintId)}`).emit("location:update", emitPayload);
          try { socket.to(`passenger:${String(payload.passengerId || payload.passengerEmail)}`).emit("location:update", emitPayload); } catch(e){}
        }

        // Always emit to officer's room so other officer clients can see
        try { socket.to(`officer:${officerKey}`).emit("location:update", emitPayload); } catch(e){}
      } catch (e) {
        console.error("location:update handler error:", e.message);
      }
    });
  });

  server.listen(PORT, () => {
    console.log(`🚀 SafeRide Guardian Server running on port ${PORT}`);
    
    // Start auto-escalation service (check every 30 seconds for demo)
    startAutoEscalationService(30000);
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
