
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

      if (
        typeof appointmentId !== "string" ||
        !mongoose.isValidObjectId(appointmentId)
      ) {
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

      if (!service || !service.name) {
        return res.status(400).json({
          success: false,
          message: "Appointment service not found"
        });
      }

      const clientUrl =
        process.env.CLIENT_URL || "http://localhost:3000";

      const currency = (
        process.env.STRIPE_CURRENCY || "bdt"
      ).toLowerCase();

      const amountInSmallestUnit = Math.round(
        appointment.totalAmount * 100
      );

      if (
        !Number.isFinite(appointment.totalAmount) ||
        amountInSmallestUnit <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid appointment amount"
        });
      }

      const checkoutSession = await stripe.checkout.sessions.create({
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

      if (!checkoutSession.url) {
        return res.status(500).json({
          success: false,
          message: "Could not create Stripe Checkout URL"
        });
      }

      await Transaction.create({
        appointmentId: appointment._id,
        customerId,
        stripeSessionId: checkoutSession.id,
        amount: appointment.totalAmount,
        currency,
        status: "pending"
      });

      return res.status(201).json({
        success: true,
        message: "Checkout session created",
        checkoutUrl: checkoutSession.url
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
    return res.status(400).send(
      "Missing Stripe signature or webhook secret"
    );
  }

  let event: Stripe.Event;

  // Verify Stripe webhook signature using the raw request body.
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      webhookSecret
    );
  } catch (error) {
    console.error("Webhook signature verification failed:", error);

    return res.status(400).send(
      "Invalid webhook signature"
    );
  }

  // Ignore unrelated events.
  if (event.type !== "checkout.session.completed") {
    return res.json({ received: true });
  }

  const checkoutSession =
    event.data.object as Stripe.Checkout.Session;

  if (checkoutSession.payment_status !== "paid") {
    return res.json({ received: true });
  }

  const appointmentId = checkoutSession.metadata?.appointmentId;
  const customerId = checkoutSession.metadata?.customerId;

  if (!appointmentId || !customerId) {
    return res.status(400).send(
      "Missing appointment metadata"
    );
  }

  if (!mongoose.isValidObjectId(appointmentId)) {
    return res.status(400).send(
      "Invalid appointment metadata"
    );
  }

  const checkoutCurrency = checkoutSession.currency;

  if (
    checkoutSession.mode !== "payment" ||
    typeof checkoutSession.amount_total !== "number" ||
    typeof checkoutCurrency !== "string"
  ) {
    return res.status(400).send(
      "Invalid Checkout session"
    );
  }

  const dbSession = await mongoose.startSession();

  try {
    await dbSession.withTransaction(async () => {
      const transaction = await Transaction.findOne({
        stripeSessionId: checkoutSession.id,
        appointmentId,
        customerId
      }).session(dbSession);

      if (!transaction) {
        throw new Error("Transaction not found");
      }

      // Ignore duplicate webhook events and completed payments.
      if (
        transaction.stripeEventId === event.id ||
        transaction.status === "succeeded"
      ) {
        return;
      }

      const expectedAmount = Math.round(
        transaction.amount * 100
      );

      const expectedCurrency =
        transaction.currency.toLowerCase();

      // Verify actual Stripe payment amount and currency.
      if (
        checkoutSession.amount_total !== expectedAmount ||
        checkoutCurrency.toLowerCase() !== expectedCurrency
      ) {
        throw new Error(
          "Stripe payment amount or currency mismatch"
        );
      }

      const appointment = await Appointment.findOne({
        _id: appointmentId,
        customerId,
        status: "confirmed",
        paymentStatus: "unpaid"
      }).session(dbSession);

      if (!appointment) {
        throw new Error(
          "Confirmed unpaid appointment not found"
        );
      }

      // Verify appointment amount against transaction.
      if (
        Math.round(appointment.totalAmount * 100) !==
        expectedAmount
      ) {
        throw new Error(
          "Appointment amount does not match transaction"
        );
      }

      // Update transaction and store the processed event ID.
      transaction.status = "succeeded";
      transaction.stripeEventId = event.id;

      transaction.paymentIntentId =
        typeof checkoutSession.payment_intent === "string"
          ? checkoutSession.payment_intent
          : undefined;

      await transaction.save({
        session: dbSession
      });

      // Mark appointment as paid.
      const appointmentUpdate = await Appointment.updateOne(
        {
          _id: appointmentId,
          customerId,
          status: "confirmed",
          paymentStatus: "unpaid"
        },
        {
          $set: {
            paymentStatus: "paid"
          }
        },
        {
          session: dbSession
        }
      );

      if (appointmentUpdate.modifiedCount !== 1) {
        throw new Error(
          "Could not update appointment payment status"
        );
      }
    });

    return res.json({ received: true });

  } catch (error) {
    console.error(
      "Stripe webhook processing error:",
      error
    );

    return res.status(500).send(
      "Webhook processing failed"
    );

  } finally {
    await dbSession.endSession();
  }
};

export default router;
