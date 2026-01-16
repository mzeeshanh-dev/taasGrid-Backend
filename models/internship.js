import mongoose from "mongoose";

const internshipSchema = new mongoose.Schema(
  {
    internshipId: { type: String, unique: true },
    title: { type: String, required: true },
    description: { type: String },
    duration: { type: String },
    qualification: { type: String },
    location: { type: String },
    requirements: { type: String },
    stipend: { type: String },
    type: { type: String, default: "Internship" },
    postedBy: { type: mongoose.Schema.Types.ObjectId, refPath: "postedByModel", required: true },
    postedByModel: { type: String, required: true, enum: ["Company", "User"] },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

internshipSchema.pre("save", async function (next) {
  if (!this.internshipId) {
    const count = await mongoose.models.Internship.countDocuments();
    this.internshipId = `INTR${(count + 1).toString().padStart(4, "0")}`;
  }
  next();
});

internshipSchema.methods.softDelete = async function (userId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = userId;
  await this.save();
};

const Internship = mongoose.model("Internship", internshipSchema);
export default Internship;
