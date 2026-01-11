import Batch from "../models/batch.js";

// --------------------- Upload / Add or Update Resumes ---------------------
export const uploadBatchResumes = async (req, res) => {
    try {
        const filesData = req.body.cvs; // expected: array of processedCvs from analyzer
        if (!filesData || !filesData.length) return res.status(400).json({ message: "No CV data provided" });

        // Single-batch logic: find batch or create
        let batch = await Batch.findOne();
        if (!batch) {
            batch = new Batch({ resumes: [] });
        }

        filesData.forEach((cv) => {
            // check if resume already exists -> update or push
            const idx = batch.resumes.findIndex(r => r.cvId === cv.id);
            const experience = cv.extractedData.experience || [];
            const expMap = { professionalJob: 0, internship: 0, freelancing: 0, miscellaneous: 0 };
            experience.forEach(e => {
                const key = e.type?.toLowerCase().replace(/\s/g, "");
                if (key && expMap[key] !== undefined) expMap[key] += e.durationMonths || 0;
            });
            const totalExperience = Object.values(expMap).reduce((a, b) => a + b, 0);

            const resumeData = {
                cvId: cv.id,
                filename: cv.filename,
                uploadDate: cv.uploadDate,
                personalInfo: cv.extractedData.personalInfo || {},
                degree: cv.extractedData.education?.[0]?.degree || "",
                gpa: cv.extractedData.education?.[0]?.gpa || null,
                experience: expMap,
                totalExperience,
                skills: cv.extractedData.skills?.technical || [],
                summary: cv.extractedData.summary || "",
                analysis: cv.analysis || {}
            };

            if (idx >= 0) batch.resumes[idx] = resumeData; // update
            else batch.resumes.push(resumeData);           // add new
        });

        await batch.save();
        res.json({ success: true, resumes: batch.resumes });
    } catch (error) {
        console.error("Batch upload error:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// --------------------- Get batch resumes ---------------------
export const getBatchResumes = async (req, res) => {
    try {
        const batches = await Batch.find().sort({ createdAt: 1 });
        res.json({ batches });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


// --------------------- Update batch / patch analysis ---------------------
export const updateBatchResume = async (req, res) => {
    try {
        const { cvId, analysis } = req.sbody;
        if (!cvId || !analysis) return res.status(400).json({ message: "cvId and analysis required" });

        const batch = await Batch.findOne();
        if (!batch) return res.status(404).json({ message: "Batch not found" });

        const idx = batch.resumes.findIndex(r => r.cvId === cvId);
        if (idx === -1) return res.status(404).json({ message: "Resume not found" });

        batch.resumes[idx].analysis = analysis;
        await batch.save();

        res.json({ success: true, resume: batch.resumes[idx] });
    } catch (error) {
        console.error("Batch update error:", error);
        res.status(500).json({ message: error.message });
    }
};

// --------------------- Clear batch ---------------------
export const clearBatch = async (req, res) => {
    try {
        const batch = await Batch.findOne();
        if (batch) {
            batch.resumes = [];
            await batch.save();
        }
        res.json({ success: true, message: "Batch cleared" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
