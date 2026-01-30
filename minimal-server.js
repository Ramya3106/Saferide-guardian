const express = require("express");
const cors = require("cors");
const http = require("http");

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

// Simple health check
app.get("/api/health", (req, res) => {
  res.json({ status: "Running", time: new Date() });
});

const PORT = 5000;

server
  .listen(PORT, "127.0.0.1", () => {
    console.log(`✓ MINIMAL SERVER running on port ${PORT}`);
    console.log(`✓ Test: http://localhost:${PORT}/api/health`);
  })
  .on("error", (err) => {
    console.error("Server error:", err);
    process.exit(1);
  });

process.on("uncaughtException", (err) => {
  console.error("Exception:", err);
  process.exit(1);
});
