import mongoose from "mongoose";

const FypSchema = new mongoose.Schema(
  {
    fypId: { type: String, unique: true },
    title: { type: String, required: true, trim: true },
    description: {
      type: String,
      required: true,
      validate: {
        validator: function (value) {
          const wordCount = value.trim().split(/\s+/).length;
          return wordCount <= 500;
        },
        message: "Description cannot exceed 500 words.",
      },
    },
    domain: { type: String, required: true },
    duration: { type: String, enum: ["3 Months", "6 Months", "1 Year"], required: true },
    collaborationMode: { type: String, enum: ["On-site", "Remote", "Hybrid"], required: true },
    requirements: { type: String },
    location: { type: String },
    postedBy: { type: mongoose.Schema.Types.ObjectId, refPath: "postedByModel", required: true },
    postedByModel: { type: String, required: true, enum: ["Company"] },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

FypSchema.pre("save", async function (next) {
  if (!this.fypId) {
    const count = await mongoose.models.Fyp.countDocuments();
    this.fypId = `FYP${(count + 1).toString().padStart(4, "0")}`;
  }
  next();
});

FypSchema.methods.softDelete = async function (userId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = userId;
  await this.save();
};

const Fyp = mongoose.model("Fyp", FypSchema);
export default Fyp;
