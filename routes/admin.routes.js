import express from "express";
import {
    getDashboardStats,
    getAllUsers,
    createUser,
    updateUserStatus,
    deleteUser,
    getAllCompanies,
    getCompanyJobs,
    getJobApplicants,
    deleteCompany,
    editUser,
    editCompany,
    createCompany,
    updateCompanyStatus
} from "../controllers/admin.controller.js";

const router = express.Router();

// ----------------- DASHBOARD -----------------
router.get("/dashboard", getDashboardStats);

// ----------------- USERS -----------------
router.get("/users/all", getAllUsers);
router.post("/user/create", createUser);
router.patch("/users/:userId/status", updateUserStatus);
router.delete("/user/delete/:userId", deleteUser);
router.patch("/users/edit/:userId", editUser);

// ----------------- COMPANIES -----------------
router.get("/companies/all", getAllCompanies);
router.get("/companies/:companyId/jobs", getCompanyJobs);
router.get("/jobs/:jobId/applicants", getJobApplicants);
router.delete("/company/delete/:companyId", deleteCompany);

router.patch("/company/edit/:companyId", editCompany);
router.post("/company/create", createCompany);

router.patch("/company/:companyId/status", updateCompanyStatus);

export default router;