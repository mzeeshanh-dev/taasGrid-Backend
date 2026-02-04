import { storage } from "../storage.js";
import Groq from "groq-sdk";
import * as path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import Batch from "../models/batch.js";
import pdf from "pdf-parse-fixed";
import mongoose from "mongoose";
import Job from "../models/job.js";
import Applicant from "../models/applicant.js";

dotenv.config();

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MIN_REQUEST_DELAY = 500;

// const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiKey = process.env.GROQ_API_KEY;

if (!apiKey) {
  console.error("❌ GROQ_API_KEY is not set in environment variables");
}

const groq = new Groq({ apiKey: apiKey || "" });

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const getJobCriteriaById = async (jobId) => {
  if (!jobId) throw new Error("jobId is required");

  const query = mongoose.Types.ObjectId.isValid(jobId)
    ? { $or: [{ _id: jobId }, { jobId }] }
    : { jobId };

  const job = await Job.findOne(query)
    .populate("postedBy", "companyName companyId");

  if (!job) throw new Error("Job not found");

  return {
    companyName: job.postedBy?.companyName || "N/A",
    companyId: job.postedBy?.companyId || null,
    description: job.description,
    requirements: job.requirements || [],
    experience: job.experience,
    qualification: job.qualification,
    location: job.location,
    jobType: job.jobType,
    workType: job.workType
  };
};


/* ===========================
   CV STRUCTURE PARSER
=========================== */
const structureCvData = async (buffer, filename) => {
  const prompt = `You are a professional CV parser. Extract data from the CV and return a VALID JSON object.
  

  CRITICAL INSTRUCTIONS:
1. If any field (name, email, phone, location, education, experience, skills, etc.) is missing or cannot be extracted, DO NOT make up or hallucinate values. Instead, use "Not specified" for strings, 0 for numbers, and empty arrays for lists.
2. For 'personalInfo', include these keys for experience:
   - "professionalJob": Total months in Corporate/Full-time roles
   - "internship": Total months in Internship roles
   - "freelancing": Total months in Freelance/Contract roles
3. Experience Calculation Rule: If a role is "Aug 2024 - Present" and today is Jan 2026, that is 17 months.
4. Normalize all text: remove extra spaces, trim, and standardize capitalization where appropriate.
5. Return ONLY JSON and follow the exact structure below:
  
  Return format:
  {
    "personalInfo": { 
      "fullName": "Name here", 
      "email": "Email here", 
      "phone": "Phone here", 
      "location": "City, Country",
      "professionalJob": 0, 
      "internship": 0, 
      "freelancing": 0,
      "others": 0
    },
    "education": [{ "degree": "", "university": "", "gpa": "", "duration": "" }],
    "experience": [{ "years": "", "details": { "company": "", "position": "", "responsibilities": [] } }],
    "skills": { "technical": [], "soft": [], "tools": [] }
  }`;

  try {
    const data = await pdf(buffer);
    const cvText = data?.text?.slice(0, 6000) || "";

    const result = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      temperature: 0.1,
      max_tokens: 3000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: cvText }
      ]
    });

    let parsed;
    try {
      parsed = JSON.parse(result.choices[0].message.content);
    } catch {
      throw new Error("Invalid JSON returned by AI");
    }

    parsed.personalInfo ??= {};
    parsed.personalInfo.professionalJob ??= 0;
    parsed.personalInfo.internship ??= 0;
    parsed.personalInfo.freelancing ??= 0;

    parsed.education ??= [];
    parsed.experience ??= [];
    parsed.skills ??= { technical: [], soft: [], tools: [] };

    return parsed;
  } catch (err) {
    console.error(`✗ CV parsing failed (${filename}):`, err.message);
    throw err;
  }
};

/* ===========================
   UPLOAD CVS
=========================== */
export const uploadCvs = async (req, res) => {
  try {
    const files = req.files;
    if (!files?.length) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    await storage.clearCvs(); // prevent ghost data

    const processedCvs = [];
    const errors = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (file.size > MAX_FILE_SIZE) {
        errors.push({ filename: file.originalname, error: "File exceeds 50MB limit" });
        continue;
      }

      try {
        if (i > 0) await delay(MIN_REQUEST_DELAY);

        const base64 = file.buffer.toString("base64");

        const cv = await storage.createCv({
          filename: file.originalname,
          content: base64,
          uploadDate: new Date().toISOString()
        });

        const structured = await structureCvData(file.buffer, file.originalname);

        processedCvs.push({
          id: cv.id,
          filename: cv.filename,
          uploadDate: cv.uploadDate,
          extractedData: structured
        });

        console.log(`✅ CV extracted successfully: ${file.originalname}`);


      } catch (err) {
        errors.push({
          filename: file.originalname,
          error: err.message || "Processing failed"
        });
      }
    }

    res.json({
      success: processedCvs.length > 0,
      cvs: processedCvs,
      errors,
      summary: {
        totalFiles: files.length,
        processedFiles: processedCvs.length,
        failedFiles: errors.length
      }
    });

  } catch (err) {
    res.status(500).json({ message: "Upload failed", error: err.message });
  }
};

