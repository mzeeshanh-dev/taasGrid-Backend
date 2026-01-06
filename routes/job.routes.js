import express from "express";
import {
  createJob,
  getJobs,
  deleteJob,
  updateJobStatus,
  getInternships
} from "../controllers/job.controller.js";
const router = express.Router();

router.post("/", createJob);
router.get("/", getJobs);
router.delete("/:id", deleteJob);
router.put("/jobs/:id", updateJobStatus);
router.get("/internships", getInternships);
export default router;
