import express from "express";
import * as batchController from "../controllers/batch.controller.js";

const router = express.Router();

// Create / upload resumes to batch
router.post("/upload", batchController.uploadBatchResumes);

// Get batches (optional jobId filter)
router.get("/:jobId", batchController.getBatchResumes);


// Update analysis of a resume
router.put("/resume", batchController.updateBatchResume);

// Clear batches by job
router.post("/clear", batchController.clearBatch);

export default router;
