import express from "express";
import {
  createInternship,
  getAllInternships,
  getCompanyInternships,
  deleteInternship,
  getInternshipById,
} from "../controllers/internship.controller.js";

const router = express.Router();

// POST new internship
router.post("/", createInternship);

// GET all internships
router.get("/", getAllInternships);

// GET internships by company
router.get("/company/:companyId", getCompanyInternships);

// GET single internship
router.get("/:id", getInternshipById);

// DELETE internship
router.delete("/:id", deleteInternship);

export default router;
