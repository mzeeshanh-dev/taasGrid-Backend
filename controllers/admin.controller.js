import User from "../models/user.js";
import Company from "../models/company.js";
import Job from "../models/job.js";
import Applicant from "../models/applicant.js";
import Fyp from "../models/fyp.js";
import Internship from "../models/internship.js";
import Batch from "../models/batch.js";
import BatchResume from "../models/batchResume.js"; // IMPORTANT

// ----------------- DASHBOARD STATS -----------------

export const getDashboardStats = async (req, res) => {
    try {

        // Total Applicants (also Total CVs)
        const totalApplicants = await Applicant.countDocuments({ isDeleted: false });

        const totalCompanies = await Company.countDocuments({ isDeleted: false });
        const totalJobs = await Job.countDocuments({ isDeleted: false });

        res.status(200).json({
            success: true,
            data: {
                totalCVs: totalApplicants,   // same value
                totalApplicants,
                totalCompanies,
                totalJobs
            },
            message: "Dashboard stats fetched successfully",
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// ----------------- USER MANAGEMENT -----------------
export const getAllUsers = async (req, res) => {
    try {
        const users = await User.find({ isDeleted: false }).select("-password").sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: users });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const createUser = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        if (!name || !email || !password || !role) {
            return res.status(400).json({ success: false, message: "All fields are required" });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ success: false, message: "Email already exists" });

        const newUser = await User.create({ name, email, password, role });
        res.status(201).json({ success: true, data: newUser, message: "User created successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const suspendUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findById(userId);
        if (!user || user.isDeleted) return res.status(404).json({ success: false, message: "User not found" });

        user.role = "Suspended";
        await user.save();

        res.status(200).json({ success: true, message: "User suspended successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteUser = async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId);
        if (!user || user.isDeleted) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const deletedBy = req.user?._id || null;

        user.isDeleted = true;
        user.deletedAt = new Date();
        user.deletedBy = deletedBy;

        await user.save();

        res.status(200).json({
            success: true,
            message: "User deleted successfully"
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// ----------------- COMPANY MANAGEMENT -----------------
export const getAllCompanies = async (req, res) => {
    try {
        const companies = await Company.find({ isDeleted: false }).sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: companies });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getCompanyJobs = async (req, res) => {
    try {
        const { companyId } = req.params;
        const jobs = await Job.find({ postedBy: companyId, isDeleted: false }).sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: jobs });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const getJobApplicants = async (req, res) => {
    try {
        const { jobId } = req.params;
        const applicants = await Applicant.find({ jobId, isDeleted: false })
            .populate("userId", "name email")
            .populate("resumeId");
        res.status(200).json({ success: true, data: applicants });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteCompany = async (req, res) => {
    try {
        const { companyId } = req.params;

        const company = await Company.findById(companyId);
        if (!company || company.isDeleted) {
            return res.status(404).json({
                success: false,
                message: "Company not found"
            });
        }

        const deletedBy = req.user?._id || null;

        company.isDeleted = true;
        company.deletedAt = new Date();
        company.deletedBy = deletedBy;

        await company.save();

        res.status(200).json({
            success: true,
            message: "Company deleted successfully"
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};