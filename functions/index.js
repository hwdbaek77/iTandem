const functions = require("firebase-functions");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");

// Initialize Firebase Admin
admin.initializeApp();

// Initialize Express app
const app = express();

// Middleware
app.use(cors({ origin: true }));
app.use(express.json());

// Import routes
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const canvasRoutes = require("./routes/canvas");
const healthRoutes = require("./routes/health");

// Use routes
app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/canvas", canvasRoutes);
app.use("/health", healthRoutes);

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "iTandem API v1.0.0",
    status: "operational",
    endpoints: {
      auth: "/auth",
      users: "/users",
      canvas: "/canvas",
      health: "/health",
    },
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(err.status || 500).json({
    error: {
      message: err.message || "Internal server error",
      status: err.status || 500,
    },
  });
});

// Export the API as a Firebase Function
exports.api = functions.https.onRequest(app);
