require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const authRoutes = require("./routes/auth");
const complaintRoutes = require("./routes/complaints");
const alertRoutes = require("./routes/alerts");
const trackingRoutes = require("./routes/tracking");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

// Middleware
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

// Socket.io for real-time updates
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("join-complaint", (complaintId) => {
    socket.join(`complaint-${complaintId}`);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

app.set("io", io);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/complaints", complaintRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/tracking", trackingRoutes);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "SafeRide Guardian API Running",
    timestamp: new Date().toISOString(),
  });
});

const PORT = process.env.PORT || 5000;
const MONGO_URI =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  "mongodb://localhost:27017/saferide";

// Start server
const startServer = () => {
  server
    .listen(PORT, () => {
      console.log("\n✓✓✓ SafeRide Guardian SERVER STARTED ✓✓✓");
      console.log(`✓ Listening on port ${PORT}`);
      console.log(`✓ Test URL: http://localhost:${PORT}/api/health`);
      console.log("✓✓✓ Server is READY for requests ✓✓✓\n");
    })
    .on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.error(`\n❌ Port ${PORT} already in use!\n`);
        process.exit(1);
      }
      console.error("❌ Server error:", err);
      process.exit(1);
    });
};

// Handle errors
process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("❌ Unhandled Rejection:", reason);
  process.exit(1);
});

// Connect MongoDB then start server
console.log("Starting SafeRide Guardian...");
mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("✓ MongoDB connected");
    startServer();
  })
  .catch((err) => {
    console.warn("⚠️  MongoDB error:", err.message);
    console.warn("Starting server without database...");
    startServer();
  });
