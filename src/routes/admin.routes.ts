
import { Router } from "express";
import mongoose from "mongoose";

import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
import Service from "../models/service.model.js";
import Appointment from "../models/appointment.model.js";
import Transaction from "../models/transaction.model.js";

const router = Router();

// Admin: Dashboard overview
router.get(
  "/dashboard",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    try {
      const db = mongoose.connection.getClient().db("salonbook");

      const [
        totalUsers,
        totalCustomers,
        totalServices,
        activeServices,
        totalAppointments,
        pendingAppointments,
        confirmedAppointments,
        cancelledAppointments,
        successfulTransactions,
        recentAppointments,
        recentTransactions
      ] = await Promise.all([
        db.collection("user").countDocuments(),
        db.collection("user").countDocuments({
          role: { $ne: "admin" }
        }),
        Service.countDocuments(),
        Service.countDocuments({ isActive: true }),
        Appointment.countDocuments(),
        Appointment.countDocuments({ status: "pending" }),
        Appointment.countDocuments({ status: "confirmed" }),
        Appointment.countDocuments({ status: "cancelled" }),
        Transaction.find({ status: "succeeded" })
          .select("amount currency")
          .lean(),
        Appointment.find()
          .populate("serviceId", "name price")
          .sort({ createdAt: -1 })
          .limit(5)
          .lean(),
        Transaction.find()
          .populate("appointmentId", "appointmentDate timeSlot")
          .sort({ createdAt: -1 })
          .limit(5)
          .lean()
      ]);

      const totalRevenue = successfulTransactions.reduce(
        (total, transaction) => total + transaction.amount,
        0
      );

      const revenueByCurrency = successfulTransactions.reduce<
        Record<string, number>
      >((totals, transaction) => {
        const currency = transaction.currency.toUpperCase();
        totals[currency] = (totals[currency] || 0) + transaction.amount;
        return totals;
      }, {});

      return res.status(200).json({
        success: true,
        dashboard: {
          users: {
            total: totalUsers,
            customers: totalCustomers
          },
          services: {
            total: totalServices,
            active: activeServices
          },
          appointments: {
            total: totalAppointments,
            pending: pendingAppointments,
            confirmed: confirmedAppointments,
            cancelled: cancelledAppointments
          },
          revenue: {
            total: totalRevenue,
            currency: "BDT",
            byCurrency: revenueByCurrency,
            successfulPayments: successfulTransactions.length
          },
          recentAppointments,
          recentTransactions
        }
      });
    } catch (error) {
      console.error("Admin dashboard error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to retrieve dashboard data"
      });
    }
  }
);

export default router;
