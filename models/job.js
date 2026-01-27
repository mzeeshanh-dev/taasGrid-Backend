import mongoose from "mongoose";

const JobSchema = new mongoose.Schema(
  {
    jobId: { type: String, unique: true },

    title: {
      type: String,
      required: [true, "Job title is required"],
      trim: true,
    },

    description: {
      type: String,
      required: [true, "Job description is required"],
      maxlength: 5000,
      trim: true,
    },

    experience: {
      type: String,
      enum: ["Fresher", "1-2 years", "3-4 years", "5-6 years", "6+ years"],
      required: true,
    },

    qualification: {
      type: String,
      enum: ["High School", "Diploma", "Bachelor's", "Master's", "Doctorate"],
      required: true,
    },

    location: {
      type: String,
      required: true,
      trim: true,
    },

    salary: {
      type: String,
      enum: [
        "$100-$300",
        "$300-$500",
        "$500-$800",
        "$800-$1000",
        "$1000-$1500",
        "$1500-$2000",
        "$2000-$2500",
        "$2500-$3000",
        "$3000+",
      ],
      required: true,
    },

    jobType: {
      type: String,
      enum: ["Full-time", "Part-time", "Contract", "Internship", "Other"],
      required: true,
    },

    workType: {
      type: String,
      enum: ["On-Site", "Hybrid", "Remote"],
      required: true,
    },

    requirements: {
      type: [String],
      required: true,
    },

    // ✅ UPDATED: Scheduled added
    status: {
      type: String,
      enum: ["Active", "Draft", "Scheduled", "Inactive", "Closed"],
      default: "Active",
    },

    // ✅ Used for Schedule Later
    scheduleDate: {
      type: Date,
      default: null,
    },

    // ✅ Mandatory
    closingDate: {
      type: Date,
      required: [true, "Closing date is required"],
    },

    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },

    deletedAt: {
      type: Date,
    },

    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

// Auto-generate Job ID
JobSchema.pre("save", async function (next) {
  if (!this.jobId) {
    const count = await mongoose.models.Job.countDocuments();
    this.jobId = `JOB${String(count + 1).padStart(4, "0")}`;
  }
  next();
});

// Soft delete method
JobSchema.methods.softDelete = async function (userId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = userId;
  await this.save();
};

export default mongoose.model("Job", JobSchema);
