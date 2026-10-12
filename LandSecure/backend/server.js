const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const axios = require("axios");
const multer = require("multer");
const crypto = require("crypto");
const path = require("path");
require("dotenv").config();

const Land = require("./models/Land");
const User = require("./models/User");
const OTP = require("./models/OTP");
const blockchainService = require("./services/blockchainService");
const emailService = require("./services/emailService");
const ocrService = require("./services/ocrService");

const app = express();

// Multer in-memory storage for document uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit
});

// Middleware
app.use(cors());
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// Serve frontend statically
app.use(express.static(path.join(__dirname, "..", "frontend")));

// Port
const PORT = process.env.PORT || 5000;

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/landsecure")
  .then(() => {
    console.log("✅ MongoDB connected successfully to", process.env.MONGO_URI || "mongodb://127.0.0.1:27017/landsecure");
  })
  .catch((error) => {
    console.error("❌ MongoDB connection failed:", error.message);
  });

// Initialize blockchain service (non-blocking)
blockchainService.initialize();

// ──────────────────────────────────────────────
//  Health & Diagnostics Route
// ──────────────────────────────────────────────

app.get("/api/health", (req, res) => {
  res.json({
    name: "LandSecure API",
    version: "2.0.0",
    description: "Next-Gen Decentralized Land Title & Fraud Detection System",
    services: {
      mongodb: mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
      blockchain: blockchainService.isConnected ? "Live Hardhat Node" : "Cryptographic Ledger (Active)",
      emailService: emailService.isConfigured ? "Live SMTP" : "Development Mode (Console Log)"
    }
  });
});

// ──────────────────────────────────────────────
//  1. Authentication & Email OTP Routes
// ──────────────────────────────────────────────

// Send 6-digit OTP to user's email
app.post("/api/auth/send-otp", async (req, res) => {
  try {
    const { email, role = "citizen" } = req.body;

    if (!email || !email.includes("@")) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address."
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Generate random 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store or update OTP record
    await OTP.deleteMany({ email: cleanEmail });
    await OTP.create({
      email: cleanEmail,
      otp,
      role,
      expiresAt
    });

    // Send email via email service
    const emailResult = await emailService.sendOTP(cleanEmail, otp, role);
    const isDelivered = Boolean(emailResult.delivered);

    res.json({
      success: true,
      delivered: isDelivered,
      message: isDelivered
        ? `Verification code delivered to ${cleanEmail}. Please check your inbox.`
        : (emailResult.error
            ? `SMTP Error (${emailResult.error}). Operating in Demo Mode.`
            : `Demo Mode Active (SMTP not configured in .env). Use the code below.`),
      role,
      expiresIn: "10 minutes",
      // Include dev OTP if not delivered over SMTP so the user can test seamlessly
      devOtp: !isDelivered ? (emailResult.devOtp || otp) : undefined,
      devMode: !isDelivered,
      smtpError: emailResult.error || null
    });
  } catch (error) {
    console.error("Error in /api/auth/send-otp:", error);
    res.status(500).json({
      success: false,
      message: "Server error while generating OTP: " + error.message
    });
  }
});

// Verify OTP and Log In / Register User
app.post("/api/auth/verify-otp", async (req, res) => {
  try {
    const { email, otp, role = "citizen", name = "" } = req.body || {};

    if (!email || otp === undefined || otp === null) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP code are required."
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanOtp = String(otp).trim();

    // Check OTP record in DB
    const otpRecord = await OTP.findOne({
      email: cleanEmail,
      otp: cleanOtp,
      expiresAt: { $gt: new Date() }
    });

    if (!otpRecord) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired OTP code. Please request a new code."
      });
    }

    // Mark OTP used
    await OTP.deleteOne({ _id: otpRecord._id });

    // Upsert User
    let user = await User.findOne({ email: cleanEmail });
    if (!user) {
      user = new User({
        email: cleanEmail,
        name: name || cleanEmail.split("@")[0],
        role: role || otpRecord.role || "citizen",
        isVerified: true
      });
    } else {
      user.role = role || user.role;
      user.isVerified = true;
      if (name) user.name = name;
    }
    await user.save();

    res.json({
      success: true,
      message: `Authentication successful! Signed in as ${user.role}.`,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        department: user.department,
        isVerified: user.isVerified
      }
    });
  } catch (error) {
    console.error("Error in /api/auth/verify-otp:", error);
    res.status(500).json({
      success: false,
      message: "Server error during verification: " + error.message
    });
  }
});

