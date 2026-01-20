import Applicant from "../models/applicant.js";
import Batch from "../models/batch.js";
import mongoose from "mongoose";

// ------------------ CREATE APPLICANT ------------------
export const createApplicant = async (req, res) => {
  try {
    const { userId, jobId, resumeId, resumeModel } = req.body;

    if (!userId || !jobId || !resumeId || !resumeModel) {
      return res.status(400).json({
        success: false,
        message: "userId, jobId, resumeId, and resumeModel are required"
      });
    }

    if (!["StdResume", "EmployeeResume"].includes(resumeModel)) {
      return res.status(400).json({
        success: false,
        message: "resumeModel must be either 'StdResume' or 'EmployeeResume'"
      });
    }

    const existing = await Applicant.findOne({ userId, jobId });
    if (existing) {
      return res.status(400).json({ success: false, message: "You have already applied for this job" });
    }

    const applicant = new Applicant({ userId, jobId, resumeId, resumeModel });
    await applicant.save();

    const populatedApplicant = await Applicant.findById(applicant._id)
      .populate("userId", "name email")
      .populate("resumeId");

    res.status(201).json({ success: true, applicant: populatedApplicant });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: "You have already applied for this job" });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// ------------------ GET ALL APPLICANTS ------------------
export const getApplicants = async (req, res) => {
  try {
    const { userId } = req.query;
    const query = userId ? { userId } : {};

    const applicants = await Applicant.find(query)
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
    const { status, isBulk, jobId, extractedData, resumeUrl } = req.body;
    const applicantId = req.params.id;

    let applicant;

    // If bulk, update by _id first
    applicant = await Applicant.findById(applicantId);

    // If not found, try by email+jobId (Bulk)
    if (!applicant && isBulk && extractedData?.personalInfo?.email) {
      const email = extractedData.personalInfo.email.toLowerCase();
      applicant = await Applicant.findOne({
        jobId,
        source: "Bulk",
        "extractedData.personalInfo.email": email,
      });
    }

    if (!applicant) {
      return res.status(404).json({ success: false, message: "Applicant not found" });
    }

    // update status + flags
    applicant.status = status;
    applicant.isShortlisted = status === "Shortlisted";
    applicant.isInterviewed = status === "Interviewed";
    applicant.isRejected = status === "Rejected";
    applicant.isHired = status === "Hired";
    applicant.isReviewed = status === "Reviewed";
    applicant.isApplied = status === "Applied";

    // update optional data
    if (resumeUrl) applicant.resumeUrl = resumeUrl;
    if (extractedData) applicant.extractedData = extractedData;

    await applicant.save();

    const updated = await Applicant.findById(applicant._id)
      .populate("userId", "name email")
      .populate("resumeId");

    res.status(200).json({ success: true, applicant: updated });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "This candidate is already in your pipeline for this job."
      });
    }
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

// ------------------ GET APPLICANTS BY JOB ------------------
export const getApplicantsByJob = async (req, res) => {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      return res.status(400).json({ success: false, message: "jobId is required" });
    }

    const applicants = await Applicant.find({ jobId })
      .populate("userId", "name email")
      .populate("resumeId")
      .sort({ appliedAt: -1 });

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

// ------------------ GET BULK APPLICANTS BY JOB ------------------
export const getBulkApplicantsByJob = async (req, res) => {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      return res.status(400).json({ success: false, message: "jobId required" });
    }

    // 1) create bulk applicants from batch if not created
    const batches = await Batch.find({ jobId, isDeleted: false });

    for (const batch of batches) {
      await createBulkApplicantsFromBatch(batch);
    }

    // 2) return applicants from DB (source Bulk)
    const bulkApplicants = await Applicant.find({ jobId, source: "Bulk" })
      .populate("userId", "email")
      .populate("resumeId");

    res.status(200).json({
      success: true,
      total: bulkApplicants.length,
      applicants: bulkApplicants,
    });

  } catch (error) {
    console.error("Bulk applicant error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};


// ------------------ CREATE BULK APPLICANT ------------------
export const createBulkApplicant = async (req, res) => {
  try {
    const { jobId, extractedData, resumeUrl } = req.body;

    if (!jobId) {
      return res.status(400).json({
        success: false,
        message: "jobId is required",
      });
    }

    const email = extractedData?.personalInfo?.email?.toLowerCase();
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Bulk candidate email is required",
      });
    }

    const portalExists = await Applicant.findOne({
      jobId,
      source: "Portal",
    }).populate("userId", "email");

    if (portalExists && portalExists.userId?.email?.toLowerCase() === email) {
      return res.status(400).json({
        success: false,
        message: "This candidate already applied via portal",
      });
    }

    const bulkExists = await Applicant.findOne({
      jobId,
      source: "Bulk",
      "extractedData.personalInfo.email": email,
    });

    if (bulkExists) {
      return res.status(400).json({
        success: false,
        message: "This bulk candidate is already in pipeline",
      });
    }

    const newApplicant = await Applicant.create({
      jobId,
      source: "Bulk",
      status: "Applied",
      resumeUrl,
      extractedData,
      userId: new mongoose.Types.ObjectId(),
      resumeModel: "BulkResume",
      score: resume.analysis?.score || 0,
      appliedAt: new Date(),
    });

    return res.status(201).json({
      success: true,
      applicant: newApplicant,
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "This candidate is already in your pipeline for this job.",
      });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// ------------------ CREATE BULK APPLICANTS FROM BATCH ------------------
export const createBulkApplicantsFromBatch = async (batch) => {
  if (!batch) return [];

  const jobId = batch.jobId;
  const created = [];

  for (const resume of batch.resumes) {
    const email = resume.extractedData?.personalInfo?.email?.toLowerCase();
    if (!email) continue;

    const exists = await Applicant.findOne({
      jobId,
      "extractedData.personalInfo.email": email,
    });

    if (exists) continue;

    const newApplicant = await Applicant.create({
      jobId,
      source: "Bulk",
      status: "Applied",
      resumeUrl: resume.resumeUrl || resume.cv?.url,
      extractedData: resume.extractedData,
      userId: new mongoose.Types.ObjectId(),
      resumeModel: "BulkResume",
      score: resume.analysis?.score || 0,
      appliedAt: new Date(),
    });

    created.push(newApplicant);
  }

  return created;
};

