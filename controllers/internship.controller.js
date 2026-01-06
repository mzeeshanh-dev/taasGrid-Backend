import Internship from "../models/internship.js";
import mongoose from "mongoose";

// ✅ Create a new internship
export const createInternship = async (req, res) => {
  try {
    const {
      title,
      description,
      duration,
      qualification,
      location,
      requirements,
      stipend,
      postedBy: postedByFromFrontend,
    } = req.body;

    // 🔍 Determine company ID from auth or frontend
    const companyId = req.user?._id || postedByFromFrontend;

    if (!companyId) {
      return res.status(400).json({ success: false, message: "Company ID missing" });
    }

    // ✅ Convert to Mongoose ObjectId
    const postedBy = new mongoose.Types.ObjectId(companyId);

    const internship = new Internship({
      title,
      description,
      duration,
      qualification,
      location,
      requirements,
      stipend,
      postedBy,
      postedByModel: "Company", // force company
    });

    await internship.save();

    res.status(201).json({
      success: true,
      message: "Internship created successfully",
      internship,
    });
  } catch (error) {
    console.error("❌ Error creating internship:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create internship",
      error: error.message,
    });
  }
};

// ✅ Get all internships
export const getAllInternships = async (req, res) => {
  try {
    const internships = await Internship.find().populate("postedBy", "name email");
    res.status(200).json({ success: true, internships });
  } catch (error) {
    console.error("Error fetching internships:", error);
    res.status(500).json({ success: false, message: "Failed to fetch internships" });
  }
};

// ✅ Get internships posted by a specific company
export const getCompanyInternships = async (req, res) => {
  try {
    const { companyId } = req.params;
    const internships = await Internship.find({ postedBy: companyId });
    res.status(200).json({ success: true, internships });
  } catch (error) {
    console.error("Error fetching company internships:", error);
    res.status(500).json({ success: false, message: "Failed to fetch company internships" });
  }
};

// ✅ Delete internship
export const deleteInternship = async (req, res) => {
  try {
    const { id } = req.params;
    await Internship.findByIdAndDelete(id);
    res.status(200).json({ success: true, message: "Internship deleted successfully" });
  } catch (error) {
    console.error("Error deleting internship:", error);
    res.status(500).json({ success: false, message: "Failed to delete internship" });
  }
};

// ✅ Get single internship (for detail view)
export const getInternshipById = async (req, res) => {
  try {
    const { id } = req.params;
    const internship = await Internship.findById(id).populate("postedBy", "name email");
    if (!internship)
      return res.status(404).json({ success: false, message: "Internship not found" });
    res.status(200).json({ success: true, internship });
  } catch (error) {
    console.error("Error fetching internship:", error);
    res.status(500).json({ success: false, message: "Failed to fetch internship" });
  }
};
