import { storage } from "../storage.js";
import Groq from "groq-sdk";
import * as path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import Batch from "../models/batch.js";
import pdf from "pdf-parse-fixed";

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
      "freelancing": 0 
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
    const { batchId, batchName, criteria } = req.body;
    if (!batchId || !batchName) {
      return res.status(400).json({ message: "batchId and batchName required" });
    }

    const cvs = await storage.getCvs();
    if (!cvs.length) return res.end();

    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("Transfer-Encoding", "chunked");

    await Batch.findOneAndUpdate(
      { batchId },
      { name: batchName, resumes: [], updatedAt: new Date() },
      { upsert: true }
    );

    const processed = new Set();

    for (const cv of cvs) {
      if (processed.has(cv.id)) continue;
      if (processed.size > 0) await delay(500);

      try {
        const buffer = Buffer.from(cv.content, "base64");
        const structured = await structureCvData(buffer, cv.filename);

        const analyzePrompt = `
Analyze this CV against criteria: ${JSON.stringify(criteria)}
CV Data: ${JSON.stringify(structured)}
Return ONLY a JSON object:
{
  "score": 0-100,
  "matchPercentage": 0-100,
  "matchDetails": "",
  "strengths": [],
  "gaps": [],
  "recommendations": [],
  "matchedSkills": [],
  "experienceMatch": ""
}`;

        const result = await groq.chat.completions.create({
          model: "llama-3.1-8b-instant",
          temperature: 0.1,
          response_format: { type: "json_object" },
          messages: [{ role: "user", content: analyzePrompt }]
        });

        const analysis = JSON.parse(result.choices[0].message.content);

        const payload = {
          cv: { id: cv.id, filename: cv.filename, uploadDate: cv.uploadDate },
          extractedData: structured,
          analysis: {
            score: Math.min(100, Math.max(0, analysis.score || 0)),
            matchPercentage: Math.min(100, Math.max(0, analysis.matchPercentage || 0)),
            matchDetails: analysis.matchDetails || "",
            strengths: analysis.strengths || [],
            gaps: analysis.gaps || [],
            recommendations: analysis.recommendations || [],
            matchedSkills: analysis.matchedSkills || [],
            experienceMatch: analysis.experienceMatch || "",
            locked: false,
            analyzedAt: new Date()
          }
        };

        res.write(JSON.stringify(payload) + "\n");

        await Batch.updateOne(
          { batchId },
          { $push: { resumes: payload } }
        );

        processed.add(cv.id);

      } catch (err) {
        res.write(JSON.stringify({
          cv: { id: cv.id, filename: cv.filename },
          error: true,
          message: err.message
        }) + "\n");
      }
    }

    res.end();

  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ message: "Analysis failed", error: err.message });
    } else {
      res.end();
    }
  }
};

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
