// seeders/roleSeeder.js
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const roleSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    description: { type: String },
});

const Role = mongoose.model("Role", roleSchema);

const roles = [
    { name: "Recruiter", description: "Can post jobs, FYPs, projects" },
    { name: "Job-Seeker", description: "Can apply to jobs and internships" },
    { name: "Student", description: "Can apply for FYPs and use IdeaVault" },
];

const seedRoles = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);

        console.log("Connected to DB. Seeding roles...");

        for (let role of roles) {
            const exists = await Role.findOne({ name: role.name });

            if (!exists) {
                await Role.create(role);
                console.log(`Role created: ${role.name}`);
            } else {
                console.log(`Role already exists: ${role.name}`);
            }
        }

        console.log("Role seeding complete!");
        await mongoose.disconnect();

    } catch (error) {
        console.error("Error seeding roles:", error);
        await mongoose.disconnect();
    }
};

seedRoles();