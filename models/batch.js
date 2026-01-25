import mongoose from "mongoose";

const ResumeSchema = new mongoose.Schema({
    cv: {
        id: String,
        filename: String,
        uploadDate: String,
    },
    extractedData: Object,
    analysis: {
        id: String,
        cvId: String,
        score: Number,
        matchPercentage: Number,
        matchDetails: String,

        // NEW
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


const BatchSchema = new mongoose.Schema(
    {
        batchId: { type: String, unique: true },        // Auto-generated ID, e.g., BATCH0001
        jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true }, // Job linkage
        batchNumber: { type: Number, required: true },  // Batch sequence for the job
        name: { type: String, required: true },         // e.g., "Batch-01"
        resumes: [ResumeSchema],
        isDeleted: { type: Boolean, default: false },   // Soft delete
        deletedAt: { type: Date },
        deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    },
    { timestamps: true }
);

BatchSchema.pre("save", async function (next) {
    if (!this.batchId) {
        const count = await mongoose.models.Batch.countDocuments({ jobId: this.jobId });
        this.batchId = `BATCH${(count + 1).toString().padStart(4, "0")}`; // e.g., BATCH0001, BATCH0002
        this.batchNumber = count + 1;
    }
    next();
});

export default mongoose.model("Batch", BatchSchema);
