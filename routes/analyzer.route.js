import express from "express";
import multer from "multer";
import * as cvController from "../controllers/analyzer.controller.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/upload", upload.array('files'), cvController.uploadCvs);
router.post("/analyze", cvController.analyzeCvs);
router.post("/rank", cvController.rankCvs);
router.post("/clear", cvController.clearCvs);


export default router;
