import { storage } from "../storage.js";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import Batch from "../models/batch.js";
dotenv.config();


const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MIN_REQUEST_DELAY = 500;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error("❌ GEMINI_API_KEY is not set in environment variables");
} else {
  console.log("✓ GEMINI_API_KEY found:", apiKey.substring(0, 10) + "...");
}

const genAI = new GoogleGenerativeAI(apiKey || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

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
  const prompt = `You are a CV parser. Extract and structure the following CV data into VALID JSON format. Return ONLY the JSON object.

{
  "personalInfo": {
    "fullName": "",
    "email": "",
    "phone": "",
    "location": "",
    "linkedIn": "",
    "portfolio": ""
  },
  "summary": "",
  "education": [],
  "experience": [],
  "skills": {
    "technical": [],
    "soft": [],
    "languages": [],
    "tools": []
  },
  "certifications": [],
  "projects": []
}`;

  try {
    // Create File-like object for Gemini API
    const fileData = {
      inlineData: {
        mimeType: "application/pdf",
        data: typeof buffer === 'string' ? buffer : buffer.toString('base64')
      }
    };

    console.log(`Sending PDF to Gemini API for ${filename}...`);
    console.log(`API Key valid: ${apiKey ? 'Yes' : 'No'}`);

    const result = await model.generateContent([fileData, { text: prompt }]);
    const response = await result.response;
    const text = response.text();

    console.log(`Received response for ${filename}`);

    // Extract JSON from response
    let jsonStr = text.trim();

    // Remove markdown formatting
    if (jsonStr.includes('```')) {
      const matches = jsonStr.match(/```[\s\S]*?\n([\s\S]*?)\n```/);
      if (matches) jsonStr = matches[1];
    }

    // Find the JSON object
    const startIdx = jsonStr.indexOf('{');
    const endIdx = jsonStr.lastIndexOf('}');

    if (startIdx === -1 || endIdx === -1) {
      console.error(`No JSON found in response for ${filename}`);
      console.error(`Response text: ${jsonStr.substring(0, 200)}`);
      throw new Error("No JSON found in API response");
    }

    const jsonStr2 = jsonStr.substring(startIdx, endIdx + 1);
    const structuredData = JSON.parse(jsonStr2);

    console.log(`✓ Successfully parsed CV data for ${filename}`);
    return structuredData;
  } catch (error) {
    console.error(`✗ Error processing ${filename}:`, error.message);
    console.error(`Full error:`, error);
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
        // Add delay between requests to avoid rate limiting
        if (i > 0) await delay(MIN_REQUEST_DELAY);

        // Store CV with base64 content
        const base64Content = file.buffer.toString('base64');
        const cv = await storage.createCv({
          filename: file.originalname,
          content: base64Content,
          uploadDate: new Date().toISOString(),
        });

        console.log(`Extracting data from ${file.originalname}...`);

        // Extract and structure CV data using the file buffer
        const structuredData = await structureCvData(file.buffer, file.originalname);

        // Return structured data without large base64 content
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
          error: e.message || "Processing failed",
          details: e.toString()
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
    const criteria = req.body;
    const cvs = await storage.getCvs();
    if (!cvs.length) return res.json([]);

    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("Transfer-Encoding", "chunked");

    // 1️⃣ Fetch or create single batch
    let batch = await Batch.findOne({ name: "single-batch" });
    if (!batch) {
      batch = await Batch.create({ name: "single-batch", resumes: [] });
    }

    const allResults = [];

    for (let i = 0; i < cvs.length; i++) {
      const cv = cvs[i];
      if (i > 0) await delay(500); // prevent rate limit

      try {
        // 2️⃣ Extract structured CV data
        const structuredCvData = await structureCvData(cv.content, cv.filename);

        // 3️⃣ Analyze CV using AI
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

        const analysisResult = await model.generateContent([
          { inlineData: { mimeType: "application/pdf", data: cv.content } },
          { text: analyzePrompt }
        ]);

        const analysisResponse = await analysisResult.response;
        let analysisText = analysisResponse.text().trim()
          .replace(/```json\n?/g, '')
          .replace(/```\n?/g, '')
          .trim();

        const analysisJsonMatch = analysisText.match(/\{[\s\S]*\}/);
        const analysis = JSON.parse(analysisJsonMatch ? analysisJsonMatch[0] : analysisText);

        // 4️⃣ Build result object
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

        allResults.push(resObj);

        // 5️⃣ Streaming to frontend
        res.write(JSON.stringify(resObj) + "\n");

        // 6️⃣ Upsert in MongoDB batch
        const existingIndex = batch.resumes.findIndex(r => r.cv.id === cv.id);
        if (existingIndex !== -1) {
          batch.resumes[existingIndex] = resObj; // update
        } else {
          batch.resumes.push(resObj); // insert new
        }

      } catch (e) {
        // stream error for this CV
        res.write(JSON.stringify({ cv: { id: cv.id, filename: cv.filename }, error: true, message: e.message }) + "\n");
      }
    }

    batch.updatedAt = new Date();
    await batch.save(); // persist batch in MongoDB
    res.end();

  } catch (error) {
    console.error(error);
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
