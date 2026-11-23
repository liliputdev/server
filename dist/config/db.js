import mongoose from "mongoose";
const connectDB = async () => {
    try {
        const databaseUrl = process.env.DATABASE_URL;
        if (!databaseUrl) {
            throw new Error("DATABASE_URL is missing");
        }
        await mongoose.connect(databaseUrl);
        console.log("MongoDB connected successfully");
    }
    catch (error) {
        console.error("MongoDB connection failed:", error);
        process.exit(1);
    }
};
export default connectDB;
