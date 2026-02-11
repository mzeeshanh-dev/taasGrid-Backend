import express from "express";
import {
    getDashboardStats,
    getAllUsers,
    createUser,
    suspendUser,
    deleteUser,
    getAllCompanies,
    getCompanyJobs,
    getJobApplicants,
    deleteCompany,
} from "../controllers/admin.controller.js";

const router = express.Router();

// ----------------- DASHBOARD -----------------
router.get("/dashboard", getDashboardStats);

// ----------------- USERS -----------------
router.get("/users/all", getAllUsers);
router.post("/user/create", createUser);
router.put("/user/suspend/:userId", suspendUser);
router.delete("/user/delete/:userId", deleteUser);

// ----------------- COMPANIES -----------------
router.get("/companies/all", getAllCompanies);
router.get("/companies/:companyId/jobs", getCompanyJobs);
router.get("/jobs/:jobId/applicants", getJobApplicants);
router.delete("/companies/:companyId", deleteCompany);

export default router;