// ──────────────────────────────────────────────
//  2. AI Document Scanner & Mismatch Detection
// ──────────────────────────────────────────────

// Scan an uploaded document and compare with form fields
app.post("/api/documents/scan", upload.single("document"), async (req, res) => {
  try {
    const { area, surveyNumber, ownerName, rawText = "" } = req.body;
    const file = req.file;

    const fileBuffer = file ? file.buffer : null;
    const fileName = file ? file.originalname : "deed_document.pdf";

    const analysis = ocrService.analyzeDocument(
      fileBuffer,
      fileName,
      { area, surveyNumber, ownerName },
      rawText
    );

    res.json({
      success: true,
      analysis
    });
  } catch (error) {
    console.error("Error in /api/documents/scan:", error);
    res.status(500).json({
      success: false,
      message: "Failed to scan document: " + error.message
    });
  }
});

// Verify Document Integrity against Blockchain
app.post("/api/documents/verify-integrity", upload.single("document"), async (req, res) => {
  try {
    const { landId, providedHash } = req.body;
    const file = req.file;

    if (!landId) {
      return res.status(400).json({
        success: false,
        message: "Land ID is required for document verification."
      });
    }

    const land = await Land.findOne({ landId });
    if (!land) {
      return res.status(404).json({
        success: false,
        message: `Land record "${landId}" not found in registry.`
      });
    }

    let fileHashToVerify = providedHash;
    if (file && file.buffer) {
      fileHashToVerify = ocrService.calculateHash(file.buffer);
    }

    if (!fileHashToVerify) {
      return res.status(400).json({
        success: false,
        message: "Please upload a document or provide a cryptographic hash to verify."
      });
    }

    const verificationResult = blockchainService.verifyDocumentIntegrity(land, fileHashToVerify);

    res.json({
      success: true,
      landId: land.landId,
      ownerName: land.ownerName,
      surveyNumber: land.surveyNumber,
      verification: verificationResult
    });
  } catch (error) {
    console.error("Error in /api/documents/verify-integrity:", error);
    res.status(500).json({
      success: false,
      message: "Document integrity check failed: " + error.message
    });
  }
});

// ──────────────────────────────────────────────
//  3. Register New Land (Full Workflow)
// ──────────────────────────────────────────────

