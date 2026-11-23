
import mongoose, { Schema, Document } from "mongoose";

export interface IAppointment extends Document {
  customerId: string;
  serviceId: mongoose.Types.ObjectId;
  appointmentDate: Date;
  timeSlot: string;
  bookingKey?: string;
  status: "pending" | "confirmed" | "cancelled";
  paymentStatus: "unpaid" | "paid";
  totalAmount: number;
  notes?: string;
}

const appointmentSchema = new Schema<IAppointment>(
  {
    customerId: {
      type: String,
      required: true,
      index: true
    },
    serviceId: {
      type: Schema.Types.ObjectId,
      ref: "Service",
      required: true
    },
    appointmentDate: {
      type: Date,
      required: true
    },
    timeSlot: {
      type: String,
      required: true
    },
    bookingKey: {
      type: String,
      unique: true,
      sparse: true
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled"],
      default: "pending"
    },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "paid"],
      default: "unpaid"
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0
    },
    notes: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

const Appointment = mongoose.model<IAppointment>(
  "Appointment",
  appointmentSchema
);

export default Appointment;
