const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    otp: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ["citizen", "officer", "registrar", "admin"],
      default: "citizen"
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: "10m" } // auto-delete after 10 minutes
    },
    verified: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("OTP", otpSchema);
