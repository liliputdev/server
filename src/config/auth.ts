
import "dotenv/config";
import { betterAuth } from "better-auth";
import { MongoClient } from "mongodb";
import { mongodbAdapter } from "@better-auth/mongo-adapter";


const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is missing");
}

const client = new MongoClient(databaseUrl);
const db = client.db("salonbook");

export const auth = betterAuth({
  database: mongodbAdapter(db, { client }),

  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:5000",

  secret: process.env.BETTER_AUTH_SECRET,

  trustedOrigins: [
    process.env.CLIENT_URL || "http://localhost:3000"
  ],

  emailAndPassword: {
    enabled: true
  },

  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "customer",
        input: false
      }
    }
  }
});