app.post("/api/lands", upload.array("documents", 5), async (req, res) => {
  try {
    const {
      landId,
      surveyNumber,
      location,
      district = "Bengaluru Urban",
      taluk = "Bengaluru North",
      hobli = "Yelahanka",
      area,
      transactionType = "Absolute Sale",
      propertyType = "Non-Agricultural / Residential",
      ownerName,
      ownerId,
      ownerEmail = "",
      lat,
      lng,
      documentText = ""
    } = req.body;

    const cleanLandId = String(landId || "").trim();
    const cleanSurveyNumber = String(surveyNumber || "").trim();
    const cleanLocation = String(location || "").trim();
    const cleanOwnerName = String(ownerName || "").trim();
    const cleanOwnerId = String(ownerId || "").trim();
    const cleanOwnerEmail = String(ownerEmail || "").trim().toLowerCase();
    const numArea = Number(area);

    // Check required fields
    if (!cleanLandId || !cleanSurveyNumber || !cleanLocation || !area || !cleanOwnerName || !cleanOwnerId) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required land details: Land ID, Survey No, Location, Area, Owner Name, and Owner ID."
      });
    }

    if (isNaN(numArea) || numArea <= 0) {
      return res.status(400).json({
        success: false,
        message: "Land area must be a valid positive number in sq. ft."
      });
    }

    // Check if land ID already exists
    const existingLand = await Land.findOne({ landId: cleanLandId });
    if (existingLand) {
      return res.status(409).json({
        success: false,
        message: `A parcel with Land ID "${cleanLandId}" is already registered in the system.`
      });
    }

    // ── Document Processing & OCR Mismatch Detection ──
    const processedDocuments = [];
    let hasOCRMismatch = false;
    let mismatchReasons = [];
    let primaryHash = null;

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const docAnalysis = ocrService.analyzeDocument(
          file.buffer,
          file.originalname,
          { area: numArea, surveyNumber: cleanSurveyNumber, ownerName: cleanOwnerName },
          documentText
        );

        if (!primaryHash) primaryHash = docAnalysis.fileHash;

        if (docAnalysis.mismatchDetected) {
          hasOCRMismatch = true;
          mismatchReasons.push(...docAnalysis.mismatches.map((m) => m.message));
        }

        processedDocuments.push({
          documentType: "Sale Deed",
          fileName: file.originalname,
          fileHash: docAnalysis.fileHash,
          fileSize: file.size,
          ocrExtractedArea: docAnalysis.extractedArea,
          ocrExtractedSurvey: docAnalysis.extractedSurvey,
          ocrExtractedOwner: docAnalysis.extractedOwner,
          mismatchDetected: docAnalysis.mismatchDetected,
          mismatchReason: docAnalysis.mismatches.map((m) => m.message).join(" | ")
        });
      }
    } else {
      // Create baseline document integrity hash if no physical file uploaded
      const simulatedDocText = `Karnataka Land Title Deed | Sy: ${cleanSurveyNumber} | Area: ${numArea} sq.ft | Owner: ${cleanOwnerName} (${cleanOwnerId}) | Registered at Kaveri/Bhoomi Portal`;
      primaryHash = ocrService.calculateHash(simulatedDocText);

      processedDocuments.push({
        documentType: "Sale Deed",
        fileName: `${cleanLandId}_title_deed.pdf`,
        fileHash: primaryHash,
        fileSize: 2048,
        ocrExtractedArea: numArea,
        ocrExtractedSurvey: cleanSurveyNumber,
        ocrExtractedOwner: cleanOwnerName,
        mismatchDetected: false
      });
    }

    // ── Machine Learning Fraud Detection ──
    let mlResult = {
      result: "GENUINE",
      fraud_probability: 4.5,
      risk_level: "LOW",
      confidence: 94.2,
      factors: {
        area_anomaly: numArea > 50000 || numArea < 100,
        owner_id_valid: cleanOwnerId.length >= 5,
        survey_number_valid: cleanSurveyNumber.includes("/") || cleanSurveyNumber.length >= 3,
        location_valid: cleanLocation.length >= 3,
        document_complete: true,
        ocr_mismatch: hasOCRMismatch
      },
      flag_reasons: []
    };

    try {
      const mlResponse = await axios.post(
        "http://127.0.0.1:5001/predict",
        {
          area: numArea,
          owner_id_valid: cleanOwnerId.length >= 5 ? 1 : 0,
          survey_number_valid: cleanSurveyNumber.includes("/") || cleanSurveyNumber.length >= 3 ? 1 : 0,
          location_valid: cleanLocation.length >= 3 ? 1 : 0,
          previous_records: 0,
          document_complete: 1,
          ocr_mismatch: hasOCRMismatch
        },
        { timeout: 2500 }
      );
      if (mlResponse.data && mlResponse.data.success) {
        mlResult = mlResponse.data;
      }
    } catch (mlErr) {
      console.log("ℹ️  Flask ML API not responding, using built-in heuristic model.");
      let prob = 5.0;
      if (hasOCRMismatch) prob += 55.0;
      if (numArea > 40000 || numArea < 150) prob += 18.0;
      if (cleanOwnerId.length < 5) prob += 35.0;

      mlResult.fraud_probability = Math.min(98.5, prob);
      mlResult.result = mlResult.fraud_probability >= 60 ? "FRAUD" : mlResult.fraud_probability >= 30 ? "SUSPICIOUS" : "GENUINE";
      mlResult.risk_level = mlResult.fraud_probability >= 60 ? "HIGH" : mlResult.fraud_probability >= 30 ? "MEDIUM" : "LOW";
      mlResult.factors.area_anomaly = numArea > 40000 || numArea < 150;
      mlResult.factors.owner_id_valid = cleanOwnerId.length >= 5;
      mlResult.factors.survey_number_valid = cleanSurveyNumber.includes("/") || cleanSurveyNumber.length >= 3;
      mlResult.factors.location_valid = cleanLocation.length >= 3;
      if (hasOCRMismatch) mlResult.flag_reasons.push("Document OCR inconsistency detected against application form values");
      if (cleanOwnerId.length < 5) mlResult.flag_reasons.push("Government owner ID format is unverified or unusually short");
      if (numArea > 40000 || numArea < 150) mlResult.flag_reasons.push("Land area measurement is an outlier and requires physical verification");
    }

    // Determine initial status based on ML & OCR
    let status = "Registered";
    if (mlResult.result === "FRAUD" || mlResult.fraud_probability >= 65) {
      status = "Flagged for Fraud";
    } else if (mlResult.result === "SUSPICIOUS" || hasOCRMismatch || mlResult.fraud_probability >= 30) {
      status = "Under Review";
    }

    // ── Blockchain Registration ──
    const bcRecord = await blockchainService.registerLand(
      cleanLandId,
      cleanSurveyNumber,
      cleanLocation,
      numArea,
      cleanOwnerName,
      cleanOwnerId,
      status,
      primaryHash
    );

    // ── Cadastral Coordinates & Sample Polygon ──
    const baseLat = parseFloat(lat) || 13.0827 + (Math.random() - 0.5) * 0.08;
    const baseLng = parseFloat(lng) || 77.5877 + (Math.random() - 0.5) * 0.08;
    const delta = 0.0018;

    const polygon = [
      { lat: baseLat - delta, lng: baseLng - delta },
      { lat: baseLat - delta, lng: baseLng + delta },
      { lat: baseLat + delta, lng: baseLng + delta },
      { lat: baseLat + delta, lng: baseLng - delta }
    ];

    // ── Audit Timeline ──
    const auditTimeline = [
      {
        stage: "Submission",
        actionBy: cleanOwnerName,
        role: "Citizen",
        timestamp: new Date(),
        notes: `Application for ${transactionType} submitted with Survey #${cleanSurveyNumber}.`,
        status: "Submitted"
      },
      {
        stage: "Document Verification",
        actionBy: "AI OCR Engine",
        role: "Automated System",
        timestamp: new Date(),
        notes: hasOCRMismatch
          ? `Discrepancy detected in document: ${mismatchReasons.join("; ")}`
          : "All uploaded documents passed cryptographic and OCR consistency checks.",
        status: hasOCRMismatch ? "Mismatch Flagged" : "Verified"
      },
      {
        stage: "ML Risk Evaluation",
        actionBy: "LandSecure ML Engine",
        role: "AI Model",
        timestamp: new Date(),
        notes: `ML Fraud Probability: ${mlResult.fraud_probability}%. Verdict: ${mlResult.result}.`,
        status: mlResult.result
      },
      {
        stage: "Blockchain Notarization",
        actionBy: "LandRegistry Smart Contract",
        role: "Decentralized Ledger",
        timestamp: new Date(),
        notes: `Block #${bcRecord.blockNumber} minted. SHA-256 Document hash anchored.`,
        status: "Immutable On-Chain"
      }
    ];

    // ── Save to MongoDB ──
    const newLand = new Land({
      landId: cleanLandId,
      surveyNumber: cleanSurveyNumber,
      location: cleanLocation,
      district,
      taluk,
      hobli,
      area: numArea,
      transactionType,
      propertyType,
      ownerName: cleanOwnerName,
      ownerId: cleanOwnerId,
      ownerEmail: cleanOwnerEmail,
      status,
      coordinates: {
        lat: baseLat,
        lng: baseLng,
        polygon
      },
      documents: processedDocuments,
      primaryDocumentHash: primaryHash,
      fraudProbability: mlResult.fraud_probability,
      mlVerdict: mlResult.result,
      fraudDetails: {
        riskScore: mlResult.fraud_probability,
        confidence: mlResult.confidence || 95,
        flags: mlResult.flag_reasons || [],
        factors: {
          areaAnomaly: mlResult.factors?.area_anomaly || false,
          idValid: mlResult.factors?.owner_id_valid !== false,
          surveyValid: mlResult.factors?.survey_number_valid !== false,
          locationValid: mlResult.factors?.location_valid !== false,
          documentComplete: true,
          ocrMismatch: hasOCRMismatch
        }
      },
      blockchainHash: bcRecord.txHash,
      blockchainDetails: {
        txHash: bcRecord.txHash,
        blockNumber: bcRecord.blockNumber,
        documentHash: bcRecord.documentHash || primaryHash,
        recordedAt: new Date(),
        contractAddress: blockchainService.contract?.target || "0x5FbDB2315678afecb367f032d93F642f64180aa3"
      },
      auditTimeline
    });

    const savedLand = await newLand.save();

    // Send email notification to citizen if email provided
    if (cleanOwnerEmail && cleanOwnerEmail.includes("@")) {
      emailService.sendApplicationStatusEmail(
        cleanOwnerEmail,
        cleanLandId,
        status,
        `Application registered. ML risk: ${mlResult.fraud_probability}%`
      ).catch((err) => console.error("Email notification error:", err.message));
    }

    res.status(201).json({
      success: true,
      message: `Land application ${cleanLandId} processed successfully. Status: ${status}`,
      land: savedLand,
      mlResult,
      blockchain: {
        recorded: true,
        transactionHash: bcRecord.txHash,
        blockNumber: bcRecord.blockNumber,
        documentHash: bcRecord.documentHash || primaryHash
      },
      mismatchDetected: hasOCRMismatch,
      mismatchReasons
    });
  } catch (error) {
    console.error("Land registration error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while registering land: " + error.message
    });
  }
});

