
import { Router } from "express";
import mongoose from "mongoose";
import { ObjectId } from "mongodb";

import {
  requireAuth,
  requireRole
} from "../middlewares/auth.middleware.js";

const router = Router();

// ==========================================
// DATABASE HELPER
// ==========================================

const getUserCollection = () => {
  return mongoose.connection
    .getClient()
    .db("salonbook")
    .collection<{
      _id: ObjectId;
      name?: string;
      email?: string;
      role?: string;
      banned?: boolean;
      createdAt?: Date;
    }>("user");
};

// ==========================================
// CUSTOMER PROFILE ROUTES
// ==========================================

// GET own profile
router.get("/me", requireAuth, async (req, res) => {
  try {
    const userId = res.locals.user.id;

    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID"
      });
    }

    const user = await getUserCollection().findOne(
      { _id: new ObjectId(userId) },
      {
        projection: {
          name: 1,
          email: 1,
          role: 1,
          banned: 1,
          createdAt: 1
        }
      }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role || "customer",
        isBlocked: user.banned ?? false,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error("Get own profile error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve profile"
    });
  }
});

// UPDATE own profile
router.patch("/me", requireAuth, async (req, res) => {
  try {
    const userId = res.locals.user.id;
    const { name } = req.body;

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "A valid name is required"
      });
    }

    if (name.trim().length > 100) {
      return res.status(400).json({
        success: false,
        message: "Name cannot exceed 100 characters"
      });
    }

    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID"
      });
    }

    const result = await getUserCollection().findOneAndUpdate(
      { _id: new ObjectId(userId) },
      { $set: { name: name.trim() } },
      {
        returnDocument: "after",
        projection: {
          name: 1,
          email: 1,
          role: 1,
          banned: 1,
          createdAt: 1
        }
      }
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: result._id.toString(),
        name: result.name,
        email: result.email,
        role: result.role || "customer",
        isBlocked: result.banned ?? false,
        createdAt: result.createdAt
      }
    });
  } catch (error) {
    console.error("Update own profile error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update profile"
    });
  }
});

// ==========================================
// ADMIN USER MANAGEMENT
// ==========================================

// GET all users
router.get("/", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const { search, role } = req.query;
    const filter: Record<string, unknown> = {};

    if (typeof role === "string" && role.trim()) {
      filter.role = role.trim();
    }

    if (typeof search === "string" && search.trim()) {
      const escapedSearch = search.trim().replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      const searchRegex = new RegExp(escapedSearch, "i");

      filter.$or = [
        { name: searchRegex },
        { email: searchRegex }
      ];
    }

    const users = await getUserCollection()
      .find(filter)
      .project({
        name: 1,
        email: 1,
        role: 1,
        banned: 1,
        createdAt: 1
      })
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json({
      success: true,
      count: users.length,
      users: users.map((user) => ({
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role || "customer",
        isBlocked: user.banned ?? false,
        createdAt: user.createdAt
      }))
    });
  } catch (error) {
    console.error("Get users error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve users"
    });
  }
});

// GET individual user
router.get("/:id", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const id = req.params.id;

    if (typeof id !== "string" || !ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID"
      });
    }

    const user = await getUserCollection().findOne(
      { _id: new ObjectId(id) },
      {
        projection: {
          name: 1,
          email: 1,
          role: 1,
          banned: 1,
          createdAt: 1
        }
      }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role || "customer",
        isBlocked: user.banned ?? false,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error("Get user error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve user"
    });
  }
});

// BLOCK customer
router.patch(
  "/:id/block",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    try {
      const id = req.params.id;

      if (typeof id !== "string" || !ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid user ID"
        });
      }

      const collection = getUserCollection();
      const userId = new ObjectId(id);
      const user = await collection.findOne({ _id: userId });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }

      if (user.role === "admin") {
        return res.status(403).json({
          success: false,
          message: "Admin accounts cannot be blocked"
        });
      }

      if (user.banned === true) {
        return res.status(200).json({
          success: true,
          message: "User is already blocked"
        });
      }

      await collection.updateOne(
        { _id: userId },
        { $set: { banned: true } }
      );

      return res.status(200).json({
        success: true,
        message: "User blocked successfully"
      });
    } catch (error) {
      console.error("Block user error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to block user"
      });
    }
  }
);

// UNBLOCK customer
router.patch(
  "/:id/unblock",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    try {
      const id = req.params.id;

      if (typeof id !== "string" || !ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid user ID"
        });
      }

      const collection = getUserCollection();
      const userId = new ObjectId(id);
      const user = await collection.findOne({ _id: userId });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }

      if (user.role === "admin") {
        return res.status(403).json({
          success: false,
          message: "Admin accounts cannot be unblocked"
        });
      }

      if (user.banned !== true) {
        return res.status(200).json({
          success: true,
          message: "User is not blocked"
        });
      }

      await collection.updateOne(
        { _id: userId },
        { $set: { banned: false } }
      );

      return res.status(200).json({
        success: true,
        message: "User unblocked successfully"
      });
    } catch (error) {
      console.error("Unblock user error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to unblock user"
      });
    }
  }
);

export default router;
