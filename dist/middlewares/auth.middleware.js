import { fromNodeHeaders } from "better-auth/node";
import { ObjectId } from "mongodb";
import mongoose from "mongoose";
import { auth } from "../config/auth.js";
export const requireAuth = async (req, res, next) => {
    try {
        const session = await auth.api.getSession({
            headers: fromNodeHeaders(req.headers)
        });
        if (!session) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized. Please sign in."
            });
        }
        const userId = session.user.id;
        if (!ObjectId.isValid(userId)) {
            return res.status(401).json({
                success: false,
                message: "Invalid user session."
            });
        }
        const db = mongoose.connection
            .getClient()
            .db("salonbook");
        const user = await db.collection("user")
            .findOne({ _id: new ObjectId(userId) }, { projection: { banned: 1 } });
        if (!user) {
            return res.status(401).json({
                success: false,
                message: "User account not found."
            });
        }
        if (user.banned === true) {
            return res.status(403).json({
                success: false,
                message: "Your account has been blocked. Please contact the administrator."
            });
        }
        res.locals.user = session.user;
        return next();
    }
    catch (error) {
        console.error("Authentication error:", error);
        return res.status(500).json({
            success: false,
            message: "Authentication failed"
        });
    }
};
export const requireRole = (...roles) => {
    return (req, res, next) => {
        const user = res.locals.user;
        if (!user || !roles.includes(user.role)) {
            return res.status(403).json({
                success: false,
                message: "Forbidden. You do not have permission."
            });
        }
        next();
    };
};
