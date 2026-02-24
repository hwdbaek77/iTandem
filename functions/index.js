const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");

// Initialize Firebase Admin
admin.initializeApp();

// Get Firestore instance
// Using standard (default) database because MongoDB-compatible database
// requires additional Firestore API configuration that isn't available via console
const db = admin.firestore();

// Configure Firestore settings
db.settings({
  ignoreUndefinedProperties: true,
});

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
const adminAuthRoutes = require("./routes/admin-auth");
const adminPanelRoutes = require("./routes/admin-panel");

// Use routes
app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/canvas", canvasRoutes);
app.use("/health", healthRoutes);
app.use("/admin-auth", adminAuthRoutes);
app.use("/admin-panel", adminPanelRoutes);

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "iTandem API v2.0.0 (Functions v2, Node.js 22)",
    status: "operational",
    database: "Firestore (default)",
    endpoints: {
      auth: "/auth - User authentication",
      users: "/users - User management",
      canvas: "/canvas - Canvas LMS integration",
      health: "/health - Platform health checks",
      adminAuth: "/admin-auth - Admin panel authentication",
      adminPanel: "/admin-panel - Admin panel operations",
    },
    documentation: "See API_ROUTES.md for full endpoint details",
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

// Export the API as a Firebase Function v2
exports.apiv2 = onRequest(
  {
    cors: true,
    timeoutSeconds: 60,
    memory: "256MiB",
  },
  app
);
