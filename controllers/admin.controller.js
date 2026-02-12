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
        // ---------------- TOTAL COUNTS ----------------
        const [
            totalUsers,
            totalApplicants,
            totalCompanies,
            totalJobs,
        ] = await Promise.all([
            User.countDocuments({ isDeleted: false }),
            Applicant.countDocuments({ isDeleted: false }),
            Company.countDocuments({ isDeleted: false }),
            Job.countDocuments({ isDeleted: false }),
        ]);

        // ---------------- USERS BY ROLE ----------------
        const usersByRole = await User.aggregate([
            { $match: { isDeleted: false } },
            {
                $group: {
                    _id: "$role",
                    count: { $sum: 1 },
                },
            },
            {
                $project: {
                    _id: 0,
                    role: "$_id",
                    count: 1,
                },
            },
        ]);

        // ---------------- USERS BY STATUS ----------------
        const usersByStatus = await User.aggregate([
            { $match: { isDeleted: false } },
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 },
                },
            },
            {
                $project: {
                    _id: 0,
                    status: "$_id",
                    count: 1,
                },
            },
        ]);

        // ---------------- APPLICANTS BY SOURCE ----------------
        const applicantsBySource = await Applicant.aggregate([
            { $match: { isDeleted: false } },
            {
                $group: {
                    _id: "$source",
                    count: { $sum: 1 },
                },
            },
            {
                $project: {
                    _id: 0,
                    source: "$_id",
                    count: 1,
                },
            },
        ]);

        // ---------------- JOBS BY STATUS ----------------
        const jobsByStatus = await Job.aggregate([
            { $match: { isDeleted: false } },
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 },
                },
            },
            {
                $project: {
                    _id: 0,
                    status: "$_id",
                    count: 1,
                },
            },
        ]);

        res.status(200).json({
            success: true,
            message: "Dashboard statistics fetched successfully",
            data: {
                totals: {
                    totalUsers,
                    totalApplicants,
                    totalCompanies,
                    totalJobs,
                },
                users: {
                    byRole: usersByRole,
                    byStatus: usersByStatus,
                },
                applicants: {
                    bySource: applicantsBySource,
                },
                jobs: {
                    byStatus: jobsByStatus,
                },
            },
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
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

export const updateUserStatus = async (req, res) => {
    try {
        const { userId } = req.params;
        const { status } = req.body;

        const allowedStatuses = ["Active", "Suspended", "Blocked"];

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid status value"
            });
        }

        const user = await User.findById(userId);

        if (!user || user.isDeleted) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        user.status = status;
        await user.save();

        res.status(200).json({
            success: true,
            message: `User status updated to ${status}`
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
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


// ----------------- EDIT USER -----------------
export const editUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const { name, email, password, role } = req.body;

        // Validate required fields
        if (!name || !email || !role) {
            return res.status(400).json({
                success: false,
                message: "Name, email, and role are required",
            });
        }

        // Validate role (optional: only allow specific roles)
        const allowedRoles = ["student", "employee"];
        if (!allowedRoles.includes(role.toLowerCase())) {
            return res.status(400).json({
                success: false,
                message: `Role must be one of: ${allowedRoles.join(", ")}`,
            });
        }

        // Find user
        const user = await User.findById(userId);
        if (!user || user.isDeleted) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        // Check if email is being changed to an existing email
        if (email !== user.email) {
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: "Email already in use",
                });
            }
        }

        // Update fields
        user.name = name;
        user.email = email;
        user.role = role;

        // Update password only if provided
        if (password) {
            user.password = password; // pre-save hook will hash it
        }

        await user.save();

        res.status(200).json({
            success: true,
            message: "User updated successfully",
            data: user,
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};