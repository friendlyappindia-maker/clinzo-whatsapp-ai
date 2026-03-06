import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from "dotenv";
import twilio from "twilio";
import { createClient } from '@supabase/supabase-js';

dotenv.config();

// Fix for "self-signed certificate in certificate chain" error
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Supabase Client lazily to avoid crashes if env vars are missing
let supabaseInstance: any = null;
function getSupabase() {
  if (!supabaseInstance) {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://sdaynypgtyfniukmqcfh.supabase.co";
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNkYXlueXBndHlmbml1a21xY2ZoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjc4Nzk2OSwiZXhwIjoyMDg4MzYzOTY5fQ.IRR0XK3cYIPvEz1ISf2RY2UsxwvcPpPRknrbtY2WyhE";
    const supabaseJwtSecret = process.env.SUPABASE_JWT_SECRET || "MoDJZwMSbhLpEoS9XgvsANrtm6E7HM+vdLWRFlg2FT4w9bHDBXDFJOo6b5MnbMyA4NvR/qixRIRNFrCepCmCoA==";
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.warn("[Supabase] Missing credentials. Supabase features will be disabled.");
      return null;
    }
    
    try {
      supabaseInstance = createClient(supabaseUrl, supabaseServiceKey);
    } catch (err) {
      console.error("[Supabase] Initialization failed:", err);
      return null;
    }
  }
  return supabaseInstance;
}

let pool: any = null;

function getPool() {
  if (!pool) {
    const connectionString = process.env.POSTGRES_URL || "postgres://postgres.sdaynypgtyfniukmqcfh:5AlqmLn7muNd04JY@aws-1-ap-south-1.pooler.supabase.com:6543/postgres?sslmode=require&supa=base-pooler.x";
    const nonPoolingUrl = process.env.POSTGRES_URL_NON_POOLING || "postgres://postgres.sdaynypgtyfniukmqcfh:5AlqmLn7muNd04JY@aws-1-ap-south-1.pooler.supabase.com:5432/postgres?sslmode=require";
    
    if (!connectionString) {
      console.error("[DB] POSTGRES_URL is missing in environment variables.");
      throw new Error("Database configuration missing (POSTGRES_URL). Please check your Secrets/Environment Variables.");
    }
    pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false,
      },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000, // 5 second timeout for Vercel
    });
  }
  return pool;
}

