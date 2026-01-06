// routes/company.routes.js
import express from "express";
import { requireCompanyAuth } from "../middleware/authCompany.middleware.js";
import { getCompanyDashboardData, getCompanyById, updateCompanyById } from "../controllers/company.controller.js";

const router = express.Router();

// dashboard uses company from token
router.get("/dashboard", requireCompanyAuth, getCompanyDashboardData);

// GET/PUT by ID (public read / protected update)
router.route("/:id")
  .get(getCompanyById)
  .put(requireCompanyAuth, updateCompanyById);

export default router;
