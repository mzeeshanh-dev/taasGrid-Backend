import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const companySchema = new mongoose.Schema(
  {
    companyId: { type: String, unique: true },
    companyName: { type: String, required: true, trim: true, index: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    password: { type: String, required: true },
    phone: { type: String },
    address: { type: String },
    website: { type: String },
    description: { type: String },
    industry: { type: String },
    size: { type: String, default: "1-10 employees" },
    plan: { type: String, enum: ["basic", "premium"], default: "basic" },
    refreshToken: { type: String },
    establishedYear: { type: Number, min: 1800, max: new Date().getFullYear() },
    logo: { type: String },
    isDeleted: { type: Boolean, default: false },
    status: { type: String, enum: ["Active", "Suspended", "Blocked"], default: "Active" },
    deletedAt: { type: Date },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

companySchema.pre("save", async function (next) {
  if (!this.companyId) {
    const count = await mongoose.models.Company.countDocuments();
    this.companyId = `COMP${(count + 1).toString().padStart(4, "0")}`;
  }
  next();
});

companySchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

companySchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

companySchema.methods.generateAccessToken = function () {
  return jwt.sign(
    { _id: this._id, email: this.email, companyName: this.companyName, companyId: this.companyId },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY || "15m" }
  );
};

companySchema.methods.generateRefreshToken = function () {
  return jwt.sign({ _id: this._id }, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: process.env.REFRESH_TOKEN_EXPIRY || "7d",
  });
};

companySchema.methods.softDelete = async function (userId) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = userId;
  await this.save();
};

const Company = mongoose.model("Company", companySchema);
export default Company;
