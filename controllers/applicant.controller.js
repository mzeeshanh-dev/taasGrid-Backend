import Applicant from "../models/applicant.js";
import User from "../models/user.js";
// ------------------ CREATE APPLICANT ------------------
export const createApplicant = async (req, res) => {
  try {
    const { userId, jobId, resumeId, resumeModel } = req.body;

    // Validate required fields
    if (!userId || !jobId || !resumeId || !resumeModel) {
      return res.status(400).json({ 
        success: false, 
        message: "userId, jobId, resumeId, and resumeModel are required" 
      });
    }

    // Validate resumeModel
    if (!["StdResume", "EmployeeResume"].includes(resumeModel)) {
      return res.status(400).json({ 
        success: false, 
        message: "resumeModel must be either 'StdResume' or 'EmployeeResume'" 
      });
    }

    // Prevent duplicate application for the same job
    const existing = await Applicant.findOne({ userId, jobId });
    if (existing) {
      return res.status(400).json({ success: false, message: "You have already applied for this job" });
    }

    // Create applicant
    const applicant = new Applicant({ userId, jobId, resumeId, resumeModel });
    await applicant.save();

    // Refetch with populate for userId and resumeId
    const populatedApplicant = await Applicant.findById(applicant._id)
      .populate("userId", "name email")
      .populate("resumeId");

    res.status(201).json({ success: true, applicant: populatedApplicant });

  } catch (error) {
    // Duplicate key error (if compound index triggers)
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: "You have already applied for this job" });
    }

    res.status(500).json({ success: false, message: error.message });
  }
};
// ------------------ GET ALL APPLICANTS (OPTIONAL FILTER BY JOB) ------------------
export const getApplicants = async (req, res) => {
  try {
    const { userId } = req.query; // <-- IMPORTANT

    const applicants = await Applicant.find({ userId }) // <-- ONLY current user
      .populate("userId", "email name")
      .populate("resumeId");

    res.status(200).json({
      success: true,
      applicants,
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
// ------------------ GET SINGLE APPLICANT ------------------
export const getApplicantById = async (req, res) => {
  try {
    const applicant = await Applicant.findById(req.params.id)
      .populate("userId", "name email")
      .populate("resumeId");

    if (!applicant) 
      return res.status(404).json({ success: false, message: "Applicant not found" });

    res.status(200).json({ success: true, applicant });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
// ------------------ UPDATE APPLICANT STATUS ------------------
export const updateApplicantStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const allowedStatuses = ["Applied", "Reviewed", "Shortlisted", "Rejected", "Hired"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const applicant = await Applicant.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    )
      .populate("userId", "name email")
      .populate("resumeId");

    if (!applicant) 
      return res.status(404).json({ success: false, message: "Applicant not found" });

    res.status(200).json({ success: true, applicant });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
// ------------------ DELETE APPLICANT ------------------
export const deleteApplicant = async (req, res) => {
  try {
    const applicant = await Applicant.findByIdAndDelete(req.params.id);
    if (!applicant) 
      return res.status(404).json({ success: false, message: "Applicant not found" });

    res.status(200).json({ success: true, message: "Applicant deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
// ------------------ GET APPLICANTS FOR A SPECIFIC JOB WITH COUNT ------------------
export const getApplicantsByJob = async (req, res) => {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      return res.status(400).json({ success: false, message: "jobId is required" });
    }

    // Find all applicants for this job
    const applicants = await Applicant.find({ jobId })
      .populate("userId", "name email")       // populate user info
      .populate("resumeId")                   // dynamic resume population
      .sort({ appliedAt: -1 });               // newest first

    res.status(200).json({
      success: true,
      jobId,
      totalApplicants: applicants.length,
      applicants,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

