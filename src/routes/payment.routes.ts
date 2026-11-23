import { Router, Request, Response } from "express";
import Stripe from "stripe";
import mongoose from "mongoose";
import Appointment from "../models/appointment.model.js";
import Transaction from "../models/transaction.model.js";
import { stripe } from "../config/stripe.js";
import {
  requireAuth,
  requireRole
} from "../middlewares/auth.middleware.js";

const router = Router();

// Customer: Create Stripe Checkout Session
router.post(
  "/checkout-session",
  requireAuth,
  requireRole("customer"),
  async (req: Request, res: Response) => {
    try {
      const { appointmentId } = req.body;
      const customerId = res.locals.user.id;

      if (!mongoose.isValidObjectId(appointmentId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid appointment ID"
        });
      }

      const appointment = await Appointment.findOne({
        _id: appointmentId,
        customerId,
        status: "confirmed",
        paymentStatus: "unpaid"
      }).populate("serviceId");

      if (!appointment) {
        return res.status(404).json({
          success: false,
          message: "Confirmed unpaid appointment not found"
        });
      }

      const service = appointment.serviceId as any;

      const clientUrl =
        process.env.CLIENT_URL || "http://localhost:3000";

      const currency = (
        process.env.STRIPE_CURRENCY || "bdt"
      ).toLowerCase();

      // Amount is calculated from the database, never from the client.
      const amountInSmallestUnit = Math.round(
        appointment.totalAmount * 100
      );

      if (amountInSmallestUnit <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid appointment amount"
        });
      }

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
       
        line_items: [
          {
            price_data: {
              currency,
              product_data: {
                name: service.name
              },
              unit_amount: amountInSmallestUnit
            },
            quantity: 1
          }
        ],
        metadata: {
          appointmentId: appointment._id.toString(),
          customerId
        },
        success_url:
          `${clientUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:
          `${clientUrl}/payment/cancel?appointmentId=${appointment._id}`
      });

      if (!session.url) {
        return res.status(500).json({
          success: false,
          message: "Could not create Stripe Checkout URL"
        });
      }

      await Transaction.create({
        appointmentId: appointment._id,
        customerId,
        stripeSessionId: session.id,
        amount: appointment.totalAmount,
        currency,
        status: "pending"
      });

      return res.status(201).json({
        success: true,
        message: "Checkout session created",
        checkoutUrl: session.url
      });
    } catch (error) {
      console.error("Stripe checkout error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to create checkout session"
      });
    }
  }
);

// Stripe Webhook Handler
export const handleStripeWebhook = async (
  req: Request,
  res: Response
) => {
  const signature = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return res.status(400).send("Missing Stripe signature or webhook secret");
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      webhookSecret
    );
  } catch (error) {
    console.error("Webhook signature verification failed:", error);
    return res.status(400).send("Invalid webhook signature");
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.payment_status !== "paid") {
        return res.json({ received: true });
      }

      const appointmentId = session.metadata?.appointmentId;
      const customerId = session.metadata?.customerId;

      if (!appointmentId || !customerId) {
        return res.status(400).send("Missing appointment metadata");
      }

      const transaction = await Transaction.findOne({
        stripeSessionId: session.id,
        appointmentId,
        customerId
      });

      if (!transaction) {
        return res.status(404).send("Transaction not found");
      }

      // Record the verified payment.
      transaction.status = "succeeded";
      transaction.paymentIntentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : undefined;

      await transaction.save();

      // Only update the matching customer's confirmed appointment.
      await Appointment.updateOne(
        {
          _id: appointmentId,
          customerId,
          status: "confirmed",
          paymentStatus: "unpaid"
        },
        {
          $set: { paymentStatus: "paid" }
        }
      );
    }

    return res.json({ received: true });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return res.status(500).send("Webhook processing failed");
  }
};

export default router;