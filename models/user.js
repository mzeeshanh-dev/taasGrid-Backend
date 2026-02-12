import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const userSchema = mongoose.Schema(
    {
        userId: { type: String, unique: true },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        name: { type: String, required: true, trim: true, index: true },
        password: { type: String, required: [true, "Password is required"] },
        role: { type: String, required: true },
        level: { type: String, enum: ["basic", "premium"], default: "basic" },
        status: {
            type: String,
            default: "Active"
        },

        isDeleted: { type: Boolean, default: false },
        deletedAt: { type: Date },
        deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    },
    { timestamps: true }
);

userSchema.pre("save", async function (next) {
    if (this.isModified("password")) {
        this.password = await bcrypt.hash(this.password, 12);
    }

    if (!this.userId) {
        const count = await mongoose.models.User.countDocuments();
        this.userId = `USR${(count + 1).toString().padStart(4, "0")}`;
    }

    next();
});

userSchema.methods.isPasswordCorrect = async function (password) {
    return await bcrypt.compare(password, this.password);
};

userSchema.methods.generateAccessToken = function () {
    return jwt.sign(
        { _id: this._id, email: this.email, fullName: this.name },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
    );
};

userSchema.methods.generateRefreshToken = function () {
    return jwt.sign(
        { _id: this._id },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: process.env.REFRESH_TOKEN_EXPIRY }
    );
};

userSchema.methods.softDelete = async function (userId) {
    this.isDeleted = true;
    this.deletedAt = new Date();
    this.deletedBy = userId;
    await this.save();
};

const User = mongoose.model("User", userSchema);
export default User;
