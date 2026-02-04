// scripts/fix-gpa.js
import mongoose from "mongoose";
import Applicant from "../models/applicant.js"; // adjust path
import dotenv from "dotenv";
dotenv.config();

const MONGO = process.env.MONGO_URI || "mongodb://localhost:27017/yourdb";

function normalizeGpaTo4(raw) {
    if (raw === null || raw === undefined) return null;
    const s = String(raw).toLowerCase().trim().replace(",", ".");

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

    const percentMatch = s.match(/(\d+(\.\d+)?)\s*%/);
    if (percentMatch) {
        const val = parseFloat(percentMatch[1]);
        if (!isNaN(val)) {
            const normalized = (val / 100) * 4;
            return Number(normalized.toFixed(2));
        }
        return null;
    }

    const numMatch = s.match(/(\d+(\.\d+)?)/);
    if (!numMatch) return null;
    let val = parseFloat(numMatch[1]);
    if (Number.isNaN(val)) return null;
    if (val >= 0 && val <= 4) return Number(val.toFixed(2));
    if (val > 4 && val <= 10) return Number(((val / 10) * 4).toFixed(2));
    if (val > 10 && val <= 100) return Number(((val / 100) * 4).toFixed(2));
    return null;
}

async function run() {
    await mongoose.connect(MONGO, {});

    // Find applicants where gpa is null or not within 0..4, but extractedData has education
    const cursor = Applicant.find({
        $or: [
            { gpa: null },
            { gpa: { $exists: false } },
            { gpa: { $lt: 0 } },
            { gpa: { $gt: 4 } }
        ],
        "extractedData.education": { $exists: true }
    }).cursor();

    let updated = 0;
    for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
        const eduData = doc.extractedData?.education;
        const educationArray = Array.isArray(eduData) ? eduData : eduData && typeof eduData === "object" ? [eduData] : [];
        const normalizedGpas = [];
        for (const edu of educationArray) {
            const raw = edu?.gpa ?? edu?.cgpa;
            if (raw === undefined || raw === null || String(raw).trim() === "") continue;
            const norm = normalizeGpaTo4(raw);
            if (norm !== null && !isNaN(norm) && norm >= 0 && norm <= 4) normalizedGpas.push(norm);
        }
        let final = null;
        if (normalizedGpas.length > 0) final = Number(Math.max(...normalizedGpas).toFixed(2));
        if (final !== null) {
            doc.gpa = final;
            await doc.save();
            updated++;
            console.log(`Updated ${doc._id} => gpa: ${final}`);
        } else {
            console.log(`No GPA for ${doc._id}`);
        }
    }

    console.log(`Done. Updated: ${updated}`);
    process.exit(0);
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
