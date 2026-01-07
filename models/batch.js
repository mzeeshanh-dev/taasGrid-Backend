import mongoose from "mongoose";

const ResumeSchema = new mongoose.Schema({
    cv: {
        id: String,
        filename: String,
        uploadDate: String
    },
    extractedData: Object,
    analysis: {
        id: String,
        cvId: String,
        score: Number,
        matchPercentage: Number,
        matchDetails: String,
        strengths: [String],
        gaps: [String],
        recommendations: [String],
        matchedSkills: [String],
        experienceMatch: String,
        locked: { type: Boolean, default: false },
        analyzedAt: Date
    }
});

const BatchSchema = new mongoose.Schema({
    name: { type: String, default: "single-batch" }, // For now, single batch
    resumes: [ResumeSchema],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model("Batch", BatchSchema);