/* ===========================
   ANALYZE CVS
=========================== */

export const analyzeCvs = async (req, res) => {
  try {
    const { batchId, batchName, jobId } = req.body;

    if (!batchId || !batchName || !jobId) {
      return res.status(400).json({
        message: "batchId, batchName and jobId required"
      });
    }

    const criteria = await getJobCriteriaById(jobId);
    const cvs = await storage.getCvs();
    if (!cvs.length) return res.end();

    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("Transfer-Encoding", "chunked");

    let batchCreated = false;
    const processed = new Set();

    for (const cv of cvs) {
      if (processed.has(cv.id)) continue;
      if (processed.size > 0) await delay(MIN_REQUEST_DELAY);

      try {
        const buffer = Buffer.from(cv.content, "base64");
        const structured = await structureCvData(buffer, cv.filename);

        // ===============================
        // EXPERIENCE — MONTH BASED ONLY (UNCHANGED)
        // ===============================
        const {
          professionalJob = 0,
          freelancing = 0,
          internship = 0
        } = structured.personalInfo || {};

        const experience = {
          professional: clamp(round(Math.min(professionalJob / 24, 1) * 30, 2), 0, 30),
          freelancing: clamp(round(Math.min(freelancing / 12, 1) * 8, 2), 0, 8),
          internship: clamp(round(Math.min(internship / 6, 1) * 7, 2), 0, 7),
          gapPenaltyApplied: false
        };

        experience.total = round(
          experience.professional +
          experience.freelancing +
          experience.internship,
          2
        );

        // ===============================
        // AI — NON-EXPERIENCE ONLY (UNCHANGED)
        // ===============================
        const analyzePrompt = `
You are an ATS scoring engine.

DO NOT calculate experience scores.
DO NOT use years — months only.
DO NOT invent numbers.

Return ONLY JSON.

Normalize all skills:
- Convert variations of the same skill into a single standard form.
  Examples: "c#", "C#", "c sharp" → "C#"
            "js", "JavaScript", "javascript" → "JavaScript"
            "reactjs", "React" → "React"

Remove duplicate skills after normalization.

Job Criteria:
${JSON.stringify(criteria)}

Candidate Data:
${JSON.stringify(structured)}

Return:
{
  "skills": {
    "technical": 0,
    "tools": 0,
    "soft": 0
  },
  "roleFit": 0,
  "education": 0,
  "location": 0,
  "other": 0,
  "matchedSkills": [],
  "strengths": [],
  "gaps": [],
  "recommendations": [],
  "experienceMatchSummary": ""
}
`;

        const result = await groq.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          temperature: 0.1,
          response_format: { type: "json_object" },
          messages: [{ role: "user", content: analyzePrompt }]
        });

        const ai = JSON.parse(result.choices[0].message.content);

        // ===============================
        // NORMALIZE + CAP AI SCORES (UNCHANGED)
        // ===============================
        const skills = {
          technical: clamp(round(ai.skills?.technical || 0, 2), 0, 18),
          tools: clamp(round(ai.skills?.tools || 0, 2), 0, 4),
          soft: clamp(round(ai.skills?.soft || 0, 2), 0, 3)
        };

        skills.total = round(
          skills.technical + skills.tools + skills.soft,
          2
        );

        const roleFit = clamp(round(ai.roleFit || 0, 2), 0, 10);
        const education = clamp(round(ai.education || 0, 2), 0, 10);
        const location = clamp(round(ai.location || 0, 2), 0, 5);
        const other = clamp(round(ai.other || 0, 2), 0, 5);

        // ===============================
        // DISTRIBUTED SCORES (UNCHANGED)
        // ===============================
        const distributed_scores = {
          experience: experience.total,
          skills: skills.total,
          roleFit,
          education,
          location,
          other
        };

        distributed_scores.total = round(
          Object.values(distributed_scores)
            .filter(v => typeof v === "number")
            .reduce((a, b) => a + b, 0),
          2
        );

        const finalScore = Math.round(
          clamp(distributed_scores.total, 0, 100)
        );

        // ===============================
        // FINAL PAYLOAD (UNCHANGED)
        // ===============================
        const payload = {
          cv: {
            id: cv.id,
            filename: cv.filename,
            uploadDate: cv.uploadDate
          },
          extractedData: structured,
          analysis: {
            score: finalScore,
            matchPercentage: finalScore,
            scoreBreakdown: {
              experience,
              skills,
              roleFit,
              education,
              location,
              other
            },
            distributed_scores,
            matchedSkills: ai.matchedSkills || [],
            strengths: ai.strengths || [],
            gaps: ai.gaps || [],
            recommendations: ai.recommendations || [],
            experienceMatch: ai.experienceMatchSummary || "",
            locked: true,
            status: "completed",
            analyzedAt: new Date()
          }
        };

        // streaming output
        res.write(JSON.stringify(payload) + "\n");

        // create batch if not yet created
        if (!batchCreated) {
          await Batch.findOneAndUpdate(
            { batchId },
            {
              name: batchName,
              jobId,
              resumes: [],
              status: "processing",
              updatedAt: new Date()
            },
            { upsert: true }
          );
          batchCreated = true;
        }

        // store payload into batch
        await Batch.updateOne(
          { batchId },
          { $push: { resumes: payload } }
        );

        // ✅✅✅ APPLICANT CREATION (createBulkApplicantsFromBatch logic moved here)
        try {
          const email = structured?.personalInfo?.email?.toLowerCase();

          // ===============================
          // GPA EXTRACTION (FRONTEND SAFE)
          // ===============================
          // ===============================
          // GPA EXTRACTION & NORMALIZATION (ROBUST)
          // - Normalizes common patterns to 4.0 scale
          // - Examples supported: "3.5", "3.5/4", "8.5/10", "3.5 out of 4", "85%"
          // - Picks the HIGHEST valid normalized GPA from all education entries
          // ===============================
          let finalGpa = null;

          const eduData = structured?.education;
          const educationArray = Array.isArray(eduData)
            ? eduData
            : eduData && typeof eduData === "object"
              ? [eduData]
              : [];

          /**
           * Normalize a raw GPA-like string/number to 4.0 scale.
           * Returns Number (0..4) or null if cannot parse.
           */
          function normalizeGpaTo4(raw) {
            if (raw === null || raw === undefined) return null;
            const s = String(raw).toLowerCase().trim().replace(",", "."); // normalize decimals

            // 1) explicit formats: "val / scale" or "val out of scale"
            const denomMatch = s.match(/(\d+(\.\d+)?)\s*(?:\/|out of|of)\s*(\d+(\.\d+)?)/);
            if (denomMatch) {
              const val = parseFloat(denomMatch[1]);
              const scale = parseFloat(denomMatch[3]);
              if (!isNaN(val) && !isNaN(scale) && scale > 0) {
                const normalized = (val / scale) * 4;
                if (!Number.isNaN(normalized)) return Number(normalized.toFixed(2));
              }
              return null;
            }

            // 2) percentage like "85%" -> convert to /100 -> /4
            const percentMatch = s.match(/(\d+(\.\d+)?)\s*%/);
            if (percentMatch) {
              const val = parseFloat(percentMatch[1]);
              if (!isNaN(val)) {
                const normalized = (val / 100) * 4;
                return Number(normalized.toFixed(2));
              }
              return null;
            }

            // 3) single number: decide scale by heuristics
            const numMatch = s.match(/(\d+(\.\d+)?)/);
            if (!numMatch) return null;

            let val = parseFloat(numMatch[1]);
            if (Number.isNaN(val)) return null;

            // If value already within 0..4 => assume it's already 4.0-scale
            if (val >= 0 && val <= 4) {
              return Number(val.toFixed(2));
            }

            // If 4 < val <= 10 => very likely 10-scale (normalize to 4)
            if (val > 4 && val <= 10) {
              const normalized = (val / 10) * 4;
              return Number(normalized.toFixed(2));
            }

            // If val > 10 and <=100 => probably percentage (85 -> treat as 85%)
            if (val > 10 && val <= 100) {
              const normalized = (val / 100) * 4;
              return Number(normalized.toFixed(2));
            }

            // Anything else -> can't normalize
            return null;
          }

          // collect normalized GPAs from education entries
          const normalizedGpas = [];

          for (const edu of educationArray) {
            const rawGpa = edu?.gpa ?? edu?.cgpa;
            if (rawGpa === undefined || rawGpa === null || String(rawGpa).trim() === "") continue;

            const norm = normalizeGpaTo4(rawGpa);
            if (norm !== null && !Number.isNaN(norm) && norm >= 0 && norm <= 4) {
              normalizedGpas.push(norm);
            }
          }


          if (normalizedGpas.length > 0) {
            finalGpa = Number(Math.max(...normalizedGpas).toFixed(2));
          }




          await Applicant.create({
            jobId,
            source: "Bulk",
            status: "Applied",
            isApplied: true,
            resumeUrl: cv.url || null,
            extractedData: structured,
            gpa: finalGpa,
            userId: new mongoose.Types.ObjectId(),
            resumeModel: "BulkResume",
            score: finalScore,
            appliedAt: new Date(),
          });


        } catch (error) {
          // 🔥 DUPLICATE → SILENT SKIP (same as original function)
          if (error.code === 11000) {
            // silently continue - duplicate email for this job
          } else {
            // real error → log & continue (never crash batch)
            console.error(`Bulk applicant error for job ${jobId}:`, error.message);
          }
        }

        processed.add(cv.id);

      } catch (err) {
        // construct failed payload
        const failedPayload = {
          cv: {
            id: cv.id,
            filename: cv.filename,
            uploadDate: cv.uploadDate
          },
          analysis: {
            locked: true,
            status: "failed",
            error: err.message,
            analyzedAt: new Date()
          }
        };

        // write failed payload
        res.write(JSON.stringify(failedPayload) + "\n");

        if (batchCreated) {
          await Batch.updateOne(
            { batchId },
            { $push: { resumes: failedPayload } }
          );
        }

        // throw API limit error so frontend sees it
        if (err.message.includes("rate limit") || err.message.includes("429")) {
          res.end();
          throw new Error("API limit reached for this analysis run");
        }
      }
    }

    // mark batch completed (createBulkApplicantsFromBatch removed from here)
    if (batchCreated) {
      await Batch.findOneAndUpdate(
        { batchId },
        { status: "completed", updatedAt: new Date() }
      );
    }

    res.end();
    console.log(`✅ Analysis complete for batch: ${batchId}`);

  } catch (err) {
    // frontend will receive API limit error here
    if (!res.headersSent) {
      res.status(500).json({
        message: "Analysis failed",
        error: err.message
      });
    } else {
      console.error("Stream ended with error:", err.message);
    }
  }
};




