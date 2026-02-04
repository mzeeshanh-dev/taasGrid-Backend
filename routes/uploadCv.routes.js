import express from "express";
import multer from "multer";
import { uploadFile, deleteFile } from "../utils/cloudinaryService.js";

const router = express.Router();
const upload = multer();

/* ==================== UPLOAD ==================== */
router.post("/upload", upload.single("cv"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: "No file provided" });

        const { originalname, buffer, mimetype, size } = req.file;

        console.log("Uploading file:", { originalname, mimetype, size });

        const uploaded = await uploadFile(buffer, originalname, "cvs");

        res.json({
            message: "File uploaded successfully",
            url: uploaded.url,         // PDF opens in browser
            publicId: uploaded.publicId, // no .pdf
            resourceType: uploaded.resourceType,
            originalName: uploaded.originalName,
            size: uploaded.bytes,
            format: uploaded.format
        });
    } catch (err) {
        console.error("Upload failed:", err);
        res.status(500).json({ message: "Upload failed", error: err.message });
    }
});

/* ==================== DELETE ==================== */
router.delete("/delete", async (req, res) => {
    try {
        const { publicId, resourceType } = req.body;
        if (!publicId) return res.status(400).json({ message: "publicId required" });

        const result = await deleteFile(publicId, resourceType);

        res.json({ message: "File deleted successfully", details: result });
    } catch (err) {
        console.error("Deletion failed:", err);
        res.status(500).json({ message: "Deletion failed", error: err.message });
    }
});

/* ==================== UPDATE FILE ==================== */
router.patch("/update", upload.single("cv"), async (req, res) => {
    try {
        const { publicId, resourceType } = req.body;
        if (!publicId) return res.status(400).json({ message: "publicId required" });
        if (!req.file) return res.status(400).json({ message: "No new file provided" });

        // Delete old file first
        await deleteFile(publicId, resourceType);

        // Upload new file in the same folder
        const folder = publicId.includes('/') ? publicId.split('/')[0] : 'cvs';
        const uploaded = await uploadFile(req.file.buffer, req.file.originalname, folder);

        res.json({
            message: "File updated successfully",
            url: uploaded.url,
            publicId: uploaded.publicId,
            resourceType: uploaded.resourceType,
            originalName: uploaded.originalName,
            size: uploaded.bytes
        });
    } catch (err) {
        console.error("Update failed:", err);
        res.status(500).json({ message: "File update failed", error: err.message });
    }
});

export default router;
