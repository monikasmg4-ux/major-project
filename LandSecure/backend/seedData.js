const mongoose = require("mongoose");
const crypto = require("crypto");
require("dotenv").config();

const Land = require("./models/Land");

function hash(text) {
  return "0x" + crypto.createHash("sha256").update(text).digest("hex");
}

const sampleLands = [
  {
    landId: "KA-BLR-1001",
    surveyNumber: "452/3A",
    location: "Devanahalli, Bengaluru Rural",
    district: "Bengaluru Rural",
    taluk: "Devanahalli",
    hobli: "Kasaba",
    area: 2400,
    transactionType: "Absolute Sale",
    propertyType: "Non-Agricultural / Residential",
    ownerName: "Ramesh Narayan Gowda",
    ownerId: "AADHAAR-8921-4321-1092",
    ownerEmail: "ramesh.gowda@example.com",
    status: "Registered",
    coordinates: {
      lat: 13.2483,
      lng: 77.7126,
      polygon: [
        { lat: 13.2470, lng: 77.7115 },
        { lat: 13.2470, lng: 77.7138 },
        { lat: 13.2495, lng: 77.7138 },
        { lat: 13.2495, lng: 77.7115 }
      ]
    },
    primaryDocumentHash: hash("KA-BLR-1001-SALE-DEED-2024"),
    fraudProbability: 4.2,
    mlVerdict: "GENUINE",
    fraudDetails: {
      riskScore: 4.2,
      confidence: 96.5,
      flags: [],
      factors: {
        areaAnomaly: false,
        idValid: true,
        surveyValid: true,
        locationValid: true,
        documentComplete: true,
        ocrMismatch: false
      }
    },
    blockchainHash: hash("TX-REGISTER-KA-BLR-1001"),
    blockchainDetails: {
      txHash: hash("TX-REGISTER-KA-BLR-1001"),
      blockNumber: 1419,
      documentHash: hash("KA-BLR-1001-SALE-DEED-2024"),
      recordedAt: new Date("2026-03-15")
    },
    auditTimeline: [
      {
        stage: "Submission",
        actionBy: "Ramesh Narayan Gowda",
        role: "Citizen",
        timestamp: new Date("2026-03-15T09:30:00Z"),
        notes: "Sale Deed submitted with Bhoomi RTC Extract",
        status: "Submitted"
      },
      {
        stage: "Document Verification",
        actionBy: "AI OCR Engine",
        role: "Automated System",
        timestamp: new Date("2026-03-15T09:31:00Z"),
        notes: "Area 2,400 sq.ft and Sy 452/3A matched Deed perfectly.",
        status: "Verified"
      },
      {
        stage: "Blockchain Notarization",
        actionBy: "LandRegistry Smart Contract",
        role: "Decentralized Ledger",
        timestamp: new Date("2026-03-15T09:32:00Z"),
        notes: "Anchored to Block #1419",
        status: "Immutable On-Chain"
      }
    ]
  },
  {
    landId: "KA-BLR-1002",
    surveyNumber: "108/2",
    location: "Whitefield, Bengaluru Urban",
    district: "Bengaluru Urban",
    taluk: "Bengaluru East",
    hobli: "KR Puram",
    area: 1200,
    transactionType: "Absolute Sale",
    propertyType: "Non-Agricultural / Residential",
    ownerName: "Priya Chandrashekar",
    ownerId: "AADHAAR-4491-7721-9982",
    ownerEmail: "priya.c@example.com",
    status: "Flagged for Fraud",
    coordinates: {
      lat: 12.9698,
      lng: 77.7500,
      polygon: [
        { lat: 12.9685, lng: 77.7485 },
        { lat: 12.9685, lng: 77.7515 },
        { lat: 12.9710, lng: 77.7515 },
        { lat: 12.9710, lng: 77.7485 }
      ]
    },
    primaryDocumentHash: hash("KA-BLR-1002-DISPUTED-DEED"),
    fraudProbability: 78.4,
    mlVerdict: "FRAUD",
    fraudDetails: {
      riskScore: 78.4,
      confidence: 92.1,
      flags: [
        "Document OCR detected Area mismatch (Claimed: 1,200 sq.ft, Deed: 1,500 sq.ft)",
        "Overlapping survey boundary detected with registered plot KA-BLR-0988"
      ],
      factors: {
        areaAnomaly: true,
        idValid: true,
        surveyValid: false,
        locationValid: false,
        documentComplete: true,
        ocrMismatch: true
      }
    },
    blockchainHash: hash("TX-FLAG-KA-BLR-1002"),
    blockchainDetails: {
      txHash: hash("TX-FLAG-KA-BLR-1002"),
      blockNumber: 1420,
      documentHash: hash("KA-BLR-1002-DISPUTED-DEED"),
      recordedAt: new Date("2026-04-02")
    },
    auditTimeline: [
      {
        stage: "Submission",
        actionBy: "Priya Chandrashekar",
        role: "Citizen",
        timestamp: new Date("2026-04-02T11:00:00Z"),
        notes: "Online application submitted via Kaveri Portal",
        status: "Submitted"
      },
      {
        stage: "Document Verification",
        actionBy: "AI OCR Engine",
        role: "Automated System",
        timestamp: new Date("2026-04-02T11:01:00Z"),
        notes: "Area mismatch detected: Application says 1,200 sq.ft, but uploaded document contains 1,500 sq.ft",
        status: "Mismatch Flagged"
      },
      {
        stage: "ML Risk Evaluation",
        actionBy: "LandSecure ML Engine",
        role: "AI Model",
        timestamp: new Date("2026-04-02T11:02:00Z"),
        notes: "Risk Score 78.4% (HIGH) - Flagged for Sub-Registrar Review",
        status: "FRAUD"
      }
    ]
  },
  {
    landId: "KA-MYS-1003",
    surveyNumber: "88/1B",
    location: "Vijayanagar, Mysuru",
    district: "Mysuru",
    taluk: "Mysuru Urban",
    hobli: "Kasaba",
    area: 4000,
    transactionType: "Inheritance (Pouthi Khata)",
    propertyType: "Agricultural",
    ownerName: "Anand Murthy",
    ownerId: "PAN-ABCDE1234F",
    ownerEmail: "anand.murthy@example.com",
    status: "Under Review",
    coordinates: {
      lat: 12.3364,
      lng: 76.6026,
      polygon: [
        { lat: 12.3350, lng: 76.6010 },
        { lat: 12.3350, lng: 76.6040 },
        { lat: 12.3380, lng: 76.6040 },
        { lat: 12.3380, lng: 76.6010 }
      ]
    },
    primaryDocumentHash: hash("KA-MYS-1003-GENEALOGY-TREE-2025"),
    fraudProbability: 41.5,
    mlVerdict: "SUSPICIOUS",
    fraudDetails: {
      riskScore: 41.5,
      confidence: 88.0,
      flags: [
        "Inheritance application missing registered Family Tree (Vamsha Vruksha) confirmation",
        "Field inspection pending by Revenue Inspector"
      ],
      factors: {
        areaAnomaly: false,
        idValid: true,
        surveyValid: true,
        locationValid: true,
        documentComplete: false,
        ocrMismatch: false
      }
    },
    blockchainHash: hash("TX-PENDING-KA-MYS-1003"),
    blockchainDetails: {
      txHash: hash("TX-PENDING-KA-MYS-1003"),
      blockNumber: 1421,
      documentHash: hash("KA-MYS-1003-GENEALOGY-TREE-2025"),
      recordedAt: new Date("2026-05-10")
    },
    auditTimeline: [
      {
        stage: "Submission",
        actionBy: "Anand Murthy",
        role: "Citizen",
        timestamp: new Date("2026-05-10T14:20:00Z"),
        notes: "Pouthi Khata mutation application filed with death certificate",
        status: "Submitted"
      },
      {
        stage: "Officer Inspection",
        actionBy: "Village Accountant",
        role: "Officer",
        timestamp: new Date("2026-05-10T14:25:00Z"),
        notes: "Family tree verification requested from Tahsildar office",
        status: "Under Review"
      }
    ]
  },
  {
    landId: "KA-BLR-1004",
    surveyNumber: "214/5",
    location: "Electronic City, Bengaluru",
    district: "Bengaluru Urban",
    taluk: "Anekal",
    hobli: "Attibele",
    area: 5000,
    transactionType: "Absolute Sale",
    propertyType: "Commercial",
    ownerName: "TechCorp Karnataka Pvt Ltd (Rep: Suresh Rao)",
    ownerId: "CIN-U72200KA2021PTC145",
    ownerEmail: "suresh.rao@techcorp.in",
    status: "Registered",
    coordinates: {
      lat: 12.8399,
      lng: 77.6770,
      polygon: [
        { lat: 12.8385, lng: 77.6755 },
        { lat: 12.8385, lng: 77.6785 },
        { lat: 12.8415, lng: 77.6785 },
        { lat: 12.8415, lng: 77.6755 }
      ]
    },
    primaryDocumentHash: hash("KA-BLR-1004-COMMERCIAL-CONVERSION-2024"),
    fraudProbability: 2.1,
    mlVerdict: "GENUINE",
    fraudDetails: {
      riskScore: 2.1,
      confidence: 98.2,
      flags: [],
      factors: {
        areaAnomaly: false,
        idValid: true,
        surveyValid: true,
        locationValid: true,
        documentComplete: true,
        ocrMismatch: false
      }
    },
    blockchainHash: hash("TX-REGISTER-KA-BLR-1004"),
    blockchainDetails: {
      txHash: hash("TX-REGISTER-KA-BLR-1004"),
      blockNumber: 1422,
      documentHash: hash("KA-BLR-1004-COMMERCIAL-CONVERSION-2024"),
      recordedAt: new Date("2026-06-01")
    },
    auditTimeline: [
      {
        stage: "Submission",
        actionBy: "Suresh Rao",
        role: "Authorized Signatory",
        timestamp: new Date("2026-06-01T10:00:00Z"),
        notes: "Commercial title deed & DC Conversion order submitted",
        status: "Submitted"
      },
      {
        stage: "Document Verification",
        actionBy: "AI OCR Engine",
        role: "Automated System",
        timestamp: new Date("2026-06-01T10:01:00Z"),
        notes: "DC Conversion order verified. 5,000 sq.ft extent validated.",
        status: "Verified"
      },
      {
        stage: "Blockchain Notarization",
        actionBy: "LandRegistry Smart Contract",
        role: "Decentralized Ledger",
        timestamp: new Date("2026-06-01T10:02:00Z"),
        notes: "Anchored to Block #1422",
        status: "Immutable On-Chain"
      }
    ]
  }
];

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/landsecure");
    console.log("Connected to MongoDB for seeding...");

    for (const land of sampleLands) {
      await Land.findOneAndUpdate({ landId: land.landId }, land, { upsert: true, new: true });
    }
    console.log(`✅ Upserted ${sampleLands.length} realistic Karnataka demonstration parcels with coordinates and documents!`);


    process.exit(0);
  } catch (err) {
    console.error("Seeding error:", err);
    process.exit(1);
  }
}

seed();
