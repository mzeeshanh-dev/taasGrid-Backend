import express from "express";
import multer from "multer";
import {
    parseResume,
    employeeParser,
    enrichCv,
} from "../controllers/CvForge.controller.js";

const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

router.post("/parse-resume", upload.single("file"), parseResume);

router.post("/employee-parser", upload.single("file"), employeeParser);

router.post("/enrich", express.json(), enrichCv);

export default router;
