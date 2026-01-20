import mongoose from "mongoose";

const studentResumeSchema = new mongoose.Schema(
  {
    resumeId: { type: String, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    name: { type: String, required: true },
    title: { type: String },
    email: { type: String, required: true },
    phone: { type: String },
    location: { type: String },
    github: { type: String },
    linkedin: { type: String },
    summary: { type: String, required: true },
    skills: [{ type: String }],
    certifications: [{ name: { type: String } }],
    education: [
      { degree: { type: String }, institution: { type: String, required: true }, year: { type: String } }
    ],
    experience: [
      { role: { type: String }, company: { type: String }, years: { type: String } }
    ],
    projects: [
      { name: { type: String }, domain: { type: String }, description: { type: String }, link: { type: String } }
    ],
    filledSuggestions: {
      missing_details: [{ type: String }],
      missing_sections: [{ type: String }],
      suggested_additions: [{ type: String }],
      summary_improvement: [{ type: String }],
    },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true, collection: "stdresume" }
);

studentResumeSchema.pre("save", async function (next) {
  if (!this.resumeId) {
    const count = await mongoose.models.StdResume.countDocuments();
    this.resumeId = `STDRES${(count + 1).toString().padStart(4, "0")}`;
  }
  next();
});

studentResumeSchema.methods.softDelete = async function (userId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = userId;
  await this.save();
};

export const StudentResume =
  mongoose.models.StdResume || mongoose.model("StdResume", studentResumeSchema);


export default StudentResume;