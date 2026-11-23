
import { Router } from "express";
import mongoose from "mongoose";
import Service from "../models/service.model.js";
import {
  requireAuth,
  requireRole
} from "../middlewares/auth.middleware.js";

const router = Router();

// Public: Get active services
router.get("/", async (req, res) => {
  try {
    const { search, category, sort } = req.query;

    const filter: Record<string, unknown> = {
      isActive: true
    };

    if (typeof search === "string" && search.trim()) {
      filter.name = {
        $regex: search.trim(),
        $options: "i"
      };
    }

    if (typeof category === "string" && category.trim()) {
      filter.category = category.trim();
    }

    let query = Service.find(filter);

    if (sort === "price-low") {
      query = query.sort({ price: 1 });
    } else if (sort === "price-high") {
      query = query.sort({ price: -1 });
    } else {
      query = query.sort({ createdAt: -1 });
    }

    const services = await query;

    return res.json({
      success: true,
      count: services.length,
      services
    });
  } catch (error) {
    console.error("Get services error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve services"
    });
  }
});

// Public: Get one active service
// Admin: Get all services, including inactive services
router.get(
  "/admin/all",
  requireAuth,
  requireRole("admin"),
  async (_req, res) => {
    try {
      const services = await Service.find().sort({ createdAt: -1 });

      return res.status(200).json({
        success: true,
        count: services.length,
        services
      });
    } catch (error) {
      console.error("Get all admin services error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to retrieve services"
      });
    }
  }
);

// Admin: Create service

// Public: Get one active service
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid service ID"
      });
    }

    const service = await Service.findOne({
      _id: id,
      isActive: true
    });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found"
      });
    }

    return res.status(200).json({
      success: true,
      service
    });
  } catch (error) {
    console.error("Get service details error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve service details"
    });
  }
});


// Admin: Update service
router.patch(
  "/:id",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid service ID"
        });
      }

      const {
        name,
        description,
        category,
        price,
        duration,
        image
      } = req.body;

      const updates: Record<string, unknown> = {};

      if (name !== undefined) {
        if (typeof name !== "string" || !name.trim()) {
          return res.status(400).json({
            success: false,
            message: "Invalid service name"
          });
        }
        updates.name = name.trim();
      }

      if (description !== undefined) {
        if (typeof description !== "string" || !description.trim()) {
          return res.status(400).json({
            success: false,
            message: "Invalid service description"
          });
        }
        updates.description = description.trim();
      }

      if (category !== undefined) {
        if (typeof category !== "string" || !category.trim()) {
          return res.status(400).json({
            success: false,
            message: "Invalid service category"
          });
        }
        updates.category = category.trim();
      }

      if (price !== undefined) {
        if (!Number.isFinite(price) || price < 0) {
          return res.status(400).json({
            success: false,
            message: "Price must be a valid non-negative number"
          });
        }
        updates.price = price;
      }

      if (duration !== undefined) {
        if (!Number.isFinite(duration) || duration < 1) {
          return res.status(400).json({
            success: false,
            message: "Duration must be at least 1 minute"
          });
        }
        updates.duration = duration;
      }

      if (image !== undefined) {
        if (typeof image !== "string") {
          return res.status(400).json({
            success: false,
            message: "Invalid image URL"
          });
        }
        updates.image = image;
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
          success: false,
          message: "Provide at least one valid field to update"
        });
      }

      const service = await Service.findByIdAndUpdate(
        id,
        { $set: updates },
        { new: true, runValidators: true }
      );

      if (!service) {
        return res.status(404).json({
          success: false,
          message: "Service not found"
        });
      }

      return res.json({
        success: true,
        message: "Service updated successfully",
        service
      });
    } catch (error) {
      console.error("Update service error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to update service"
      });
    }
  }
);

// Admin: Activate or deactivate service
router.patch(
  "/:id/status",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { isActive } = req.body;

      if (!mongoose.isValidObjectId(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid service ID"
        });
      }

      if (typeof isActive !== "boolean") {
        return res.status(400).json({
          success: false,
          message: "isActive must be true or false"
        });
      }

      const service = await Service.findByIdAndUpdate(
        id,
        { $set: { isActive } },
        { new: true, runValidators: true }
      );

      if (!service) {
        return res.status(404).json({
          success: false,
          message: "Service not found"
        });
      }

      return res.json({
        success: true,
        message: `Service ${isActive ? "activated" : "deactivated"} successfully`,
        service
      });
    } catch (error) {
      console.error("Update service status error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to update service status"
      });
    }
  }
);

// Admin: Delete service
router.delete(
  "/:id",
  requireAuth,
  requireRole("admin"),
  async (req, res) => {
    try {
      if (!mongoose.isValidObjectId(req.params.id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid service ID"
        });
      }

      const service = await Service.findByIdAndDelete(req.params.id);

      if (!service) {
        return res.status(404).json({
          success: false,
          message: "Service not found"
        });
      }

      return res.json({
        success: true,
        message: "Service deleted successfully"
      });
    } catch (error) {
      console.error("Delete service error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to delete service"
      });
    }
  }
);

export default router;
