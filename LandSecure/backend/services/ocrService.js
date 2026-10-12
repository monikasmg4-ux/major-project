const crypto = require("crypto");

/**
 * LandSecure Smart Document Scanner & OCR Service
 * Calculates SHA-256 hashes, extracts deed/Pahani metadata,
 * and detects discrepancies between application form and uploaded deeds.
 */
class OCRService {
  /**
   * Calculate SHA-256 hash of a file buffer or string
   */
  calculateHash(bufferOrString) {
    const hash = crypto.createHash("sha256");
    if (Buffer.isBuffer(bufferOrString)) {
      hash.update(bufferOrString);
    } else {
      hash.update(String(bufferOrString), "utf8");
    }
    return "0x" + hash.digest("hex");
  }

  /**
   * Extract text and metadata from document text/content
   */
  extractMetadataFromText(text) {
    const cleanText = text || "";
    let extractedArea = null;
    let extractedSurvey = null;
    let extractedOwner = null;
    let documentDate = null;

    // 1. Extract Area (sq. ft. or acres/guntas)
    // Matches e.g. "1500 sq ft", "1,200 sq.ft", "Area: 1200", "Total extent: 2400 sqft"
    const sqftMatch = cleanText.match(/(\d{1,2},?\d{3}|\d{3,6})\s*(sq\.?\s*ft|sqft|square feet|sq\s*feet)/i);
    if (sqftMatch) {
      extractedArea = parseInt(sqftMatch[1].replace(/,/g, ""), 10);
    } else {
      // Check for explicit "Area: 1200" or "Extent: 1500"
      const areaMatch = cleanText.match(/(?:area|extent|measurement)\s*[:=-]?\s*(\d{3,6})/i);
      if (areaMatch) {
        extractedArea = parseInt(areaMatch[1], 10);
      }
    }

    // 2. Extract Survey Number
    // Matches e.g. "Survey No. 452/3", "Sy No: 104/1A", "Survey Number: 452/3"
    const surveyMatch = cleanText.match(/(?:survey\s*(?:no\.?|number)|sy\s*no\.?)\s*[:=-]?\s*([0-9]{1,4}(?:[\/\-][0-9]{1,3}[A-Za-z]?)?)/i);
    if (surveyMatch) {
      extractedSurvey = surveyMatch[1].trim();
    } else {
      // General fraction pattern e.g. 452/3
      const generalSurvey = cleanText.match(/\b([0-9]{1,4}\/[0-9]{1,3}[A-Za-z]?)\b/);
      if (generalSurvey) {
        extractedSurvey = generalSurvey[1].trim();
      }
    }

    // 3. Extract Owner Name
    // Matches e.g. "Owner: Ramesh Kumar", "Purchaser: Ravi Kumar", "In favour of: Suresh Gowda"
    const ownerMatch = cleanText.match(/(?:owner|purchaser|buyer|in\s*favour\s*of|name)\s*[:=-]?\s*([A-Za-z\s.]{3,35})(?:\n|,|;|\.|$)/i);
    if (ownerMatch) {
      extractedOwner = ownerMatch[1].trim();
    }

    // 4. Extract Date
    const dateMatch = cleanText.match(/(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/);
    if (dateMatch) {
      documentDate = dateMatch[1];
    }

    return {
      extractedArea,
      extractedSurvey,
      extractedOwner,
      documentDate
    };
  }

  /**
   * Scan document content (or simulated sample) and compare with application inputs
   * Detects mismatches like:
   * Application says 1,200 sq.ft, but document contains 1,500 sq.ft
   */
  analyzeDocument(fileBuffer, originalFileName, applicationData, rawText = "") {
    const fileHash = this.calculateHash(fileBuffer || originalFileName || Date.now().toString());

    // Extract text from rawText or filename hints
    let textToAnalyze = rawText;
    if (!textToAnalyze && fileBuffer) {
      try {
        textToAnalyze = fileBuffer.toString("utf8");
      } catch (e) {
        textToAnalyze = "";
      }
    }

    const extracted = this.extractMetadataFromText(textToAnalyze);

    const mismatches = [];
    const flags = [];

    // Compare Area
    const claimedArea = Number(applicationData.area);
    if (extracted.extractedArea && claimedArea) {
      const areaDiff = Math.abs(extracted.extractedArea - claimedArea);
      if (areaDiff > 5) { // more than 5 sq.ft tolerance
        mismatches.push({
          field: "area",
          claimed: `${claimedArea} sq.ft`,
          extracted: `${extracted.extractedArea} sq.ft`,
          message: `Area mismatch: Application states ${claimedArea} sq.ft, but uploaded document records ${extracted.extractedArea} sq.ft (Discrepancy: ${areaDiff} sq.ft).`
        });
        flags.push("AREA_MISMATCH");
      }
    }

    // Compare Survey Number
    const claimedSurvey = (applicationData.surveyNumber || "").trim().toLowerCase();
    if (extracted.extractedSurvey && claimedSurvey) {
      const docSurvey = extracted.extractedSurvey.toLowerCase();
      if (docSurvey !== claimedSurvey && !docSurvey.includes(claimedSurvey) && !claimedSurvey.includes(docSurvey)) {
        mismatches.push({
          field: "surveyNumber",
          claimed: applicationData.surveyNumber,
          extracted: extracted.extractedSurvey,
          message: `Survey Number mismatch: Application states "${applicationData.surveyNumber}", but document references "${extracted.extractedSurvey}".`
        });
        flags.push("SURVEY_MISMATCH");
      }
    }

    // Compare Owner Name
    const claimedOwner = (applicationData.ownerName || "").trim().toLowerCase();
    if (extracted.extractedOwner && claimedOwner) {
      const docOwner = extracted.extractedOwner.toLowerCase();
      // Simple token overlap check
      const claimedTokens = claimedOwner.split(/\s+/);
      const matchFound = claimedTokens.some((t) => t.length > 2 && docOwner.includes(t));
      if (!matchFound && docOwner.length > 3) {
        mismatches.push({
          field: "ownerName",
          claimed: applicationData.ownerName,
          extracted: extracted.extractedOwner,
          message: `Owner Name discrepancy: Application lists "${applicationData.ownerName}", but deed highlights "${extracted.extractedOwner}".`
        });
        flags.push("OWNER_NAME_DISCREPANCY");
      }
    }

    const mismatchDetected = mismatches.length > 0;

    return {
      fileName: originalFileName,
      fileHash,
      fileSize: fileBuffer ? fileBuffer.length : 1024,
      extractedArea: extracted.extractedArea,
      extractedSurvey: extracted.extractedSurvey,
      extractedOwner: extracted.extractedOwner,
      mismatchDetected,
      mismatches,
      flags,
      summary: mismatchDetected
        ? `⚠️ Mismatch Detected: ${mismatches.map((m) => m.message).join(" ")}`
        : "✅ Document details match application inputs consistently."
    };
  }
}

module.exports = new OCRService();
