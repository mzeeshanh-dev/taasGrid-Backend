import EmployeeResume from "../models/resume.js";

export const saveEmployeeResume = async (req, res) => {
  try {
    const { 
      userId, 
      ai_suggestions, 
      planType = "Basic", 
      name, 
      email,
      experience, 
      education, 
      ...rest 
    } = req.body;

    // ✅ Validate required fields
    if (!userId || !name || !email || !education) {
      return res.status(400).json({
        success: false,
        message: "userId, name, email and education are required.",
      });
    }

    // ✅ Default AI suggestions if not provided
    const defaultAISuggestions = {
      missing_details: [],
      missing_sections: [],
      suggested_additions: [],
      summary_improvement: [],
    };

    const aiData = ai_suggestions || defaultAISuggestions;

    // ✅ Check if a resume already exists for this user
    const existingResume = await EmployeeResume.findOne({ userId });

    // ✅ Restrict Basic Plan users to one resume
    if (existingResume && planType.toLowerCase() === "basic") {
      console.log("⚠️ Basic plan user already has a resume.");
      return res.status(403).json({
        success: false,
        message:
          "You already have a resume under the Basic Plan. Upgrade to Premium to create or modify more resumes.",
      });
    }

    let resume;

    if (existingResume) {
      // ✅ For Premium users: update existing resume
      resume = await EmployeeResume.findOneAndUpdate(
        { userId },
        {
          name,
          email,
          experience,
          education,
          ai_suggestions: aiData,
          planType,
          ...rest,
        },
        { new: true }
      );

      console.log("✅ Resume updated successfully:", resume);

      return res.status(200).json({
        success: true,
        message: "Resume updated successfully (Premium Plan).",
        resume,
      });
    }

    // ✅ Create new resume
    resume = new EmployeeResume({
      userId,
      name,
      email,
      experience,
      education,
      planType,
      ai_suggestions: aiData,
      ...rest,
    });

    await resume.save();
    console.log("✅ New employee resume created:", resume);

    return res.status(201).json({
      success: true,
      message:
        planType.toLowerCase() === "basic"
          ? "Resume created successfully under Basic Plan."
          : "Resume created successfully under Premium Plan.",
      resume,
    });
  } catch (error) {
    // ✅ Handle duplicate userId errors
    if (error.code === 11000 && error.keyValue?.userId) {
      return res.status(409).json({
        success: false,
        message: "A resume already exists for this user (duplicate userId).",
      });
    }

    console.error("❌ Error saving employee resume:", error);
    return res.status(500).json({
      success: false,
      message: "Server error occurred while saving the resume.",
      error: error.message,
    });
  }
};

// ---------------- GET RESUME ----------------
export const getEmployeeResume = async (req, res) => {
  try {
    const { userId } = req.params;

    const resume = await EmployeeResume.findOne({ userId });

    if (!resume) {
      return res.status(404).json({
        success: false,
        message: "Resume not found for this user."
      });
    }

    return res.status(200).json({
      success: true,
      resume,
    });
  } catch (error) {
    console.error("❌ Error fetching resume:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching resume.",
    });
  }
};

// ---------------- UPDATE RESUME ----------------
export const updateEmployeeResume = async (req, res) => {
  try {
    const { userId } = req.params;

    const updateData = req.body;

    // Prevent updating userId directly
    if (updateData.userId) delete updateData.userId;

    const updatedResume = await EmployeeResume.findOneAndUpdate(
      { userId },
      updateData,
      { new: true }
    );

    if (!updatedResume) {
      return res.status(404).json({
        success: false,
        message: "Resume not found. Cannot update.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Resume updated successfully.",
      resume: updatedResume,
    });

  } catch (error) {
    console.error("❌ Error updating resume:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while updating resume.",
      error: error.message,
    });
  }
};
