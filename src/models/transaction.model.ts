import mongoose, { Schema, Document } from "mongoose";


export interface ITransaction extends Document {
  appointmentId: mongoose.Types.ObjectId;
  customerId: string;
  stripeSessionId: string;
  paymentIntentId?: string;
  amount: number;
  currency: string;
  status: "pending" | "succeeded" | "failed";
}

const transactionSchema = new Schema<ITransaction>(
  {
    appointmentId: {
      type: Schema.Types.ObjectId,
      ref: "Appointment",
      required: true
    },
    customerId: {
      type: String,
      required: true
    },
    stripeSessionId: {
      type: String,
      required: true,
      unique: true
    },
    paymentIntentId: {
      type: String,
      default: null
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      required: true,
      lowercase: true
    },
    status: {
      type: String,
      enum: ["pending", "succeeded", "failed"],
      default: "pending"
    }
  },
  { timestamps: true }
);

const Transaction = mongoose.model<ITransaction>(
  "Transaction",
  transactionSchema
);

export default Transaction;