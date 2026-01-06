import express from "express";
import { createFyp, getFyps, getFypById, deleteFyp } from "../controllers/fyp.controller.js";

const router = express.Router();

router.post("/", createFyp);
router.get("/", getFyps);
router.get("/:id", getFypById);
router.delete("/:id", deleteFyp);

export default router;
