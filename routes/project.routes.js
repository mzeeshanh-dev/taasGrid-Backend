import express from "express";
import {
    createProject,
    getAllProjects,
    getProjectById,
    updateProject,
    deleteProject,
} from "../controllers/project.controller.js";

import { requireCompanyAuth } from "../middleware/authCompany.middleware.js";

const router = express.Router();

// Public
router.get("/all", getAllProjects);
router.get("/:id", getProjectById);

// Protected (Company)
router.post("/create", requireCompanyAuth, createProject);
router.put("/:id", requireCompanyAuth, updateProject);
router.delete("/:id", requireCompanyAuth, deleteProject);

export default router;
