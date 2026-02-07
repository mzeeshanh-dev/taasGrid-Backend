import mongoose from "mongoose";

/* ==================== Resume Schema ==================== */
const ResumeSchema = new mongoose.Schema({
    cv: {
        id: String,
        filename: String,
        uploadDate: String,
    },

    // // NEW fields
    // resumeUrl: { type: String, required: true },  // Cloudinary public URL
    // resumePublicId: { type: String, required: true }, // Cloudinary public_id
    // originalName: String,
    // size: Number,
    // uploadedAt: { type: Date, default: Date.now },
    // isAnalyzed: { type: Boolean, default: false },  // Whether AI has analyzed this resume

    extractedData: Object,
    analysis: {
        id: String,
        cvId: String,
        score: Number,
        matchPercentage: Number,
        matchDetails: String,

        // Score breakdown
        scoreBreakdown: {
            experience: {
                professional: Number,
                freelancing: Number,
                internship: Number,
                gapPenaltyApplied: Boolean,
                total: Number,
            },
            skills: {
                technical: Number,
                tools: Number,
                soft: Number,
                total: Number,
            },
            roleFit: Number,
            education: Number,
            location: Number,
            other: Number,
        },

        strengths: [String],
        gaps: [String],
        recommendations: [String],
        matchedSkills: [String],
        experienceMatch: String,
        locked: { type: Boolean, default: false },
        analyzedAt: Date,
    },
});

/* ==================== Batch Schema ==================== */
const BatchSchema = new mongoose.Schema(
    {
        batchId: { type: String, unique: true }, // e.g., BATCH0001
        jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true },
        batchNumber: { type: Number, required: true },
        name: { type: String, required: true }, // e.g., "Batch-01"

        // NEW batch-level processing states
        isIdle: { type: Boolean, default: true },
        isUploaded: { type: Boolean, default: true },
        isProcessing: { type: Boolean, default: false },
        isCompleted: { type: Boolean, default: false },
        isFailed: { type: Boolean, default: false },


        resumes: [ResumeSchema],
        isDeleted: { type: Boolean, default: false }, // Soft delete
        deletedAt: { type: Date },
        deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    },
    { timestamps: true }
);

/* ==================== Auto-generate batchId & batchNumber ==================== */
// BatchSchema.pre("save", async function (next) {
//     if (!this.batchId) {
//         const count = await mongoose.models.Batch.countDocuments({ jobId: this.jobId });
//         this.batchId = `BATCH${(count + 1).toString().padStart(4, "0")}`;
//         this.batchNumber = count + 1;
//     }
//     next();
// });

export default mongoose.model("Batch", BatchSchema);
