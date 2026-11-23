import { ObjectId } from "mongodb";
import { Router } from "express";
import mongoose from "mongoose";
import Transaction from "../models/transaction.model.js";
import { requireAuth, requireRole } from "../middlewares/auth.middleware.js";
const router = Router();
// Get customer information from Better Auth's user collection
const getCustomerDetails = async (customerIds) => {
    // Access the same database used by Better Auth
    const db = mongoose.connection.getClient().db("salonbook");
    const userCollection = db.collection("user");
    const objectIds = customerIds
        .filter((id) => ObjectId.isValid(id))
        .map((id) => new ObjectId(id));
    const users = await userCollection
        .find({
        _id: { $in: objectIds }
    })
        .project({
        _id: 1,
        name: 1,
        email: 1
    })
        .toArray();
    console.log("Database:", db.databaseName);
    console.log("Users found:", users.length);
    return new Map(users.map((user) => [
        user._id.toString(),
        {
            id: user._id.toString(),
            name: user.name,
            email: user.email
        }
    ]));
};
// Populate appointment and service information
const populateTransaction = {
    path: "appointmentId",
    populate: {
        path: "serviceId",
        select: "name category price duration"
    }
};
// GET /api/transactions
// Admin: Get all transactions
router.get("/", requireAuth, requireRole("admin"), async (_req, res) => {
    try {
        const transactions = await Transaction.find()
            .sort({ createdAt: -1 })
            .populate(populateTransaction)
            .lean();
        const customerIds = [
            ...new Set(transactions.map((transaction) => transaction.customerId))
        ];
        const customers = await getCustomerDetails(customerIds);
        const result = transactions.map((transaction) => ({
            ...transaction,
            customer: customers.get(transaction.customerId) || null
        }));
        return res.status(200).json({
            success: true,
            count: result.length,
            transactions: result
        });
    }
    catch (error) {
        console.error("Get transactions error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve transactions"
        });
    }
});
// GET /api/transactions/:id
// Admin: Get a single transaction
router.get("/:id", requireAuth, requireRole("admin"), async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid transaction ID"
            });
        }
        const transaction = await Transaction.findById(id)
            .populate(populateTransaction)
            .lean();
        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: "Transaction not found"
            });
        }
        const customers = await getCustomerDetails([
            transaction.customerId
        ]);
        return res.status(200).json({
            success: true,
            transaction: {
                ...transaction,
                customer: customers.get(transaction.customerId) || null
            }
        });
    }
    catch (error) {
        console.error("Get transaction error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve transaction"
        });
    }
});
export default router;
