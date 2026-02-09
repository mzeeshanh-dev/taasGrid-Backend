import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pdf from "pdf-parse-fixed"; // stable PDF parser
import { convert } from "pdf-poppler"; // optional OCR fallback
import Tesseract from "tesseract.js"; // optional OCR fallback
import mammoth from "mammoth"; // DOCX extraction
import dotenv from "dotenv";
import Groq from "groq-sdk";

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ----------------------------
// Helper Functions
// ----------------------------

async function extractTextFromPDF(buffer) {
    let text = "";
    try {
        const data = await pdf(buffer);
        text = data.text;
    } catch (err) {
        console.log("PDF parse failed:", err.message);
    }

    // Optional OCR fallback if PDF is scanned
    if (!text.trim()) {
        try {
            const tempPdfPath = path.join(__dirname, "temp.pdf");
            fs.writeFileSync(tempPdfPath, buffer);
            const images = await convert(tempPdfPath, { format: "png", out_dir: __dirname });
            for (let imgPath of images) {
                const { data: { text: ocrText } } = await Tesseract.recognize(imgPath, "eng");
                text += ocrText + "\n";
                fs.unlinkSync(imgPath);
            }
            fs.unlinkSync(tempPdfPath);
        } catch (ocrErr) {
            console.log("⚠️ OCR failed:", ocrErr.message);
        }
    }

    return text.trim();
}

async function extractTextFromDocx(buffer) {
    try {
        const { value } = await mammoth.extractRawText({ buffer });
        return value.trim();
    } catch (err) {
        console.log("DOCX extraction failed:", err.message);
        return "";
    }
}

function cleanJsonOutput(text) {
    try {
        text = text.replace(/```json|```/g, "").trim();
        text = text.replace(/^[^{]*/, "").replace(/[^}]*$/, "");
        text = text.replace(/[“”]/g, '"').replace(/’/g, "'");
        text = text.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]");
        return JSON.parse(text);
    } catch (err) {
        console.log("⚠️ JSON parse error:", err.message);
        return { error: "Invalid JSON output from LLM", raw_output: text };
    }
}

function removeResearchPublications(text) {
    const cleanText = text.replace(/\s+/g, " ");
    const pattern = /(RESEARCH\s*PUBLICATIONS.*?)(M\.?S\.?\s*STUDENTS?\s*SUPERVISED|PhD\s*STUDENTS?\s*SUPERVISED|$)/i;
    return cleanText.replace(pattern, "$2").trim();
}

function extractSupervisionSections(text) {
    let msSection = "";
    let phdSection = "";

    let cleanText = text.replace(/\s+/g, " ").replace(/Ph\.D\./g, "PhD").replace(/M\.?\s*S\.?/g, "M.S.");

    const msMatch = cleanText.match(/(M\.?S\.?\s*STUDENTS?\s*SUPERVISED.*?)(PhD\s*STUDENTS?\s*SUPERVISED|$)/i);
    if (msMatch) msSection = msMatch[1].trim();

    const phdMatch = cleanText.match(/(PhD\s*STUDENTS?\s*SUPERVISED.*)/i);
    if (phdMatch) phdSection = phdMatch[1].trim();

    return { msSection, phdSection };
}

// ----------------------------
// PROMPT TEMPLATES
// ----------------------------

