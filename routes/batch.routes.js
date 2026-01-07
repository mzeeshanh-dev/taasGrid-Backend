import express from "express";
import * as batchController from "../controllers/batch.controller.js";

const router = express.Router();

// Upload / Add or update resumes
router.post("/upload", batchController.uploadBatchResumes);

// Get all resume
router.get("/", batchController.getBatchResumes);

// put / update analysis of a specific resume
router.put("/", batchController.updateBatchResume);

// Clear batch
router.post("/clear", batchController.clearBatch);

export default router;
