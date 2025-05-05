// const express = require("express");
// const router = express.Router();

// router.get("/", (req, res) => {
//   res.json({ message: "Welcome to the Topark Backend" });
// });

// router.get("/health", (req, res) => {
//   res.status(200).json({ status: "UP" });
// });

// module.exports = router;

const express = require("express");
const router = express.Router();

// Root & health check routes
router.get("/", (req, res) => {
  res.json({ message: "Welcome to the Topark Backend" });
});

router.get("/health", (req, res) => {
  res.status(200).json({ status: "UP" });
});

// Modular route imports
const authRoutes = require("../routes/authRoutes");
const userRoutes = require("../routes/userRoutes");
const clientRoutes = require("../routes/clientRoutes");
const dashboardRoutes = require("../routes/dashboardRoutes");

// Mount the modular routes
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/clients", clientRoutes);
router.use("/dashboard", dashboardRoutes);

module.exports = router;
