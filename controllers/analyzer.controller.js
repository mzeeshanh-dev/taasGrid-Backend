import { storage } from "../storage.js";
import Groq from "groq-sdk";
import * as path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import Batch from "../models/batch.js";
import pdf from "pdf-parse-fixed";
import axios from "axios";
import Applicant from "../models/applicant.js";
import { createBulkApplicantsFromBatch } from "./applicant.controller.js";

dotenv.config();

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MIN_REQUEST_DELAY = 500;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiKey = process.env.GROQ_API_KEY;

if (!apiKey) {
  console.error("❌ GROQ_API_KEY is not set in environment variables");
}

const groq = new Groq({ apiKey: apiKey || "" });

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

/* ===========================
   CV STRUCTURE PARSER
=========================== */
const structureCvData = async (buffer, filename) => {
  const prompt = `You are a professional CV parser. Extract data from the CV and return a VALID JSON object.
  
  CRITICAL INSTRUCTIONS for 'personalInfo':
  You must include these specific keys for the experience chart:
  - "professionalJob": Total number of months in Corporate/Full-time roles.
  - "internship": Total number of months in Internship roles.
  - "freelancing": Total number of months in Freelance/Contract roles.
  
  Calculation Rule: If a role is "Aug 2024 - Present" and today is Jan 2026, that is 17 months.
  
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
      model: "llama-3.3-70b-versatile",
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
    const { batchId, batchName, criteria, jobId } = req.body;

    if (!batchId || !batchName || !jobId) {
      return res.status(400).json({
        message: "batchId, batchName and jobId required"
      });
    }

    const cvs = await storage.getCvs();
    if (!cvs.length) return res.end();

    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("Transfer-Encoding", "chunked");

    let batchCreated = false; // flag to create batch only after first success
    const processed = new Set();

    for (const cv of cvs) {
      if (processed.has(cv.id)) continue;
      if (processed.size > 0) await delay(300);

      try {
        const buffer = Buffer.from(cv.content, "base64");
        const structured = await structureCvData(buffer, cv.filename);

        // ===============================
        // EXPERIENCE — MONTH BASED ONLY
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
        // AI — NON-EXPERIENCE ONLY
        // ===============================

        const analyzePrompt = `
You are an ATS scoring engine.

DO NOT calculate experience scores.
DO NOT use years — months only.
DO NOT invent numbers.

Return ONLY JSON.

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
        // NORMALIZE + CAP AI SCORES
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
        // DISTRIBUTED SCORES
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
        // FINAL PAYLOAD
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

        // ✅ throw API limit error so frontend sees it
        if (err.message.includes("rate limit") || err.message.includes("429")) {
          // make sure stream ends before throwing
          res.end();
          throw new Error("API limit reached for this analysis run");
        }
      }
    }

    // mark batch completed
    if (batchCreated) {
      await Batch.findOneAndUpdate(
        { batchId },
        { status: "completed", updatedAt: new Date() }
      );

      const batch = await Batch.findOne({ batchId });
      const successfulResumes = batch.resumes.filter(
        r => r.analysis?.status === "completed"
      );

      await createBulkApplicantsFromBatch({
        ...batch.toObject(),
        resumes: successfulResumes
      });
    }

    res.end();
    console.log(`✅ Analysis complete for batch: ${batchId}`);

  } catch (err) {
    // ✅ frontend will receive API limit error here
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

    const criteriaRes = await axios.get(
      `http://localhost:3001/api/jobs/criteria/${jobId}`
    );

    const criteria = criteriaRes.data.criteria || criteriaRes.data || {};
    console.log("Criteria:", criteria);

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

