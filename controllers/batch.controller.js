import Batch from "../models/batch.js";

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







