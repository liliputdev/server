import { Router } from "express";
import mongoose from "mongoose";
import Appointment from "../models/appointment.model.js";
import Service from "../models/service.model.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
const router = Router();
// Customer: Book an appointment
router.post("/", requireAuth, requireRole("customer"), async (req, res) => {
    try {
        const { serviceId, appointmentDate, timeSlot, notes } = req.body;
        const customerId = res.locals.user.id;
        if (!mongoose.isValidObjectId(serviceId) ||
            !appointmentDate ||
            !timeSlot) {
            return res.status(400).json({
                success: false,
                message: "Invalid appointment details"
            });
        }
        const date = new Date(appointmentDate);
        if (Number.isNaN(date.getTime()) || date <= new Date()) {
            return res.status(400).json({
                success: false,
                message: "Choose a future appointment date"
            });
        }
        const service = await Service.findOne({
            _id: serviceId,
            isActive: true
        });
        if (!service) {
            return res.status(404).json({
                success: false,
                message: "Service not found or unavailable"
            });
        }
        const existing = await Appointment.findOne({
            appointmentDate: date,
            timeSlot,
            status: { $in: ["pending", "confirmed"] }
        });
        if (existing) {
            return res.status(409).json({
                success: false,
                message: "This time slot is already booked"
            });
        }
        const appointment = await Appointment.create({
            customerId,
            serviceId,
            appointmentDate: date,
            timeSlot,
            notes,
            totalAmount: service.price
        });
        res.status(201).json({
            success: true,
            message: "Appointment requested successfully",
            appointment
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: "Failed to create appointment"
        });
    }
});
// Customer: View own appointments
router.get("/my", requireAuth, requireRole("customer"), async (_req, res) => {
    try {
        const appointments = await Appointment.find({
            customerId: res.locals.user.id
        })
            .populate("serviceId")
            .sort({ createdAt: -1 });
        res.json({
            success: true,
            appointments
        });
    }
    catch {
        res.status(500).json({
            success: false,
            message: "Failed to retrieve appointments"
        });
    }
});
// Customer: Cancel own pending appointment
router.patch("/:id/cancel", requireAuth, requireRole("customer"), async (req, res) => {
    try {
        const appointment = await Appointment.findOneAndUpdate({
            _id: req.params.id,
            customerId: res.locals.user.id,
            status: "pending"
        }, { status: "cancelled" }, { new: true });
        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: "Pending appointment not found"
            });
        }
        res.json({
            success: true,
            appointment
        });
    }
    catch {
        res.status(400).json({
            success: false,
            message: "Invalid appointment ID"
        });
    }
});
// Admin: View all appointments
router.get("/", requireAuth, requireRole("admin"), async (_req, res) => {
    try {
        const appointments = await Appointment.find()
            .populate("serviceId")
            .sort({ createdAt: -1 });
        res.json({
            success: true,
            appointments
        });
    }
    catch {
        res.status(500).json({
            success: false,
            message: "Failed to retrieve appointments"
        });
    }
});
// Admin: Confirm or cancel appointment
router.patch("/:id/status", requireAuth, requireRole("admin"), async (req, res) => {
    try {
        const { status } = req.body;
        if (!["confirmed", "cancelled"].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid appointment status"
            });
        }
        const appointment = await Appointment.findByIdAndUpdate(req.params.id, { status }, { new: true, runValidators: true });
        if (!appointment) {
            return res.status(404).json({
                success: false,
                message: "Appointment not found"
            });
        }
        res.json({
            success: true,
            appointment
        });
    }
    catch {
        res.status(400).json({
            success: false,
            message: "Invalid appointment ID"
        });
    }
});
export default router;