function round(value, decimals) {
  return Number(Number(value || 0).toFixed(decimals));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}






/* ===========================
   RANK CVS
=========================== */
export const rankCvs = async (req, res) => {
  try {
    const { batchId } = req.query;
    const batch = await Batch.findOne({ batchId });
    if (!batch) return res.status(404).json({ message: "Batch not found" });

    res.json(
      [...batch.resumes].sort(
        (a, b) => (b.analysis?.score || 0) - (a.analysis?.score || 0)
      )
    );
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ===========================
   CLEAR CVS
=========================== */
export const clearCvs = async (req, res) => {
  await storage.clearCvs();
  res.json({ message: "Cleared" });
};



// =========================
// ANALYZE PORTAL APPLICANTS
// =========================

export const analyzePortalApplicants = async (req, res) => {
  try {
    const { jobId } = req.params;

    console.log("Analyze started for jobId:", jobId);

    if (!jobId) {
      return res.status(400).json({
        success: false,
        message: "jobId required"
      });
    }

    const criteria = await getJobCriteriaById(jobId);


    const portalApplicants = await Applicant.find({
      jobId,
      source: "Portal"
    }).populate("resumeId");

    console.log("Portal applicants count:", portalApplicants.length);

    if (!portalApplicants.length) {
      return res.status(200).json({
        success: true,
        message: "No portal applicants found",
        updated: 0,
        alreadyAnalyzed: false
      });
    }

    let updatedCount = 0;

    for (const app of portalApplicants) {

      // ⛔️ SKIP if score already exists
      if (app.score && app.score > 0) {
        console.log(`Skipping already analyzed applicant: ${app._id}`);
        continue;
      }

      const resumeData = app.resumeId || app.extractedData || {};

      const analyzePrompt = `
You are an ATS scoring engine.

DO NOT calculate experience scores.
DO NOT use years — months only.
DO NOT invent numbers.

Return ONLY JSON.

Job Criteria:
${JSON.stringify(criteria)}

Candidate Data:
${JSON.stringify(resumeData)}

Return:
{ "score":0,
  "skills": {
    "technical": 0,
    "tools": 0,
    "soft": 0
  },
  "roleFit": 0,
  "education": 0,
  "location": 0,
  "other": 0,
  "matchedSkills": [],
  "strengths": [],
  "gaps": [],
  "recommendations": [],
  "experienceMatchSummary": ""
}
`;



      const result = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: analyzePrompt }]
      });

      const analysis = JSON.parse(result.choices[0].message.content);

      const score = Math.round(
        Math.min(100, Math.max(0, analysis.score || 0))
      );


      app.score = score;
      await app.save();

      console.log(`Applicant ${app._id} scored:`, score);

      updatedCount++;
    }

    return res.status(200).json({
      success: true,
      message: "Portal applicants analyzed successfully",
      updated: updatedCount,
      alreadyAnalyzed: updatedCount === 0
    });

  } catch (err) {
    console.error("Analyze portal applicants error:", err);
    return res.status(500).json({ success: false, message: err.message });
  }
};

