import mongoose from "mongoose";

const applicantSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
    },
    // Dynamic resume reference: can point to StdResume or EmployeeResume
    resumeId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "resumeModel",
    },
    resumeModel: {
      type: String,
      required: true,
      enum: ["StdResume", "EmployeeResume"], // restrict to valid models
    },
    status: {
      type: String,
      enum: ["Applied", "Reviewed", "Shortlisted", "Rejected", "Hired"],
      default: "Applied",
    },
    appliedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true } // adds createdAt and updatedAt automatically
);

// Compound index: prevent same user applying to the same job more than once
applicantSchema.index({ userId: 1, jobId: 1 }, { unique: true });

const Applicant = mongoose.model("Applicant", applicantSchema);
export default Applicant;
