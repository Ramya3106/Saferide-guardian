const express = require("express");
const http = require("http");

const app = express();
const PORT = 5000;

console.log("1. Creating HTTP server...");
const server = http.createServer(app);

console.log("2. Adding routes...");
app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

console.log("3. Starting listen...");
server.on("listening", () => {
  console.log("EVENT: listening emitted");
});

server.on("error", (err) => {
  console.error("EVENT: error -", err.message);
});

const listener = server.listen(PORT);

console.log("4. Listener created");
console.log("5. Listener state:", listener.listening);
console.log("6. Address:", listener.address());

setTimeout(() => {
  console.log("7. After 2s - listening?", listener.listening);
  console.log("8. Address:", listener.address());
}, 2000);
