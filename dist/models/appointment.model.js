import mongoose, { Schema } from "mongoose";
const appointmentSchema = new Schema({
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
}, {
    timestamps: true
});
const Appointment = mongoose.model("Appointment", appointmentSchema);
export default Appointment;
