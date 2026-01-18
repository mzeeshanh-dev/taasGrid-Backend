import express from "express";
import {
  createApplicant,
  getApplicants,
  getApplicantById,
  updateApplicantStatus,
  deleteApplicant,
  getApplicantsByJob,
  getBulkApplicantsByJob,
} from "../controllers/applicant.controller.js";

const router = express.Router();

router.post("/", createApplicant); // Create new applicant
router.get("/", getApplicants); // Get all applicants (filter by jobId via query)
router.get("/:id", getApplicantById); // Get one applicant
router.put("/:id/status", updateApplicantStatus); // Update status
router.delete("/:id", deleteApplicant); // Delete applicant
router.get("/job/:jobId", getApplicantsByJob);

router.get("/job/viaBulk/:jobId", getBulkApplicantsByJob);


export default router;
