import Project from "../models/project.js";
import Company from "../models/company.js";

// Create Project
export const createProject = async (req, res) => {
    try {
        const {
            title,
            description,
            category,
            subCategory,
            skills,
            budget,
            currency,
            projectType,
            duration,
            deadline,
        } = req.body;

        const companyId = req.company?._id || req.body.postedBy;

        if (!companyId)
            return res.status(400).json({ success: false, message: "Company ID missing" });

        const companyExists = await Company.findById(companyId);
        if (!companyExists)
            return res.status(404).json({ success: false, message: "Company not found" });

        const project = new Project({
            title,
            description,
            category,
            subCategory,
            skills,
            budget,
            currency,
            projectType,
            duration,
            deadline,
            postedBy: companyId,
            postedByModel: "Company",
        });

        await project.save();

        res.status(201).json({
            success: true,
            message: "Project created successfully",
            project,
        });
    } catch (error) {
        console.error("❌ Error creating Project:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create Project",
            error: error.message,
        });
    }
};

// Get All Projects
export const getAllProjects = async (req, res) => {
    try {
        const { category, skills, status } = req.query;

        let filter = { isDeleted: false };

        if (category) filter.category = category;
        if (status) filter.status = status;
        if (skills) filter.skills = { $in: skills.split(",") };

        const projects = await Project.find(filter)
            .populate("postedBy", "companyName logo")
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, projects });
    } catch (error) {
        console.error("❌ Error fetching Projects:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Get Single Project
export const getProjectById = async (req, res) => {
    try {
        const project = await Project.findById(req.params.id)
            .populate("postedBy", "companyName logo");

        if (!project)
            return res.status(404).json({ success: false, message: "Project not found" });

        res.status(200).json({ success: true, project });
    } catch (error) {
        console.error("❌ Error fetching Project:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Update Project
export const updateProject = async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project)
            return res.status(404).json({ success: false, message: "Project not found" });

        // Only company who posted can update
        if (project.postedBy.toString() !== req.company._id.toString())
            return res.status(403).json({ success: false, message: "Forbidden" });

        const updates = req.body;
        Object.assign(project, updates);

        await project.save();

        res.status(200).json({ success: true, message: "Project updated", project });
    } catch (error) {
        console.error("❌ Error updating Project:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// Delete Project (soft delete)
export const deleteProject = async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);
        if (!project)
            return res.status(404).json({ success: false, message: "Project not found" });

        if (project.postedBy.toString() !== req.company._id.toString())
            return res.status(403).json({ success: false, message: "Forbidden" });

        project.isDeleted = true;
        project.deletedAt = new Date();
        project.deletedBy = req.company._id;
        await project.save();

        res.status(200).json({ success: true, message: "Project deleted successfully" });
    } catch (error) {
        console.error("❌ Error deleting Project:", error);
        res.status(500).json({ success: false, message: error.message });
    }
};
