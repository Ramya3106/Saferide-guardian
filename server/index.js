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

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "SafeRide Guardian API Running", timestamp: new Date() });
});

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/saferide";

// Start server even if MongoDB fails (for testing)
const startServer = () => {
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`SafeRide Guardian server running on port ${PORT}`);
    console.log(`Server accessible at http://localhost:${PORT}`);
    console.log(`For Android emulator: http://10.0.2.2:${PORT}`);
    console.log(`For physical devices: http://10.168.37.29:${PORT}`);
  });
};

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");
    startServer();
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    console.warn("⚠️  Starting server WITHOUT database - API calls will fail!");
    console.warn("Please install MongoDB or use MongoDB Atlas");
    startServer();
  });