function employeeParserPrompt(resumeText) {
    return `
Extract structured information from the resume text below.

Return **only valid JSON** with the following structure:

{
  "name": "",
  "email": "",
  "phone": "",
  "citations": "",
  "impactFactor": "",
  "scholar": "",
  "education": [{"degree": "", "institution": "", "year": ""}],
  "experience": [{"role": "", "company": "", "years": ""}],
  "achievements": [""],
  "bookAuthorship": [{"title": "", "publisher": ""}],
  "journalGuestEditor": [{"title": "", "publisher": "", "section": ""}],
  "researchPublications": [{"title": "", "journal": "", "year": ""}],
  "mssupervised": [{"studentName": "", "thesisTitle": "", "year": ""}],
  "phdstudentsupervised": [{"studentName": "", "thesisTitle": "", "year": ""}],
  "researchProjects": [{"title": "", "description": ""}],
  "professionalActivities": [{"heading": "", "desc": "", "year": ""}],
  "professionalTraining": [{"title": "", "description": "", "year": ""}],
  "technicalSkills": [{"category": "", "details": ""}],
  "membershipsAndOtherAssociations": [{"heading": "", "desc": "", "year": ""}],
  "reference": [{"prof": "", "designation": "", "mail": "", "phone": ""}]
}

Rules:
1. Ignore any research publication titles when listing student supervision.
2. Use section markers for M.S. and PhD supervision.
3. Return **only JSON**, no explanations or markdown.

Resume Text:
${resumeText}
`;
}

function parserPrompt(resumeText) {
    return `
Extract the following structured information from the resume below:

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

Return ONLY valid JSON format (no explanations, no extra text).

Resume Text:
${resumeText}
`;
}

function enrichPrompt(parsedData, selectedFields) {
    return `
You are a professional resume analyst and recruiter assistant.
Study the parsed resume (JSON) and user's selected context (role, industry, experience_level, tone).

Return **strict JSON** with:
{
  "summary_improvement": "",
  "missing_sections": [],
  "missing_details": [],
  "suggested_additions": [],
  "tone_recommendation": ""
}

Parsed CV:
${JSON.stringify(parsedData, null, 2)}

User Context:
${JSON.stringify(selectedFields, null, 2)}
`;
}

// ----------------------------
// CONTROLLERS
// ----------------------------

export async function parseResume(req, res) {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        const buffer = req.file.buffer;
        let resumeText = req.file.originalname.toLowerCase().endsWith(".pdf")
            ? await extractTextFromPDF(buffer)
            : await extractTextFromDocx(buffer);

        if (!resumeText.trim()) return res.status(400).json({ error: "No readable text found" });

        resumeText = resumeText.slice(0, 6000);
        const prompt = parserPrompt(resumeText);

        const result = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            temperature: 0.1,
            response_format: { type: "json_object" },
            messages: [{ role: "user", content: prompt }]
        });

        const rawData = cleanJsonOutput(result.choices[0].message.content);
        return res.json(rawData);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
}

export async function employeeParser(req, res) {
    try {
        if (!req.file) return res.status(400).json({ error: "No file uploaded" });

        const buffer = req.file.buffer;
        let resumeText = req.file.originalname.toLowerCase().endsWith(".pdf")
            ? await extractTextFromPDF(buffer)
            : await extractTextFromDocx(buffer);

        if (!resumeText.trim()) return res.status(400).json({ error: "No readable text found" });

        resumeText = resumeText.slice(0, 15000);
        resumeText = removeResearchPublications(resumeText);
        const { msSection, phdSection } = extractSupervisionSections(resumeText);

        const resumeInput = `
${resumeText}

--- START OF M.S. SUPERVISED SECTION ---
${msSection}

--- START OF PhD SUPERVISED SECTION ---
${phdSection}
`;

        const result = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            temperature: 0.1,
            response_format: { type: "json_object" },
            messages: [{ role: "user", content: employeeParserPrompt(resumeInput) }]
        });

        const structuredData = cleanJsonOutput(result.choices[0].message.content);
        return res.json(structuredData);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
}

export async function enrichCv(req, res) {
    try {
        const { parsed_data, selected_fields } = req.body;
        if (!parsed_data || !selected_fields) return res.status(400).json({ error: "Missing body parameters" });

        const prompt = enrichPrompt(parsed_data, selected_fields);
        const result = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            temperature: 0.4,
            response_format: { type: "json_object" },
            messages: [{ role: "user", content: prompt }]
        });

        let enriched = cleanJsonOutput(result.choices[0].message.content);
        const combinedCv = { ...parsed_data, ai_enrichment: enriched };

        return res.json({ status: "success", combined_cv: combinedCv, suggestions: enriched });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: err.message });
    }
}
