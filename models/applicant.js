import mongoose from "mongoose";

const applicantSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: function () {
        return this.source === "Portal";
      },
    },

    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
    },

    resumeId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "resumeModel",
      required: function () {
        return this.source === "Portal";
      },
    },

    resumeModel: {
      type: String,
      enum: ["StdResume", "EmployeeResume", "BulkResume"],
      required: function () {
        return this.source === "Portal";
      },
    },

    score: { type: Number, default: 0 },

    source: {
      type: String,
      enum: ["Portal", "Bulk"],
      required: true,
      default: "Portal",
    },

    resumeUrl: { type: String },
    extractedData: { type: Object },

    // ---- STATUS ----
    status: {
      type: String,
      enum: ["Applied", "Reviewed", "Shortlisted", "Interviewed", "Rejected", "Hired"],
      default: "Applied",
    },

    // ---- BOOLEAN FLAGS (For easy filtering) ----
    isApplied: { type: Boolean, default: true },
    isReviewed: { type: Boolean, default: false },
    isShortlisted: { type: Boolean, default: false },
    isInterviewed: { type: Boolean, default: false },
    isHired: { type: Boolean, default: false },
    isRejected: { type: Boolean, default: false },

    // ---- HISTORY DATES ----
    appliedAt: { type: Date, default: Date.now },
    reviewedAt: { type: Date },
    shortlistedAt: { type: Date },
    interviewedAt: { type: Date },
    hiredAt: { type: Date },
    rejectedAt: { type: Date },

    // ---- DELETE ----
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);


// ----------------- UNIQUE INDEXES -----------------

// 1) Portal duplicate prevention
applicantSchema.index(
  { userId: 1, jobId: 1, source: 1, isDeleted: 1 },
  { unique: true, sparse: true }
);

// 2) Bulk email duplicate prevention (most important)
applicantSchema.index(
  { jobId: 1, "extractedData.personalInfo.email": 1, source: 1 },
  {
    unique: true,
    partialFilterExpression: {
      "extractedData.personalInfo.email": { $exists: true },
      source: "Bulk",
    },
  }
);


// ----------------- METHODS -----------------

applicantSchema.methods.softDelete = async function (userId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = userId;
  await this.save();
};


// ---- AUTO FLAG UPDATE WHEN STATUS CHANGES ----
// This ensures flags always match status
applicantSchema.pre("save", function (next) {
  const status = this.status;

  this.isApplied = status === "Applied";
  this.isReviewed = status === "Reviewed";
  this.isShortlisted = status === "Shortlisted";
  this.isInterviewed = status === "Interviewed";
  this.isHired = status === "Hired";
  this.isRejected = status === "Rejected";

  // history timestamps
  if (status === "Reviewed" && !this.reviewedAt) this.reviewedAt = new Date();
  if (status === "Shortlisted" && !this.shortlistedAt) this.shortlistedAt = new Date();
  if (status === "Interviewed" && !this.interviewedAt) this.interviewedAt = new Date();
  if (status === "Hired" && !this.hiredAt) this.hiredAt = new Date();
  if (status === "Rejected" && !this.rejectedAt) this.rejectedAt = new Date();

  next();
});


const Applicant = mongoose.model("Applicant", applicantSchema);
export default Applicant;
