const express = require("express");
const cors = require("cors");

const healthRoutes = require("./routes/health");
const authCoreRoutes = require("./routes/authCore");
const authRoutes = require("./routes/auth");
const dutyRoutes = require("./routes/duty");
const complaintsRoutes = require("./routes/complaints");
const alertsRoutes = require("./routes/alerts");
const repliesRoutes = require("./routes/replies");
const handoverRoutes = require("./routes/handover");
const passengerRoutes = require("./routes/passenger");
const uploadsRoutes = require("./routes/uploads");

const app = express();

app.use(cors());
app.use(express.json());

const path = require('path');
const fs = require('fs');
// Ensure uploads folder exists and serve it statically
const uploadsDir = path.resolve(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

app.use("/api/auth", authCoreRoutes);
app.use("/api", authCoreRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/duty", dutyRoutes);
app.use("/api/complaints", complaintsRoutes);
app.use("/api/alerts", alertsRoutes);
app.use("/api/replies", repliesRoutes);
app.use("/api/handover", handoverRoutes);
app.use("/api/passenger", passengerRoutes);
app.use("/api/uploads", uploadsRoutes);
app.use("/api", healthRoutes);
app.use("/", healthRoutes);

app.get("/api/test", (req, res) => {
  res.json({ message: "API working! SafeRide ready" });
});

module.exports = app;
