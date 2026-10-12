const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    name: {
      type: String,
      default: "User"
    },
    role: {
      type: String,
      enum: ["citizen", "officer", "registrar", "admin"],
      default: "citizen"
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    phone: {
      type: String,
      default: ""
    },
    department: {
      type: String,
      default: "Revenue Department, Karnataka"
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("User", userSchema);
