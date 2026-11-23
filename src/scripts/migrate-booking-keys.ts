
import "dotenv/config";
import mongoose from "mongoose";
import Appointment from "../models/appointment.model.js";

const migrateBookingKeys = async () => {
  try {
    await mongoose.connect(process.env.DATABASE_URL!);

    console.log("MongoDB connected");

    const activeAppointments = await Appointment.find({
      status: { $in: ["pending", "confirmed"] }
    });

    let updated = 0;

    for (const appointment of activeAppointments) {
      const date = new Date(appointment.appointmentDate);
      date.setUTCHours(0, 0, 0, 0);

      const dateKey = date.toISOString().split("T")[0];
      const bookingKey = `${dateKey}_${appointment.timeSlot}`;

      await Appointment.updateOne(
        { _id: appointment._id },
        { $set: { bookingKey } }
      );

      updated++;
    }

    console.log(`Migration completed. Updated ${updated} appointments.`);
  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    await mongoose.disconnect();
  }
};

migrateBookingKeys();
