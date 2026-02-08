const express = require("express");
const cors = require("cors");

const healthRoutes = require("./routes/health");
const authRoutes = require("./routes/auth");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api", healthRoutes);

app.get("/api/test", (req, res) => {
  res.json({ message: "API working! SafeRide ready" });
});

module.exports = app;
