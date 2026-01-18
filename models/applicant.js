import mongoose from "mongoose";

const applicantSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      // Portal ke liye zaroori hai, Bulk ke liye hum auto-generate karenge controller mein
      required: function () { return this.source === "Portal"; },
    },
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
    },
    resumeId: {
      type: mongoose.Schema.Types.ObjectId,
      // Portal candidates ke liye resume reference zaroori hai
      required: function () { return this.source === "Portal"; },
      refPath: "resumeModel",
    },
    resumeModel: {
      type: String,
      required: function () { return this.source === "Portal"; },
      enum: ["StdResume", "EmployeeResume", "BulkResume"],
    },
    // ✅ SOURCE logic strictly added
    source: {
      type: String,
      enum: ["Portal", "Bulk"],
      required: true,
      default: "Portal",
    },
    // Bulk candidates ka data direct strings/objects mein store hoga
    resumeUrl: { type: String },
    extractedData: { type: Object },

    status: {
      type: String,
      enum: ["Applied", "Reviewed", "Shortlisted", "Rejected", "Hired"],
      default: "Applied",
    },
    appliedAt: { type: Date, default: Date.now },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

// --- 🎯 KEY FIX: Index Logic ---
// Humne source ko index mein add kiya hai.
// Iska faida: Ek user (Portal) ek hi baar apply kar sakega, 
// lekin Bulk candidates (jinka userId generate hota hai) kabhi block nahi honge.
applicantSchema.index(
  { userId: 1, jobId: 1, source: 1, isDeleted: 1 },
  { unique: true, sparse: true }
);

applicantSchema.methods.softDelete = async function (userId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = userId;
  await this.save();
};

const Applicant = mongoose.model("Applicant", applicantSchema);
export default Applicant;