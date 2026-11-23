
import "dotenv/config";
import mongoose from "mongoose";
import { MongoClient } from "mongodb";

const run = async () => {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is missing");
  }

  const email = process.argv[2]?.toLowerCase();

  if (!email) {
    throw new Error("Usage: npm run make-admin user@example.com");
  }

  const client = new MongoClient(databaseUrl);

  try {
    await client.connect();

    const db = client.db("salonbook");
    const users = db.collection("user");

    const result = await users.updateOne(
      { email },
      { $set: { role: "admin" } }
    );

    if (result.matchedCount === 0) {
      console.log("User not found. Register the account first.");
    } else {
      console.log(`Admin role assigned to ${email}`);
    }
  } finally {
    await client.close();
    await mongoose.disconnect().catch(() => {});
  }
};

run().catch((error) => {
  console.error("Failed to assign admin:", error);
  process.exit(1);
});
