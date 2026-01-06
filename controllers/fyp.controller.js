import Fyp from "../models/fyp.js";
import Company from "../models/company.js";

// ✅ Create a new FYP
export const createFyp = async (req, res) => {
  try {
    const { title, description, domain, duration, collaborationMode, qualification, requirements, location } = req.body;

    // Detect company (from JWT or frontend)
    const companyId = req.user?._id || req.body.postedBy;

    if (!companyId) {
      return res.status(400).json({ success: false, message: "Company ID missing" });
    }

    const companyExists = await Company.findById(companyId);
    if (!companyExists) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    // ✅ Create and save new FYP
    const fyp = new Fyp({
      title,
      description,
      domain,
      duration,
      collaborationMode,
      qualification,
      requirements,
      location,
      postedBy: companyId,
      postedByModel: "Company",
    });

    await fyp.save();

    res.status(201).json({
      success: true,
      message: "FYP created successfully",
      fyp,
    });
  } catch (error) {
    console.error("❌ Error creating FYP:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create FYP",
      error: error.message,
    });
  }
};

// ✅ Get all FYPs
export const getFyps = async (req, res) => {
  try {
    const fyps = await Fyp.find()
      .populate("postedBy", "companyName email")
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      fyps,
    });
  } catch (error) {
    console.error("❌ Error fetching FYPs:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching FYPs",
      error: error.message,
    });
  }
};

// ✅ Get single FYP by ID
export const getFypById = async (req, res) => {
  try {
    const fyp = await Fyp.findById(req.params.id).populate("postedBy", "companyName email");
    if (!fyp) return res.status(404).json({ success: false, message: "FYP not found" });

    res.status(200).json({ success: true, fyp });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error fetching FYP", error: error.message });
  }
};

// ✅ Delete FYP
export const deleteFyp = async (req, res) => {
  try {
    const fyp = await Fyp.findByIdAndDelete(req.params.id);
    if (!fyp) return res.status(404).json({ success: false, message: "FYP not found" });

    res.status(200).json({ success: true, message: "FYP deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error deleting FYP", error: error.message });
  }
};
