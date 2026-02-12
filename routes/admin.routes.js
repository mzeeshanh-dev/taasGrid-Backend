import express from "express";
import {
    getDashboardStats,
    getAllUsers,
    createUser,
    updateUserStatus,
    getAllCompanies,
    getCompanyJobs,
    getJobApplicants,
    editUser,
    editCompany,
    createCompany,
    updateCompanyStatus,
    getAllApplicants,
    getApplicantsByCompany
} from "../controllers/admin.controller.js";

const router = express.Router();

// ----------------- DASHBOARD -----------------
router.get("/dashboard", getDashboardStats);

// ----------------- USERS -----------------
router.get("/users/all", getAllUsers);
router.post("/user/create", createUser);
router.patch("/users/:userId/status", updateUserStatus);
router.patch("/users/edit/:userId", editUser);

// ----------------- COMPANIES -----------------
router.get("/companies/all", getAllCompanies);
router.get("/companies/:companyId/jobs", getCompanyJobs);
router.get("/jobs/:jobId/applicants", getJobApplicants);

router.patch("/company/edit/:companyId", editCompany);
router.post("/company/create", createCompany);

router.patch("/company/:companyId/status", updateCompanyStatus);
router.get("/applicants/all", getAllApplicants);
router.get("/company/:companyId/applicants", getApplicantsByCompany);

export default router;