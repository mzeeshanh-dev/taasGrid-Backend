import mongoose from "mongoose";

const BatchResumeSchema = new mongoose.Schema({
    jobId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Job",
        required: true,
        index: true,
    },
    batchId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    resumes: [
        {
            cvId: { type: String, required: true },
            resumeUrl: { type: String, required: true },
            resumePublicId: { type: String, required: true },
            resourceType: { type: String, default: "raw" },
            originalName: String,
            size: Number,
            uploadedAt: { type: Date, default: Date.now },
            isAnalyzed: { type: Boolean, default: false }
        },
    ],
}, { timestamps: true });

export default mongoose.model("BatchResume", BatchResumeSchema);
