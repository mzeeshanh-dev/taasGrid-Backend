import mongoose from "mongoose";

const projectSchema = new mongoose.Schema(
    {
        projectId: { type: String, unique: true },

        title: { type: String, required: true, trim: true },
        description: { type: String, required: true },

        category: { type: String, required: true },
        subCategory: { type: String },
        skills: [{ type: String, required: true }],

        budget: { type: Number, required: true },
        currency: { type: String, default: "USD" },

        projectType: { type: String, enum: ["Fixed", "Hourly"], required: true },
        duration: { type: String, required: true }, // eg: 1 month, 3 months

        deadline: { type: Date, required: true },

        status: {
            type: String,
            enum: ["Open", "In Progress", "Completed", "Cancelled"],
            default: "Open",
        },

        postedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
        postedByModel: { type: String, required: true, enum: ["Company"] },

        attachments: [{ type: String }],

        // Bidding & Proposals
        bidsCount: { type: Number, default: 0 },
        proposalsCount: { type: Number, default: 0 },

        isDeleted: { type: Boolean, default: false },
        deletedAt: { type: Date },
        deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Company" },
    },
    { timestamps: true }
);

// Auto generate projectId
projectSchema.pre("save", async function (next) {
    if (!this.projectId) {
        const count = await mongoose.models.Project.countDocuments();
        this.projectId = `PROJ${(count + 1).toString().padStart(5, "0")}`;
    }
    next();
});

const Project = mongoose.model("Project", projectSchema);
export default Project;
