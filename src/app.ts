import paymentRoutes, {
  handleStripeWebhook
} from "./routes/payment.routes.js";

import adminRoutes from "./routes/admin.routes.js";
import userRoutes from "./routes/user.routes.js";
import transactionRoutes from "./routes/transaction.routes.js";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { toNodeHandler } from "better-auth/node";
import { requireAuth, requireRole } from "./middlewares/auth.middleware.js";
import serviceRoutes from "./routes/service.routes.js";
import appointmentRoutes from "./routes/appointment.routes.js";
import { auth } from "./config/auth.js";
import healthRoutes from "./routes/health.routes.js";

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true
  })
);

// Any authenticated user
app.get("/api/me", requireAuth, (req, res) => {
  res.json({
    success: true,
    user: res.locals.user
  });
});

// Admin only
app.get(
  "/api/admin-check",
  requireAuth,
  requireRole("admin"),
  (_req, res) => {
    res.json({
      success: true,
      message: "Welcome, Admin!"
    });
  }
);


// Better Auth must be mounted before express.json().
app.all("/api/auth/*splat", toNodeHandler(auth));

// Stripe webhook must receive the raw request body.
app.post(
  "/api/payments/webhook",
  express.raw({ type: "application/json" }),
  handleStripeWebhook
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "Welcome to SalonBook API"
  });
});

app.use("/api/health", healthRoutes);
app.use("/api/users", userRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/admin", adminRoutes);

app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found"
  });
});

export default app;
