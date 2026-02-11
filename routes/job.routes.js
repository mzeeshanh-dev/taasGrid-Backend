import express from "express";
import {
  createJob,
  getJobs,
  deleteJob,
  updateJobStatus,
  getInternships,
  getJobCriteria,
  getJobById,
  updateJob,
  getJobsByCompany
} from "../controllers/job.controller.js";
import { requireCompanyAuth } from "../middleware/authCompany.middleware.js";
const router = express.Router();

router.post("/", createJob);
router.get("/", getJobs);
router.get("/company/:companyId", getJobsByCompany);
router.delete("/:id", deleteJob);
router.put("/jobs/:id", updateJobStatus);
router.get("/internships", getInternships);
router.get("/criteria/:jobId", getJobCriteria);
router.get("/:jobId", getJobById);
router.put("/:id", updateJob);



export default router;
