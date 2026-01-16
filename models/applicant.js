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

    resumeId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "resumeModel",
    },
    resumeModel: {
      type: String,
      required: true,
      enum: ["StdResume", "EmployeeResume"],
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

    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // who deleted
  },
  { timestamps: true }
);


applicantSchema.index({ userId: 1, jobId: 1, isDeleted: 1 }, { unique: true });

applicantSchema.methods.softDelete = async function (userId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = userId;
  await this.save();
};

const Applicant = mongoose.model("Applicant", applicantSchema);
export default Applicant;
