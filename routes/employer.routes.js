import express from "express";
import {
  registerEmployer,
  loginEmployer,
  logoutEmployer,
} from "../controllers/employer.controller.js";

const router = express.Router();

// API routes
router.post("/register", registerEmployer);
router.post("/login", loginEmployer);
router.post("/logout", logoutEmployer);

export default router;
