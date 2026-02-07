import Batch from "../models/batch.js";
import BatchResume from "../models/batchResume.js";
import { uploadFile, deleteFile } from "../utils/cloudinaryService.js";
import crypto from 'crypto'

// --------------------- Upload / Add or Update Resumes ---------------------
export const uploadBatchResumes = async (req, res) => {
    try {
        const { jobId, batchNumber, cvs } = req.body;
        if (!jobId || !cvs?.length)
            return res.status(400).json({ message: "jobId & cvs required" });

        let batch = await Batch.findOne({ jobId, batchNumber });

        if (!batch) {
            batch = new Batch({
                jobId,
                batchNumber,
                name: `Batch-${String(batchNumber).padStart(2, "0")}`,
                resumes: [],
            });
        }

        cvs.forEach((cv) => {
            const idx = batch.resumes.findIndex(r => r.cv.id === cv.id);
            if (idx >= 0) batch.resumes[idx] = cv;
            else batch.resumes.push(cv);
        });

        await batch.save();
        res.json({ success: true, batch });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};


// --------------------- Get batch resumes ---------------------
export const getBatchResumes = async (req, res) => {
    try {
        const { jobId } = req.params;     // <-- use params now

        if (!jobId) {
            return res.status(400).json({ message: "jobId required" });
        }

        const batches = await Batch.find({ jobId }).sort({ batchNumber: 1 });
        return res.json({ batches });
    } catch (error) {
        console.error("Get batch resumes error:", error);
        return res.status(500).json({ message: error.message });
    }
};



// --------------------- Update batch / patch analysis ---------------------
export const updateBatchResume = async (req, res) => {
    try {
        const { cvId, analysis } = req.body;
        const { batchId } = req.params;

        if (!cvId || !analysis) return res.status(400).json({ message: "cvId and analysis required" });

        const batch = await Batch.findOne({ batchId });
        if (!batch) return res.status(404).json({ message: "Batch not found" });

        const idx = batch.resumes.findIndex(r => r.cv.id === cvId);
        if (idx === -1) return res.status(404).json({ message: "Resume not found" });

        batch.resumes[idx].analysis = analysis;
        await batch.save();

        res.json({ success: true, resume: batch.resumes[idx] });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


// --------------------- Clear batch ---------------------
export const clearBatch = async (req, res) => {
    try {
        const { batchId } = req.params;
        const batch = await Batch.findOne({ batchId });

        if (batch) {
            batch.resumes = [];
            await batch.save();
        }

        res.json({ success: true, message: "Batch cleared" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};




export const getAllBatchCandidates = async (req, res) => {
    try {
        const batches = await Batch.find({}).sort({ batchNumber: 1 });

        let allResumes = [];
        batches.forEach(batch => {
            allResumes = allResumes.concat(batch.resumes || []);
        });

        // Remove duplicates by cv.id
        const uniqueResumesMap = new Map();
        allResumes.forEach(resume => {
            if (!uniqueResumesMap.has(resume.cv.id)) {
                uniqueResumesMap.set(resume.cv.id, resume);
            }
        });

        const uniqueResumes = Array.from(uniqueResumesMap.values());

        res.json({ success: true, candidates: uniqueResumes });

    } catch (err) {
        console.error("Get all batch candidates error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};




// utils/skills.js
export const normalizeSkill = (skill) => {
    if (!skill || typeof skill !== "string") return null;

    let s = skill.trim().toLowerCase();

    // Define normalization mapping
    const mapping = {
        "c#": "C#",
        "c sharp": "C#",
        "c++": "C++",
        "cpp": "C++",
        "js": "JavaScript",
        "javascript": "JavaScript",
        "ts": "TypeScript",
        "typescript": "TypeScript",
        "py": "Python",
        "python": "Python",
        "reactjs": "React",
        "react": "React",
        "nodejs": "Node.js",
        "node": "Node.js",
        "expressjs": "Express",
        "express": "Express",
        "html": "HTML",
        "css": "CSS",
        "sql": "SQL",
        "mongodb": "MongoDB",
        "docker": "Docker",
        "kubernetes": "Kubernetes"
        // add more as needed
    };

    // Map normalized value
    if (mapping[s]) return mapping[s];

    // Capitalize first letter for unknown skills
    return s.charAt(0).toUpperCase() + s.slice(1);
};


// Controller: Get all unique skills for a job
export const getJobSkills = async (req, res) => {
    try {
        const { jobId } = req.params;
        if (!jobId) return res.status(400).json({ message: "jobId required" });

        const batches = await Batch.find({ jobId }).sort({ batchNumber: 1 });

        const skillCategories = {
            technical: new Set(),
            tools: new Set(),
            soft: new Set()
        };

        batches.forEach(batch => {
            batch.resumes.forEach(resume => {
                // Extract skills from resume's extractedData
                const skills = resume.extractedData?.skills || {};

                Object.keys(skillCategories).forEach(cat => {
                    (skills[cat] || []).forEach(skill => {
                        const normalized = normalizeSkill(skill);
                        if (normalized) skillCategories[cat].add(normalized);
                    });
                });

                // Also include matchedSkills for job relevance
                (resume.analysis?.matchedSkills || []).forEach(skill => {
                    const normalized = normalizeSkill(skill);
                    if (normalized) skillCategories.technical.add(normalized);
                });
            });
        });

        // Convert sets to sorted arrays
        const result = {};
        Object.keys(skillCategories).forEach(cat => {
            result[cat] = Array.from(skillCategories[cat]).sort((a, b) => a.localeCompare(b));
        });

        res.json({ success: true, skills: result });

    } catch (err) {
        console.error("Get job skills error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};


export const uploadResumesToCloud = async (req, res) => {
    try {
        const { jobId, batchNumber } = req.body;
        const files = req.files;

        if (!jobId) return res.status(400).json({ message: "jobId required" });
        if (!files || files.length === 0) return res.status(400).json({ message: "No files uploaded" });

        /* ---------------- Determine Batch Number ---------------- */
        let bn;

        if (batchNumber) {
            bn = Number(batchNumber);
            if (isNaN(bn)) return res.status(400).json({ message: "Invalid batchNumber" });
        } else {
            const lastBatch = await BatchResume.findOne({ jobId }).sort({ createdAt: -1 });
            if (lastBatch) {
                const lastNum = parseInt(lastBatch.batchId.split("-").pop());
                bn = lastNum + 1;
            } else {
                bn = 1;
            }
        }

        /* ---------------- Generate BatchId Same Format ---------------- */
        let batchId = `BATCH-${jobId}-${String(bn).padStart(4, "0")}`;

        /* ---------------- Fetch or Create BatchResume Doc ---------------- */
        let batchResume = await BatchResume.findOne({ batchId });

        if (!batchResume) {
            batchResume = new BatchResume({
                jobId,
                batchId,
                resumes: [],
            });
        }

        const newFileNames = files.map(f => f.originalname);

        /* ---------------- Remove old resumes not in new upload ---------------- */
        const toRemove = batchResume.resumes.filter(r => !newFileNames.includes(r.originalName));

        await Promise.all(
            toRemove.map(async (r) => {
                if (r.resumePublicId) {
                    await deleteFile(r.resumePublicId, r.resourceType || "raw");
                }
            })
        );

        batchResume.resumes = batchResume.resumes.filter(r => newFileNames.includes(r.originalName));

        /* ---------------- Upload / Overwrite ---------------- */
        for (const file of files) {
            const existingIndex = batchResume.resumes.findIndex(
                r => r.originalName === file.originalname
            );

            if (existingIndex >= 0) {
                const oldResume = batchResume.resumes[existingIndex];
                if (oldResume.resumePublicId) {
                    await deleteFile(oldResume.resumePublicId, oldResume.resourceType || "raw");
                }
            }

            const uploaded = await uploadFile(file.buffer, file.originalname, "resumes");

            const resumeData = {
                cvId: existingIndex >= 0
                    ? batchResume.resumes[existingIndex].cvId
                    : crypto.randomUUID(),

                resumeUrl: uploaded.url,
                resumePublicId: uploaded.publicId,
                originalName: uploaded.originalName,
                resourceType: uploaded.resourceType,
                size: file.size,
                uploadedAt: new Date(),
                isAnalyzed: false,
            };

            if (existingIndex >= 0) {
                batchResume.resumes[existingIndex] = resumeData;
            } else {
                batchResume.resumes.push(resumeData);
            }
        }

        await batchResume.save();

        return res.json({
            success: true,
            batchId: batchResume.batchId,
            totalResumes: batchResume.resumes.length,
        });

    } catch (err) {
        console.error("Upload error:", err);
        res.status(500).json({ message: err.message });
    }
};





/* ================= Remove CV ================= */
export const removeResumeFromBatch = async (req, res) => {
    try {
        const { batchId, cvId } = req.body;

        if (!batchId || !cvId) {
            return res.status(400).json({ message: "batchId & cvId required" });
        }

        const batchResume = await BatchResume.findOne({ batchId });

        if (!batchResume) {
            return res.status(404).json({ message: "Batch not found" });
        }

        const index = batchResume.resumes.findIndex(r => r.cvId === cvId);

        if (index === -1) {
            return res.status(404).json({ message: "Resume not found" });
        }

        const resume = batchResume.resumes[index];

        if (resume.resumePublicId) {
            await deleteFile(resume.resumePublicId, resume.resourceType || "raw");
        }

        batchResume.resumes.splice(index, 1);
        await batchResume.save();

        return res.json({
            success: true,
            message: "Resume deleted from DB & Cloudinary",
        });

    } catch (err) {
        console.error("Remove error:", err);
        res.status(500).json({ message: err.message });
    }
};



// --------------------- Update Batch Status ---------------------
export const updateBatchStatus = async (req, res) => {
    try {
        const { batchId } = req.params;
        const {
            isIdle,
            isProcessing,
            isCompleted,
            isFailed,
            isUploaded
        } = req.body;

        if (!batchId) {
            return res.status(400).json({ message: "batchId required" });
        }

        const batch = await Batch.findOne({ batchId, isDeleted: false });
        if (!batch) {
            return res.status(404).json({ message: "Batch not found" });
        }

        // 🔹 Only update fields that are explicitly provided
        if (typeof isIdle === "boolean") batch.isIdle = isIdle;
        if (typeof isProcessing === "boolean") batch.isProcessing = isProcessing;
        if (typeof isCompleted === "boolean") batch.isCompleted = isCompleted;
        if (typeof isFailed === "boolean") batch.isFailed = isFailed;
        if (typeof isUploaded === "boolean") batch.isUploaded = isUploaded;

        await batch.save();

        res.json({
            success: true,
            message: "Batch status updated",
            batchStatus: {
                batchId: batch.batchId,
                isIdle: batch.isIdle,
                isProcessing: batch.isProcessing,
                isCompleted: batch.isCompleted,
                isFailed: batch.isFailed,
                isUploaded: batch.isUploaded,
            },
        });

    } catch (err) {
        console.error("Update batch status error:", err);
        res.status(500).json({ message: err.message });
    }
};
