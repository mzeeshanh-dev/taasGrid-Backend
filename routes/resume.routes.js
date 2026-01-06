import express from "express";
import { saveEmployeeResume, getEmployeeResume, updateEmployeeResume } from "../controllers/resume.controller.js";

const router = express.Router();
router.post("/resume", saveEmployeeResume);
router.get("/resume/:userId", getEmployeeResume);
router.put("/resume/:userId", updateEmployeeResume);

export default router;
