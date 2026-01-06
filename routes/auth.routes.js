import express from "express";
import {
  login,
  logout,
  getMe,
  registerUser,
  registerCompany,
  refreshToken
} from "../controllers/auth.controller.js";

import { requireAuth } from "../middleware/requireAuth.js";

const router = express.Router();

// -------------------- PUBLIC ROUTES -------------------- //
router.post("/login", login);
router.post("/register/user", registerUser);
router.post("/register/company", registerCompany);
router.post("/refresh", refreshToken); // refresh access token

// -------------------- PROTECTED ROUTES -------------------- //
router.get("/me", requireAuth, getMe);
router.post("/logout", logout);

export default router;
