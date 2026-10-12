const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema({
  documentType: {
    type: String,
    enum: ["Sale Deed", "RTC / Pahani", "Survey Sketch / Akarband", "Encumbrance Certificate (EC)", "Identity Proof", "Other"],
    required: true
  },
  fileName: String,
  fileHash: {
    type: String,
    required: true // SHA-256 hash of the uploaded document
  },
  fileSize: Number,
  ocrExtractedArea: Number,
  ocrExtractedSurvey: String,
  ocrExtractedOwner: String,
  mismatchDetected: {
    type: Boolean,
    default: false
  },
  mismatchReason: String,
  uploadedAt: {
    type: Date,
    default: Date.now
  }
});

const historySchema = new mongoose.Schema({
  stage: String,
  actionBy: String,
  role: String,
  timestamp: {
    type: Date,
    default: Date.now
  },
  notes: String,
  status: String
});

const landSchema = new mongoose.Schema(
  {
    landId: {
      type: String,
      required: true,
      unique: true
    },

    surveyNumber: {
      type: String,
      required: true
    },

    location: {
      type: String,
      required: true
    },

    district: {
      type: String,
      default: "Bengaluru Urban"
    },

    taluk: {
      type: String,
      default: "Bengaluru North"
    },

    hobli: {
      type: String,
      default: "Yelahanka"
    },

    area: {
      type: Number,
      required: true // Area in sq. ft.
    },

    areaInAcres: {
      type: String,
      default: ""
    },

    transactionType: {
      type: String,
      enum: ["Absolute Sale", "Gift Deed", "Inheritance (Pouthi Khata)", "Partition Deed"],
      default: "Absolute Sale"
    },

    propertyType: {
      type: String,
      enum: ["Agricultural", "Non-Agricultural / Residential", "Commercial"],
      default: "Non-Agricultural / Residential"
    },

    ownerName: {
      type: String,
      required: true
    },

    ownerId: {
      type: String,
      required: true
    },

    ownerEmail: {
      type: String,
      default: ""
    },

    status: {
      type: String,
      default: "Registered",
      enum: ["Registered", "Flagged for Fraud", "Under Review", "Pending Verification", "Rejected"]
    },

    // Geo Coordinates for Cadastral Map
    coordinates: {
      lat: { type: Number, default: 13.0827 },
      lng: { type: Number, default: 77.5877 },
      polygon: [
        {
          lat: Number,
          lng: Number
        }
      ]
    },

    // Uploaded Documents and Integrity Hashes
    documents: [documentSchema],

    // Primary Document Integrity Hash
    primaryDocumentHash: {
      type: String,
      default: null
    },

    // ML fraud detection results
    fraudProbability: {
      type: Number,
      default: 0
    },

    mlVerdict: {
      type: String,
      default: "GENUINE",
      enum: ["GENUINE", "FRAUD", "SUSPICIOUS"]
    },

    fraudDetails: {
      riskScore: { type: Number, default: 0 },
      confidence: { type: Number, default: 95 },
      flags: [String],
      factors: {
        areaAnomaly: { type: Boolean, default: false },
        idValid: { type: Boolean, default: true },
        surveyValid: { type: Boolean, default: true },
        locationValid: { type: Boolean, default: true },
        documentComplete: { type: Boolean, default: true },
        ocrMismatch: { type: Boolean, default: false }
      }
    },

    // Blockchain integration
    blockchainHash: {
      type: String,
      default: null
    },

    blockchainDetails: {
      txHash: String,
      blockNumber: Number,
      documentHash: String,
      recordedAt: Date,
      contractAddress: String
    },

    // Ownership transfer history
    transferHistory: [
      {
        previousOwner: String,
        previousOwnerId: String,
        newOwner: String,
        newOwnerId: String,
        transferDate: {
          type: Date,
          default: Date.now
        },
        blockchainHash: String,
        deedNumber: String
      }
    ],

    // Workflow audit timeline
    auditTimeline: [historySchema],

    // Officer Review metadata
    officerReview: {
      reviewedBy: String,
      decision: String,
      reviewedAt: Date,
      remarks: String
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Land", landSchema);