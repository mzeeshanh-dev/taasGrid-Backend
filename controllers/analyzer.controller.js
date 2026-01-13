import { storage } from "../storage.js";
import Groq from "groq-sdk"; // Switched to Groq
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import Batch from "../models/batch.js";
import pdf from "pdf-parse-fixed"; // Need a simple parser to send text to Groq

dotenv.config();

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MIN_REQUEST_DELAY = 500;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiKey = process.env.GROQ_API_KEY;

if (!apiKey) {
  console.error("❌ GROQ_API_KEY is not set in environment variables");
} else {
  console.log("✓ GROQ_API_KEY found:", apiKey.substring(0, 10) + "...");
}

const groq = new Groq({ apiKey: apiKey || "" });

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const formatExperience = (years) => {
  if (!years || years === 0) return "0 months";
  const wholeYears = Math.floor(years);
  const months = Math.round((years - wholeYears) * 12);
  if (wholeYears === 0) return `${months} month${months === 1 ? '' : 's'}`;
  if (months === 0) return `${wholeYears} year${wholeYears === 1 ? '' : 's'}`;
  return `${wholeYears} year${wholeYears === 1 ? '' : 's'} ${months} month${months === 1 ? '' : 's'}`;
};

// Structured CV Data Parser
const structureCvData = async (buffer, filename) => {
  // We force the AI to calculate months and use your exact frontend keys
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
    const cvText = data.text;

    const result = await groq.chat.completions.create({
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: cvText }
      ],
      model: "qwen/qwen3-32b",
      temperature: 0.1,
      max_tokens: 8192,
      response_format: { type: "json_object" }
    });

    const parsedData = JSON.parse(result.choices[0].message.content);

    // Fallback: Ensure keys exist so frontend doesn't crash if AI misses one
    if (parsedData.personalInfo) {
      parsedData.personalInfo.professionalJob = parsedData.personalInfo.professionalJob || 0;
      parsedData.personalInfo.internship = parsedData.personalInfo.internship || 0;
      parsedData.personalInfo.freelancing = parsedData.personalInfo.freelancing || 0;
    }

    return parsedData;
  } catch (error) {
    console.error(`✗ Error processing ${filename}:`, error.message);
    throw error;
  }
};

export const uploadCvs = async (req, res) => {
  try {
    const files = req.files;
    if (!files || files.length === 0) return res.status(400).json({ message: "No files uploaded" });

    const processedCvs = [];
    const errors = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      console.log(`Processing file ${i + 1}/${files.length}: ${file.originalname}`);

      if (file.size > MAX_FILE_SIZE) {
        errors.push({ filename: file.originalname, error: "File exceeds 50MB limit" });
        continue;
      }

      try {
        if (i > 0) await delay(MIN_REQUEST_DELAY);

        const base64Content = file.buffer.toString('base64');
        const cv = await storage.createCv({
          filename: file.originalname,
          content: base64Content,
          uploadDate: new Date().toISOString(),
        });

        console.log(`Extracting data from ${file.originalname}...`);
        const structuredData = await structureCvData(file.buffer, file.originalname);

        processedCvs.push({
          id: cv.id,
          filename: cv.filename,
          uploadDate: cv.uploadDate,
          extractedData: {
            personalInfo: structuredData.personalInfo || {},
            summary: structuredData.summary || "",
            education: structuredData.education || [],
            experience: structuredData.experience || [],
            skills: structuredData.skills || { technical: [], soft: [], languages: [], tools: [] },
            certifications: structuredData.certifications || [],
            projects: structuredData.projects || []
          }
        });

        console.log(`✓ Successfully processed ${file.originalname}`);
      } catch (e) {
        console.error(`✗ Error processing ${file.originalname}:`, e.message);
        errors.push({
          filename: file.originalname,
          error: e.message || "Processing failed"
        });
      }
    }

    res.json({
      success: processedCvs.length > 0,
      cvs: processedCvs,
      errors,
      message: `Processed ${processedCvs.length}/${files.length} files`,
      summary: {
        totalFiles: files.length,
        processedFiles: processedCvs.length,
        failedFiles: errors.length
      }
    });
  } catch (error) {
    console.error("Upload handler error:", error);
    res.status(500).json({ message: "Upload failed", error: error.message });
  }
};

export const analyzeCvs = async (req, res) => {
  try {
    const { batchId, batchName, criteria } = req.body;
    if (!batchId || !batchName) return res.status(400).json({ message: "batchId and batchName required" });

    const cvs = await storage.getCvs();
    if (!cvs.length) return res.json([]);

    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("Transfer-Encoding", "chunked");

    let batch = await Batch.findOne({ batchId });
    if (!batch) {
      batch = await Batch.create({ batchId, name: batchName, resumes: [] });
    } else {
      batch.resumes = [];
      batch.updatedAt = new Date();
      await batch.save();
    }

    for (let i = 0; i < cvs.length; i++) {
      const cv = cvs[i];
      if (i > 0) await delay(500);

      try {
        // Use existing buffer logic from storage
        const buffer = Buffer.from(cv.content, 'base64');
        const structuredCvData = await structureCvData(buffer, cv.filename);

        const analyzePrompt = `
          Analyze this CV against criteria: ${JSON.stringify(criteria)}
          CV Data: ${JSON.stringify(structuredCvData)}
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
          }
        `;

        const analysisResult = await groq.chat.completions.create({
          messages: [{ role: "user", content: analyzePrompt }],
          model: "qwen/qwen3-32b",
          temperature: 0.1,
          max_tokens: 8192,
          response_format: { type: "json_object" }
        });

        const analysisText = analysisResult.choices[0].message.content.trim();
        const analysis = JSON.parse(analysisText);

        const resObj = {
          cv: { id: cv.id, filename: cv.filename, uploadDate: cv.uploadDate },
          extractedData: structuredCvData,
          analysis: {
            id: cv.id,
            cvId: cv.id,
            score: Math.min(100, Math.max(0, analysis.score || 0)),
            matchPercentage: Math.min(100, Math.max(0, analysis.matchPercentage || 0)),
            matchDetails: analysis.matchDetails || "Analysis completed",
            strengths: analysis.strengths || [],
            gaps: analysis.gaps || [],
            recommendations: analysis.recommendations || [],
            matchedSkills: analysis.matchedSkills || [],
            experienceMatch: analysis.experienceMatch || "",
            locked: false,
            analyzedAt: new Date()
          }
        };
        res.write(JSON.stringify(resObj) + "\n");
        batch.resumes.push(resObj);
      } catch (e) {
        res.write(JSON.stringify({
          cv: { id: cv.id, filename: cv.filename },
          error: true,
          message: e.message
        }) + "\n");
        console.log("Analyzation is completed");
      }
    }

    batch.updatedAt = new Date();
    await batch.save();
    console.log(`✓ Analysis successfully completed for batch: ${batchName}`);
    res.end();
  } catch (error) {
    console.error("✗ Analysis failed:", error.message);
    res.status(500).json({ message: "Analysis failed", error: error.message });
  }
};

export const rankCvs = async (req, res) => {
  const results = (req).session?.analysisResults || [];
  res.json(results.sort((a, b) => b.analysis.score - a.analysis.score));
};

export const clearCvs = async (req, res) => {
  await storage.clearCvs();
  res.json({ message: "Cleared" });
};