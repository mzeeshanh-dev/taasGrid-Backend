// const express = require("express");
import express from "express";
import {
  registerUser,
  login,
  refreshToken,
  logout,
} from "../controllers/user.controller.js";


const router = express.Router();

router.post("/register", registerUser);
router.post("/login", login);
router.post("/refresh-token", refreshToken);
router.post("/logout", logout);

// module.exports = router;
export default router;
