import mongoose from "mongoose";

const educationSchema = new mongoose.Schema({
  degree: String,
  institution: String,
  year: String,
});

const experienceSchema = new mongoose.Schema({
  role: String,
  company: String,
  years: String,
});

const bookAuthorshipSchema = new mongoose.Schema({
  title: String,
  publisher: String,
});

const journalGuestEditorSchema = new mongoose.Schema({
  title: String,
  publisher: String,
  section: String,
});

const researchPublicationSchema = new mongoose.Schema({
  title: String,
  journal: String,
  year: String,
});

const supervisedSchema = new mongoose.Schema({
  studentName: String,
  thesisTitle: String,
  year: String,
});

const researchProjectSchema = new mongoose.Schema({
  title: String,
  description: String,
});

const professionalActivitySchema = new mongoose.Schema({
  heading: String,
  desc: String,
  year: String,
});

const professionalTrainingSchema = new mongoose.Schema({
  title: String,
  description: String,
  year: String,
});

const technicalSkillSchema = new mongoose.Schema({
  category: String,
  details: String,
});

const membershipSchema = new mongoose.Schema({
  heading: String,
  desc: String,
  year: String,
});

const referenceSchema = new mongoose.Schema({
  prof: String,
  designation: String,
  mail: String,
  phone: String,
});

const aiSuggestionSchema = new mongoose.Schema({
  missing_details: [{ type: String }],
  missing_sections: [{ type: String }],
  suggested_additions: [{ type: String }],
  summary_improvement: [{ type: String }],
});

const employeeResumeSchema = new mongoose.Schema(
  {
    resumeId: { type: String, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    email: { type: String },
    phone: { type: String },
    citations: { type: Number },
    impactFactor: { type: Number },
    scholar: { type: String },
    education: [educationSchema],
    experience: [experienceSchema],
    achievements: [String],
    bookAuthorship: [bookAuthorshipSchema],
    journalGuestEditor: [journalGuestEditorSchema],
    researchPublications: [researchPublicationSchema],
    mssupervised: [supervisedSchema],
    phdstudentsupervised: [supervisedSchema],
    researchProjects: [researchProjectSchema],
    professionalActivities: [professionalActivitySchema],
    professionalTraining: [professionalTrainingSchema],
    technicalSkills: [technicalSkillSchema],
    membershipsAndOtherAssociations: [membershipSchema],
    reference: [referenceSchema],
    ai_suggestions: aiSuggestionSchema,
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

employeeResumeSchema.pre("save", async function (next) {
  if (!this.resumeId) {
    const count = await mongoose.models.EmployeeResume.countDocuments();
    this.resumeId = `EMPRES${(count + 1).toString().padStart(4, "0")}`;
  }
  next();
});

employeeResumeSchema.methods.softDelete = async function (userId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = userId;
  await this.save();
};

const EmployeeResume = mongoose.model("EmployeeResume", employeeResumeSchema);
export default EmployeeResume;
