import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const employerSchema = new mongoose.Schema(
  {
    employerId: { type: String, unique: true },
    fullName: { type: String, required: true, trim: true, index: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    phone: { type: String },
    companyName: { type: String },
    position: { type: String },
    address: { type: String },
    website: { type: String },
    description: { type: String },
    refreshToken: { type: String },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

employerSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 12);
  }
  if (!this.employerId) {
    const count = await mongoose.models.Employer.countDocuments();
    this.employerId = `EMP${(count + 1).toString().padStart(4, "0")}`;
  }
  next();
});

employerSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

employerSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    { _id: this._id, email: this.email, fullName: this.fullName, companyName: this.companyName, employerId: this.employerId },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
  );
};

employerSchema.methods.generateRefreshToken = function () {
  return jwt.sign({ _id: this._id }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: process.env.REFRESH_TOKEN_EXPIRY });
};

employerSchema.methods.softDelete = async function (userId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = userId;
  await this.save();
};

const Employer = mongoose.model("Employer", employerSchema);
export default Employer;
