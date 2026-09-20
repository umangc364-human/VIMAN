const express = require("express");
const path = require("path");

const app = express();

const PORT = 3000;

// Serve all VIMAN files
app.use(express.static(__dirname));

// Start server
app.listen(PORT, () => {
  console.log("");
  console.log("=================================");
  console.log("       VIMAN IS RUNNING");
  console.log("=================================");
  console.log("");
  console.log(`Open: http://localhost:${PORT}`);
  console.log("");
});