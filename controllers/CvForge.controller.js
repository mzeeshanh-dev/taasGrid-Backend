import Groq from "groq-sdk";
import dotenv from "dotenv";
import fs from "fs";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");

import mammoth from "mammoth";

dotenv.config();

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/* =========================
   HELPERS
========================= */

const cleanJson = (text) => {
    try {
        text = text.replace(/```json/g, "").replace(/```/g, "").trim();
        text = text.replace(/^[^{]*/, "").replace(/[^}]*$/, "");
        return JSON.parse(text);
    } catch {
        return { error: "Invalid JSON", raw: text };
    }
};

const extractTextFromPDF = async (buffer) => {
    const data = await pdf(buffer);
    return data.text || "";
};

const extractTextFromDocx = async (buffer) => {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || "";
};

/* =========================
   1. BASIC RESUME PARSER
========================= */

export const parseResume = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "File required" });

        const buffer = req.file.buffer;

        let text = "";

        if (req.file.mimetype.includes("pdf"))
            text = await extractTextFromPDF(buffer);
        else text = await extractTextFromDocx(buffer);

        if (!text.trim())
            return res.status(400).json({ error: "No readable text found" });

        const prompt = `
Extract:

- name
- email
- phone
- skills
- summary
- education (degree, institution, year)
- experience (role, company, years)
- projects (name, domain, description, link)
- certifications (name)
- location
- github
- linkedin
- title

Return ONLY JSON.

Resume:
${text.slice(0, 6000)}
`;

        const result = await groq.chat.completions.create({
            model: "llama-3.1-8b-instant",
            temperature: 0,
            response_format: { type: "json_object" },
            messages: [{ role: "user", content: prompt }],
        });

        const parsed = cleanJson(result.choices[0].message.content);

        res.json(parsed);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/* =========================
   2. EMPLOYEE PARSER (ACADEMIC CV)
========================= */

export const employeeParser = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "File required" });

        const buffer = req.file.buffer;

        let text = "";
        if (req.file.mimetype.includes("pdf"))
            text = await extractTextFromPDF(buffer);
        else text = await extractTextFromDocx(buffer);

        const prompt = `
Extract structured academic CV info.

Return ONLY JSON:

{
  "name": "",
  "email": "",
  "phone": "",
  "citations": "",
  "impactFactor": "",
  "scholar": "",
  "education": [{"degree":"","institution":"","year":""}],
  "experience": [{"role":"","company":"","years":""}],
  "achievements": [],
  "bookAuthorship": [],
  "journalGuestEditor": [],
  "researchPublications": [],
  "mssupervised": [],
  "phdstudentsupervised": [],
  "researchProjects": [],
  "professionalActivities": [],
  "professionalTraining": [],
  "technicalSkills": [],
  "membershipsAndOtherAssociations": [],
  "reference": []
}

Resume:
${text.slice(0, 15000)}
`;

        const result = await groq.chat.completions.create({
            model: "llama-3.1-8b-instant",
            temperature: 0,
            response_format: { type: "json_object" },
            messages: [{ role: "user", content: prompt }],
        });

        const parsed = cleanJson(result.choices[0].message.content);

        res.json(parsed);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

/* =========================
   3. ENRICH CV
========================= */

export const enrichCv = async (req, res) => {
    try {
        const { parsed_data, selected_fields } = req.body;

        if (!parsed_data || !selected_fields)
            return res.status(400).json({ error: "parsed_data and selected_fields required" });

        const prompt = `
You are a professional resume analyst.

Return ONLY JSON:

{
  "summary_improvement": "",
  "missing_sections": [],
  "missing_details": [],
  "suggested_additions": [],
  "tone_recommendation": ""
}

Parsed CV:
${JSON.stringify(parsed_data)}

User Context:
${JSON.stringify(selected_fields)}
`;

        const result = await groq.chat.completions.create({
            model: "llama-3.1-8b-instant",
            temperature: 0.4,
            response_format: { type: "json_object" },
            messages: [{ role: "user", content: prompt }],
        });

        const enriched = cleanJson(result.choices[0].message.content);

        res.json({
            status: "success",
            combined_cv: { ...parsed_data, ai_enrichment: enriched },
            suggestions: enriched,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
