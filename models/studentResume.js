import mongoose from "mongoose";

const studentResumeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // ✅ Only one resume per user
    },

    name: { type: String, required: true },
    title: { type: String },
    email: { type: String, required: true },
    phone: { type: String },
    location: { type: String },
    github: { type: String },
    linkedin: { type: String },
    summary: { type: String, required: true },

    // ✅ Skills, Certifications, Education, Experience, Projects
    skills: [{ type: String }],
    certifications: [
      {
        name: { type: String },
      },
    ],
    education: [
      {
        degree: { type: String },
        institution: { type: String, required: true },
        year: { type: String },
      },
    ],
    experience: [
      {
        role: { type: String },
        company: { type: String },
        years: { type: String },
      },
    ],
    projects: [
      {
        name: { type: String },
        domain: { type: String },
        description: { type: String },
        link: { type: String },
      },
    ],

    // ✅ AI Enhancement Fields (Optional)
    filledSuggestions: {
      missing_details: [{ type: String }],
      missing_sections: [{ type: String }],
      suggested_additions: [{ type: String }],
      summary_improvement: [{ type: String }],
    },
  },
  { timestamps: true, collection: "stdresume" }
);

export const StudentResume =
  mongoose.models.StdResume || mongoose.model("StdResume", studentResumeSchema);