// Initialize Database Schema
async function initDb() {
  console.log("[DB] Initializing database schema...");
  try {
    const client = await getPool().connect();
    try {
      console.log("[DB] Connected to database. Running migrations...");
      
      // Ensure tables exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS hospitals (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          registration_number TEXT UNIQUE NOT NULL,
          address TEXT,
          city TEXT,
          contact_person TEXT,
          phone TEXT,
          email TEXT,
          google_maps_link TEXT,
          specializations TEXT,
          profile_photo TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          role TEXT NOT NULL,
          name TEXT NOT NULL,
          registration_number TEXT,
          phone TEXT,
          hospital_id INTEGER REFERENCES hospitals(id),
          specialization TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS ngos (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS referrals (
          id SERIAL PRIMARY KEY,
          patient_name TEXT NOT NULL,
          patient_mobile TEXT NOT NULL,
          referring_doctor_id INTEGER NOT NULL REFERENCES users(id),
          hospital_id INTEGER NOT NULL REFERENCES hospitals(id),
          specialist_name TEXT,
          specialty TEXT,
          status TEXT DEFAULT 'CREATED',
          diagnosis_summary TEXT,
          procedure_recommended TEXT,
          treatment_plan TEXT,
          surgery_date TEXT,
          package_cost REAL,
          discount_value REAL,
          discount_allocation TEXT,
          ngo_id INTEGER REFERENCES ngos(id),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Ensure new columns exist
      console.log("[DB] Checking for missing columns...");
      
      await client.query(`
        ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS google_maps_link TEXT;
        ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS specializations TEXT;
        ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS profile_photo TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS specialization TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS qualifications TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS experience TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_photo TEXT;
        ALTER TABLE referrals ADD COLUMN IF NOT EXISTS specialty TEXT;
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS hospital_specializations (
          id SERIAL PRIMARY KEY,
          hospital_id INTEGER REFERENCES hospitals(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS doctor_specializations (
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          specialization_id INTEGER REFERENCES hospital_specializations(id) ON DELETE CASCADE,
          PRIMARY KEY (user_id, specialization_id)
        );
      `);
      console.log("[DB] Database schema is up to date.");

    // Seed initial data if empty
    const userCountRes = await client.query("SELECT COUNT(*) FROM users");
    if (parseInt(userCountRes.rows[0].count) === 0) {
      console.log("Seeding initial data...");
      // Admin
      await client.query("INSERT INTO users (email, password, role, name) VALUES ($1, $2, $3, $4)", [
        "admin@clinzo.com",
        "admin123",
        "ADMIN",
        "Platform Admin"
      ]);

      // Hospital
      const hospitalResult = await client.query(
        "INSERT INTO hospitals (name, registration_number, city) VALUES ($1, $2, $3) RETURNING id",
        ["City Surgical Hospital", "HOSP-001", "Mumbai"]
      );
      const hospitalId = hospitalResult.rows[0].id;

      // Hospital Admin
      await client.query(
        "INSERT INTO users (email, password, role, name, hospital_id) VALUES ($1, $2, $3, $4, $5)",
        ["hospital@city.com", "hosp123", "HOSPITAL_ADMIN", "Dr. Sharma (Hospital Admin)", hospitalId]
      );

      // Referring Doctor
      await client.query(
        "INSERT INTO users (email, password, role, name, registration_number) VALUES ($1, $2, $3, $4, $5)",
        ["doctor@clinic.com", "doc123", "DOCTOR", "Dr. Rajesh (MBBS)", "REG-12345"]
      );

      // NGOs
      await client.query("INSERT INTO ngos (name, description) VALUES ($1, $2)", [
        "Health For All",
        "Supporting surgical costs for underprivileged patients"
      ]);
      await client.query("INSERT INTO ngos (name, description) VALUES ($1, $2)", [
        "Care Foundation",
        "Medical aid NGO"
      ]);
      console.log("Seeding complete.");
    }
    console.log("Database initialization successful.");
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Database initialization failed:", err);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Request logging
  app.use((req, res, next) => {
    if (req.url.startsWith('/api')) {
      console.log(`[API Request] ${req.method} ${req.url}`);
    }
    next();
  });

  const apiRouter = express.Router();
  app.use("/api", apiRouter);

  // Health check / DB check
  apiRouter.get("/health", async (req, res) => {
    try {
      const client = await getPool().connect();
      try {
        await client.query("SELECT 1");
        const tableInfo = await client.query(`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns 
          WHERE table_name = 'referrals'
          ORDER BY ordinal_position
        `);
        const referralCount = await client.query("SELECT COUNT(*) FROM referrals");
        res.json({ 
          status: "ok", 
          db: "connected", 
          referrals_count: referralCount.rows[0].count,
          referrals_schema: tableInfo.rows 
        });
      } finally {
        client.release();
      }
    } catch (e: any) {
      res.status(500).json({ 
        status: "error", 
        db: "disconnected", 
        error: e.message 
      });
    }
  });

  // Auth
  apiRouter.post("/login", async (req, res) => {
    const { email, password } = req.body;
    try {
      const result = await getPool().query("SELECT * FROM users WHERE email = $1 AND password = $2", [email, password]);
      const user = result.rows[0];
      if (user) {
        const { password, ...userWithoutPassword } = user;
        res.json(userWithoutPassword);
      } else {
        res.status(401).json({ error: "Invalid credentials" });
      }
    } catch (e: any) {
      res.status(500).json({ error: "Database error" });
    }
  });

  // Admin: Register User
  apiRouter.post("/admin/register", async (req, res) => {
    const { email, password, role, name, phone, hospital_id, specialization, qualifications, experience } = req.body;
    try {
      const result = await getPool().query(`
        INSERT INTO users (email, password, role, name, phone, hospital_id, specialization, qualifications, experience)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id
      `, [email, password, role, name, phone, hospital_id, specialization, qualifications, experience]);
      res.json({ id: result.rows[0].id });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Admin: List Users
  apiRouter.get("/admin/users", async (req, res) => {
    try {
      const result = await getPool().query(`
        SELECT p.*, h.name as hospital_name 
        FROM users p 
        LEFT JOIN hospitals h ON p.hospital_id = h.id
        ORDER BY p.created_at DESC
      `);
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  apiRouter.get("/users/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const userResult = await getPool().query(`
        SELECT u.*, h.name as hospital_name
        FROM users u
        LEFT JOIN hospitals h ON u.hospital_id = h.id
        WHERE u.id = $1
      `, [id]);
      
      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const user = userResult.rows[0];
      
      // Get specializations
      const specsResult = await getPool().query(`
        SELECT s.id, s.name
        FROM hospital_specializations s
        JOIN doctor_specializations ds ON s.id = ds.specialization_id
        WHERE ds.user_id = $1
      `, [id]);
      user.specializations = specsResult.rows;
      
      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Hospitals
  apiRouter.get("/hospitals", async (req, res) => {
    try {
      const result = await getPool().query("SELECT * FROM hospitals");
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  apiRouter.get("/hospitals/:id", async (req, res) => {
    const { id } = req.params;
    try {
      const result = await getPool().query("SELECT * FROM hospitals WHERE id = $1", [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Hospital not found" });
      }
      res.json(result.rows[0]);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  apiRouter.post("/hospitals", async (req, res) => {
    const { name, registration_number, address, city, contact_person, phone, email, google_maps_link, specializations, profile_photo } = req.body;
    try {
      const result = await getPool().query(`
        INSERT INTO hospitals (name, registration_number, address, city, contact_person, phone, email, google_maps_link, specializations, profile_photo)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id
      `, [name, registration_number, address, city, contact_person, phone, email, google_maps_link, specializations, profile_photo]);
      res.json({ id: result.rows[0].id });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  apiRouter.patch("/hospitals/:id", async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const keys = Object.keys(updates);
    const values = Object.values(updates);
    if (keys.length === 0) return res.status(400).json({ error: "No updates provided" });
    
    const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
    try {
      await getPool().query(`
        UPDATE hospitals 
        SET ${setClause}
        WHERE id = $${keys.length + 1}
      `, [...values, id]);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Referrals
  apiRouter.get("/referrals", async (req, res) => {
    const { doctor_id, hospital_id, role } = req.query;
    let query = `
      SELECT r.*, h.name as hospital_name, u.name as doctor_name, n.name as ngo_name
      FROM referrals r
      JOIN hospitals h ON r.hospital_id = h.id
      JOIN users u ON r.referring_doctor_id = u.id
      LEFT JOIN ngos n ON r.ngo_id = n.id
    `;
    const params: any[] = [];
    let paramCount = 1;

    if (role === 'DOCTOR') {
      if (doctor_id && doctor_id !== 'undefined' && doctor_id !== 'null') {
        query += ` WHERE r.referring_doctor_id = $${paramCount++}`;
        params.push(doctor_id);
      } else {
        return res.json([]);
      }
    } else if (role === 'HOSPITAL_ADMIN' || role === 'HOSPITAL_COORDINATOR') {
      if (hospital_id && hospital_id !== 'undefined' && hospital_id !== 'null') {
        query += ` WHERE r.hospital_id = $${paramCount++}`;
        params.push(hospital_id);
      } else {
        return res.json([]);
      }
    }

    query += " ORDER BY r.created_at DESC";
    try {
      const result = await getPool().query(query, params);
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  const sendWhatsAppNotification = async (patientName: string, patientMobile: string, hospitalName: string, specialty: string) => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromWhatsApp = process.env.TWILIO_WHATSAPP_NUMBER;

    if (!accountSid || !authToken || !fromWhatsApp) {
      console.warn("[Twilio] Missing configuration. Skipping notification.");
      return;
    }

    const client = twilio(accountSid, authToken);
    
    // Ensure mobile number is in E.164 format for WhatsApp
    // Assuming user enters 10 digits, we prefix with +91 for India as default if not present
    let toMobile = patientMobile.trim();
    if (!toMobile.startsWith('+')) {
      toMobile = `+91${toMobile}`;
    }

    const message = `Hello ${patientName}, your referral for ${specialty} at ${hospitalName} has been successfully created. We will contact you soon for the appointment. - Clinzo Team`;

    try {
      // Ensure from number is prefixed with 'whatsapp:'
      const fromFormatted = fromWhatsApp.startsWith('whatsapp:') ? fromWhatsApp : `whatsapp:${fromWhatsApp}`;
      
      console.log(`[Twilio] Attempting to send WhatsApp message to ${toMobile} from ${fromFormatted}...`);
      const result = await client.messages.create({
        from: fromFormatted,
        to: `whatsapp:${toMobile}`,
        body: message
      });
      console.log(`[Twilio] WhatsApp notification sent! SID: ${result.sid}`);
    } catch (err: any) {
      console.error("[Twilio] Failed to send WhatsApp notification:", err.message);
      if (err.code === 21608) {
        console.error("[Twilio Error] This number is not yet approved for WhatsApp or not joined to the Sandbox.");
      }
    }
  };

  apiRouter.post("/referrals", async (req, res) => {
    console.log("[Referral] POST /api/referrals received body:", JSON.stringify(req.body, null, 2));
    const { patient_name, patient_mobile, referring_doctor_id, hospital_id, specialist_name, specialty } = req.body;
    
    const docId = parseInt(referring_doctor_id?.toString());
    const hospId = parseInt(hospital_id?.toString());

    if (!patient_name || !patient_mobile || isNaN(docId) || isNaN(hospId) || !specialty) {
      console.error("[Referral] Missing or invalid required fields:", { patient_name, patient_mobile, docId, hospId, specialty });
      return res.status(400).json({ error: "Missing or invalid required fields: patient_name, patient_mobile, referring_doctor_id, hospital_id, and specialty are mandatory." });
    }

    try {
      console.log("[Referral] Executing database insertion...");
      const result = await getPool().query(`
        INSERT INTO referrals (patient_name, patient_mobile, referring_doctor_id, hospital_id, specialist_name, specialty)
        VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
      `, [patient_name, patient_mobile, docId, hospId, specialist_name, specialty]);
      
      const referralId = result.rows[0].id;
      console.log("[Referral] Inserted successfully, ID:", referralId);

      // Fetch hospital name for the notification
      const hospitalRes = await getPool().query("SELECT name FROM hospitals WHERE id = $1", [hospId]);
      const hospitalName = hospitalRes.rows[0]?.name || "the hospital";

      // Send notification asynchronously
      sendWhatsAppNotification(patient_name, patient_mobile, hospitalName, specialty || "Consultation")
        .catch(err => console.error("[Referral] Async notification error:", err));

      res.json({ id: referralId });
    } catch (e: any) {
      console.error("[Referral] Database insertion error:", e);
      res.status(500).json({ 
        error: e.message, 
        detail: e.detail, 
        hint: e.hint,
        code: e.code 
      });
    }
  });

  apiRouter.patch("/referrals/:id", async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const keys = Object.keys(updates);
    const values = Object.values(updates);
    const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
    try {
      await getPool().query(`
        UPDATE referrals 
        SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
        WHERE id = $${keys.length + 1}
      `, [...values, id]);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Hospital Specializations
  apiRouter.get("/hospitals/:id/specializations", async (req, res) => {
    const { id } = req.params;
    try {
      const result = await getPool().query("SELECT * FROM hospital_specializations WHERE hospital_id = $1 ORDER BY name", [id]);
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  apiRouter.post("/hospitals/:id/specializations", async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    try {
      const result = await getPool().query(
        "INSERT INTO hospital_specializations (hospital_id, name) VALUES ($1, $2) RETURNING *",
        [id, name]
      );
      res.json(result.rows[0]);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  apiRouter.delete("/specializations/:id", async (req, res) => {
    const { id } = req.params;
    try {
      await getPool().query("DELETE FROM hospital_specializations WHERE id = $1", [id]);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Hospital Doctors
  apiRouter.get("/doctors", async (req, res) => {
    try {
      const result = await getPool().query(`
        SELECT u.id, u.name, u.specialization, u.hospital_id, h.name as hospital_name
        FROM users u
        LEFT JOIN hospitals h ON u.hospital_id = h.id
        WHERE u.role = 'DOCTOR'
        ORDER BY u.name
      `);
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  apiRouter.get("/hospitals/:id/doctors", async (req, res) => {
    const { id } = req.params;
    try {
      const doctorsResult = await getPool().query(`
        SELECT u.id, u.name, u.email, u.phone, u.role, u.hospital_id, u.qualifications, u.experience, u.profile_photo
        FROM users u
        WHERE u.hospital_id = $1 AND u.role = 'DOCTOR'
      `, [id]);
      
      const doctors = doctorsResult.rows;
      
      // Get specializations for each doctor
      for (let doctor of doctors) {
        const specsResult = await getPool().query(`
          SELECT s.id, s.name
          FROM hospital_specializations s
          JOIN doctor_specializations ds ON s.id = ds.specialization_id
          WHERE ds.user_id = $1
        `, [doctor.id]);
        doctor.specializations = specsResult.rows;
      }
      
      res.json(doctors);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  apiRouter.post("/hospitals/:id/doctors", async (req, res) => {
    const { id } = req.params;
    const { name, email, password, phone, specialization_ids, qualifications, experience, profile_photo } = req.body;
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const userResult = await client.query(`
        INSERT INTO users (name, email, password, phone, role, hospital_id, qualifications, experience, profile_photo)
        VALUES ($1, $2, $3, $4, 'DOCTOR', $5, $6, $7, $8) RETURNING id
      `, [name, email, password, phone, id, qualifications, experience, profile_photo]);
      
      const userId = userResult.rows[0].id;
      
      if (specialization_ids && Array.isArray(specialization_ids)) {
        for (let specId of specialization_ids) {
          await client.query(
            "INSERT INTO doctor_specializations (user_id, specialization_id) VALUES ($1, $2)",
            [userId, specId]
          );
        }
      }
      
      await client.query('COMMIT');
      res.json({ id: userId });
    } catch (e: any) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: e.message });
    } finally {
      client.release();
    }
  });

  apiRouter.delete("/users/:id", async (req, res) => {
    const { id } = req.params;
    try {
      await getPool().query("DELETE FROM users WHERE id = $1", [id]);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // NGOs
  apiRouter.get("/ngos", async (req, res) => {
    try {
      const result = await getPool().query("SELECT * FROM ngos");
      res.json(result.rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Stats for Admin
  apiRouter.get("/admin/stats", async (req, res) => {
    try {
      const totalReferralsRes = await getPool().query("SELECT COUNT(*) FROM referrals");
      const hospitalWise = await getPool().query(`
        SELECT h.name, COUNT(r.id) as count 
        FROM hospitals h 
        LEFT JOIN referrals r ON h.id = r.hospital_id 
        GROUP BY h.id, h.name
      `);
      const doctorWise = await getPool().query(`
        SELECT u.name, COUNT(r.id) as count 
        FROM users u 
        LEFT JOIN referrals r ON u.id = r.referring_doctor_id 
        WHERE u.role = 'DOCTOR' 
        GROUP BY u.id, u.name
      `);
      res.json({
        totalReferrals: parseInt(totalReferralsRes.rows[0].count),
        hospitalWise: hospitalWise.rows,
        doctorWise: doctorWise.rows
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Prevent SPA fallback for API routes
  app.use("/api/*", (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.originalUrl}` });
  });

  // Start DB init in background
  initDb().catch(err => console.error("Background DB Init Error:", err));

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production" && process.env.VERCEL !== '1') {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // In production (like Vercel), we serve static files from dist
    app.use(express.static(path.join(__dirname, "dist")));
  }

  // Only listen if not running as a serverless function (Vercel)
  if (process.env.VERCEL !== '1') {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }

  return app;
}

export const appPromise = startServer();
export default appPromise;
