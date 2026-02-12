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



// ----------------- EDIT USER -----------------
export const editUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const { name, email, password, role, level } = req.body;

        // Find user
        const user = await User.findById(userId);
        if (!user || user.isDeleted) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        // Update email if provided
        if (email && email !== user.email) {
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: "Email already in use",
                });
            }
            user.email = email;
        }

        // Update name if provided
        if (name) user.name = name;

        // Update role if provided
        if (role) {
            const allowedRoles = ["student", "employee"];
            if (!allowedRoles.includes(role.toLowerCase())) {
                return res.status(400).json({
                    success: false,
                    message: `Role must be one of: ${allowedRoles.join(", ")}`,
                });
            }
            user.role = role;
        }

        // Update level if provided
        if (level) {
            const allowedLevels = ["basic", "premium"];
            if (!allowedLevels.includes(level.toLowerCase())) {
                return res.status(400).json({
                    success: false,
                    message: `Level must be one of: ${allowedLevels.join(", ")}`,
                });
            }
            user.level = level;
        }

        // Update password only if provided
        if (password) user.password = password; // pre-save hook hashes it

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


// ----------------- CREATE COMPANY -----------------
export const createCompany = async (req, res) => {
    try {
        const { companyName, email, password, phone, address, website, industry, size, plan, description } = req.body;

        // Validate required fields
        if (!companyName || !email || !password) {
            return res.status(400).json({ success: false, message: "Company name, email, and password are required" });
        }

        // Check if email already exists
        const existingCompany = await Company.findOne({ email });
        if (existingCompany) {
            return res.status(400).json({ success: false, message: "Email already exists" });
        }

        // Create company
        const newCompany = await Company.create({
            companyName,
            email,
            password,
            phone,
            address,
            website,
            industry,
            size,
            plan,
            description,
        });

        res.status(201).json({ success: true, data: newCompany, message: "Company created successfully" });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ----------------- EDIT COMPANY -----------------
export const editCompany = async (req, res) => {
    try {
        const { companyId } = req.params;
        const { companyName, email, password, phone, address, website, industry, size, plan, description } = req.body;

        const company = await Company.findById(companyId);
        if (!company || company.isDeleted) {
            return res.status(404).json({ success: false, message: "Company not found" });
        }

        // Update email if provided
        if (email && email !== company.email) {
            const existingCompany = await Company.findOne({ email });
            if (existingCompany) {
                return res.status(400).json({ success: false, message: "Email already in use" });
            }
            company.email = email;
        }

        // Update other fields if provided
        if (companyName) company.companyName = companyName;
        if (phone) company.phone = phone;
        if (address) company.address = address;
        if (website) company.website = website;
        if (industry) company.industry = industry;
        if (size) company.size = size;
        if (description) company.description = description;

        // Update plan if provided
        if (plan) {
            const allowedPlans = ["basic", "premium"];
            if (!allowedPlans.includes(plan.toLowerCase())) {
                return res.status(400).json({ success: false, message: `Plan must be one of: ${allowedPlans.join(", ")}` });
            }
            company.plan = plan;
        }

        // Update password only if provided
        if (password) company.password = password; // pre-save hook will hash it

        await company.save();

        res.status(200).json({ success: true, message: "Company updated successfully", data: company });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


// ----------------- UPDATE COMPANY STATUS -----------------
export const updateCompanyStatus = async (req, res) => {
    try {
        const { companyId } = req.params;
        const { status } = req.body;

        const allowedStatuses = ["Active", "Suspended", "Blocked"];
        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: "Invalid status value" });
        }

        const company = await Company.findById(companyId);
        if (!company || company.isDeleted) {
            return res.status(404).json({ success: false, message: "Company not found" });
        }

        company.status = status;
        await company.save();

        res.status(200).json({
            success: true,
            message: `Company status updated to ${status}`,
            data: company
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// ----------------- GET ALL APPLICANTS -----------------
export const getAllApplicants = async (req, res) => {
    try {
        const applicants = await Applicant.find({ isDeleted: false })
            .populate("userId", "name email")
            .populate("jobId", "title postedBy")
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: applicants.length,
            data: applicants
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// ----------------- GET APPLICANTS BY COMPANY -----------------
export const getApplicantsByCompany = async (req, res) => {
    try {
        const { companyId } = req.params;

        // Step 1: Get all jobs posted by this company
        const jobs = await Job.find({ postedBy: companyId, isDeleted: false }).select("_id");

        const jobIds = jobs.map(job => job._id);

        // Step 2: Get applicants for those jobs
        const applicants = await Applicant.find({
            jobId: { $in: jobIds },
            isDeleted: false
        })
            .populate("userId", "name email")
            .populate("jobId", "title")
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: applicants.length,
            data: applicants
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};