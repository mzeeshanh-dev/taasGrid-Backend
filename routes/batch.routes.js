import express from "express";
import multer from "multer";
import * as batchController from "../controllers/batch.controller.js";

const router = express.Router();

// Create / upload resumes to batch
router.post("/upload", batchController.uploadBatchResumes);

// Get batches (optional jobId filter)
router.get("/:jobId", batchController.getBatchResumes);


// Update analysis of a resume
router.put("/resume", batchController.updateBatchResume);


router.post("/clear", batchController.clearBatch);
router.get("/candidates/all", batchController.getAllBatchCandidates);
// Get unique skills for a job
router.get("/skills/:jobId", batchController.getJobSkills);



const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }
});

router.post(
    "/upload-cvs",
    upload.array("files"),
    batchController.uploadResumesToCloud
);



router.delete("/remove-cv", batchController.removeResumeFromBatch);


// Update batch processing status
router.patch(
    "/status/:batchId",
    batchController.updateBatchStatus
);



export default router;