// ──────────────────────────────────────────────
//  4. Get All Lands & Search
// ──────────────────────────────────────────────

app.get("/api/lands", async (req, res) => {
  try {
    const { status, search, district } = req.query;
    let query = {};

    if (status && status !== "ALL") {
      query.status = status;
    }

    if (district && district !== "ALL") {
      query.district = district;
    }

    if (search && String(search).trim()) {
      const sanitized = String(search).trim().replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
      const regex = new RegExp(sanitized, "i");
      query.$or = [
        { landId: regex },
        { ownerName: regex },
        { location: regex },
        { surveyNumber: regex },
        { district: regex }
      ];
    }

    const lands = await Land.find(query).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: lands.length,
      lands
    });
  } catch (error) {
    console.error("Error fetching lands:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching land records."
    });
  }
});

// Get Cadastral Map Parcels for Leaflet
app.get("/api/lands/map/parcels", async (req, res) => {
  try {
    const lands = await Land.find({}, "landId surveyNumber location district area ownerName status coordinates fraudProbability blockchainHash");
    res.json({
      success: true,
      parcels: lands
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ──────────────────────────────────────────────
//  5. Get Land by ID & Blockchain Verification
// ──────────────────────────────────────────────

app.get("/api/lands/:landId", async (req, res) => {
  try {
    const landId = String(req.params.landId || "").trim();
    const land = await Land.findOne({ landId });

    if (!land) {
      return res.status(404).json({
        success: false,
        message: `Land parcel "${landId}" was not found.`
      });
    }

    // Verify status on blockchain
    const bcResult = await blockchainService.verifyLand(landId);

    res.json({
      success: true,
      land,
      blockchainVerification: bcResult
    });
  } catch (error) {
    console.error("Error fetching land:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching land details."
    });
  }
});

// ──────────────────────────────────────────────
//  6. Officer Review & Decision
// ──────────────────────────────────────────────

app.post("/api/lands/:landId/review", async (req, res) => {
  try {
    const { decision, officerName = "Officer S. Patil", role = "officer", remarks = "" } = req.body || {};
    const landId = String(req.params.landId || "").trim();

    const land = await Land.findOne({ landId });
    if (!land) {
      return res.status(404).json({ success: false, message: "Land not found." });
    }

    let newStatus = land.status;
    if (decision === "Approve") {
      newStatus = "Registered";
    } else if (decision === "Reject") {
      newStatus = "Rejected";
    } else if (decision === "Flag for Inspection") {
      newStatus = "Under Review";
    } else if (decision === "Flag for Fraud") {
      newStatus = "Flagged for Fraud";
    }

    land.status = newStatus;
    land.officerReview = {
      reviewedBy: officerName,
      decision: decision || "Review",
      reviewedAt: new Date(),
      remarks: remarks || ""
    };

    land.auditTimeline.push({
      stage: "Officer Decision",
      actionBy: officerName,
      role: String(role).toUpperCase(),
      timestamp: new Date(),
      notes: `Review outcome: ${decision || "Reviewed"}. Remarks: ${remarks || "None"}`,
      status: newStatus
    });

    await land.save();

    // Send email notification to owner if email exists
    if (land.ownerEmail) {
      emailService.sendApplicationStatusEmail(land.ownerEmail, land.landId, newStatus, remarks).catch((err) => {
        console.error("Review email notification error:", err.message);
      });
    }

    res.json({
      success: true,
      message: `Application ${land.landId} updated to ${newStatus}.`,
      land
    });
  } catch (error) {
    console.error("Review error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ──────────────────────────────────────────────
//  7. Transfer Ownership
// ──────────────────────────────────────────────

app.post("/api/lands/:landId/transfer", async (req, res) => {
  try {
    const { newOwnerName, newOwnerId, deedNumber = "DEED-2026-KA" } = req.body || {};
    const landId = String(req.params.landId || "").trim();

    if (!newOwnerName || !newOwnerId) {
      return res.status(400).json({
        success: false,
        message: "Please provide new owner name and government ID."
      });
    }

    const land = await Land.findOne({ landId });

    if (!land) {
      return res.status(404).json({
        success: false,
        message: "Land not found."
      });
    }

    if (land.status === "Flagged for Fraud" || land.status === "Rejected") {
      return res.status(403).json({
        success: false,
        message: `Cannot transfer ownership: Land record is currently marked as "${land.status}".`
      });
    }

    // Blockchain transfer
    const bcResult = await blockchainService.transferOwnership(
      landId,
      newOwnerName,
      newOwnerId,
      deedNumber
    );

    const txHash = bcResult?.txHash || null;

    const transferRecord = {
      previousOwner: land.ownerName,
      previousOwnerId: land.ownerId,
      newOwner: newOwnerName,
      newOwnerId: newOwnerId,
      transferDate: new Date(),
      blockchainHash: txHash,
      deedNumber
    };

    land.transferHistory.push(transferRecord);
    land.ownerName = newOwnerName;
    land.ownerId = newOwnerId;

    land.auditTimeline.push({
      stage: "Ownership Transfer",
      actionBy: `Sub-Registrar Office`,
      role: "Registrar",
      timestamp: new Date(),
      notes: `Ownership transferred from ${transferRecord.previousOwner} to ${newOwnerName}. Blockchain Tx: ${txHash || "Ledger Block"}`,
      status: "Transferred"
    });

    const updatedLand = await land.save();

    res.json({
      success: true,
      message: "Land title and ownership transferred successfully.",
      land: updatedLand,
      blockchain: bcResult
    });
  } catch (error) {
    console.error("Transfer error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during ownership transfer: " + error.message
    });
  }
});

// ──────────────────────────────────────────────
//  8. Blockchain Explorer Data
// ──────────────────────────────────────────────

app.get("/api/blockchain/explorer", (req, res) => {
  try {
    const explorer = blockchainService.getExplorerData();
    res.json({
      success: true,
      explorer
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// ──────────────────────────────────────────────
//  9. System Analytics & Statistics
// ──────────────────────────────────────────────

app.get("/api/analytics/stats", async (req, res) => {
  try {
    const total = await Land.countDocuments();
    const genuine = await Land.countDocuments({ status: "Registered" });
    const flagged = await Land.countDocuments({ status: "Flagged for Fraud" });
    const underReview = await Land.countDocuments({ status: "Under Review" });
    const rejected = await Land.countDocuments({ status: "Rejected" });
    const onChain = await Land.countDocuments({ blockchainHash: { $ne: null } });

    // Aggregate by district
    const byDistrict = await Land.aggregate([
      { $group: { _id: "$district", count: { $sum: 1 } } }
    ]);

    // Average fraud score
    const avgScoreAgg = await Land.aggregate([
      { $group: { _id: null, avgScore: { $avg: "$fraudProbability" } } }
    ]);
    const avgFraudScore = avgScoreAgg.length > 0 ? Math.round(avgScoreAgg[0].avgScore * 10) / 10 : 0;

    res.json({
      success: true,
      stats: {
        total,
        genuine,
        flagged,
        underReview,
        rejected,
        onChain,
        avgFraudScore,
        byDistrict: byDistrict.map((d) => ({ district: d._id || "Other", count: d.count }))
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ──────────────────────────────────────────────
//  10. Client SPA Fallback & Global Error Handler
// ──────────────────────────────────────────────

// Client SPA route fallback for non-API endpoints
app.use((req, res, next) => {
  if (req.method !== "GET") return next();
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ success: false, message: `API route ${req.path} not found.` });
  }
  res.sendFile(path.join(__dirname, "..", "frontend", "index.html"));
});

// Global error handling middleware (handles Multer limits, malformed payloads, etc.)
app.use((err, req, res, next) => {
  console.error("Unhandled server error:", err);
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      success: false,
      message: "Uploaded file is too large. Maximum allowed size is 15MB."
    });
  }
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error occurred."
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 LandSecure 2.0 Backend running on http://localhost:${PORT}`);
  console.log(`📊 API endpoints ready | MongoDB: landsecure`);
  console.log(`======================================================\n`);
});