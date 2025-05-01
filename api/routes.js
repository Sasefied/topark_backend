const express = require("express");

const router = express.Router();

router.get("/", (req, res) => {
  res.json({ message: "Welcome to the Topark Backend" });
});

router.get("/health", (req, res) => {
  res.status(200).json({ status: "UP" });
});

module.exports = router;
