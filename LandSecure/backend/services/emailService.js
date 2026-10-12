const nodemailer = require("nodemailer");

/**
 * LandSecure Email & OTP Service
 * Sends verification OTPs via Nodemailer.
 * Falls back gracefully to Dev Mode if SMTP credentials are not configured.
 */
class EmailService {
  constructor() {
    this.transporter = null;
    this.isConfigured = false;
    this.init();
  }

  init() {
    const { SMTP_HOST, SMTP_PORT, EMAIL_USER, EMAIL_PASS, SMTP_SERVICE } = process.env;

    if (EMAIL_USER && EMAIL_PASS) {
      const config = {
        auth: {
          user: EMAIL_USER,
          pass: EMAIL_PASS
        }
      };

      if (SMTP_SERVICE) {
        config.service = SMTP_SERVICE;
      } else if (EMAIL_USER.endsWith("@gmail.com")) {
        config.service = "gmail";
      } else {
        config.host = SMTP_HOST || "smtp.gmail.com";
        config.port = parseInt(SMTP_PORT || "587");
        config.secure = parseInt(SMTP_PORT || "587") === 465;
      }

      this.transporter = nodemailer.createTransport(config);
      this.isConfigured = true;
      console.log(`📧 Email Service: Configured for ${EMAIL_USER}`);
    } else {
      console.log("ℹ️  Email Service: No SMTP credentials in .env. Running in DEV mode (OTPs logged to console).");
      this.isConfigured = false;
    }
  }

  /**
   * Send 6-digit verification OTP to user's email
   */
  async sendOTP(email, otp, role = "citizen") {
    const subject = `[LandSecure] Your Verification Code: ${otp}`;
    const roleTitle = role.charAt(0).toUpperCase() + role.slice(1);

    const htmlContent = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 580px; margin: 0 auto; background: #0b1120; color: #f1f5f9; border-radius: 12px; overflow: hidden; border: 1px solid #1e293b;">
        <div style="background: linear-gradient(135deg, #0ea5e9, #6366f1); padding: 24px; text-align: center;">
          <h1 style="margin: 0; color: #ffffff; font-size: 24px; letter-spacing: 0.5px;">🔒 LandSecure Portal</h1>
          <p style="margin: 6px 0 0 0; color: #e0f2fe; font-size: 13px;">Government of Karnataka — Land Title & Verification Service</p>
        </div>
        <div style="padding: 32px 28px; background: #0f172a;">
          <h2 style="color: #f8fafc; font-size: 18px; margin-top: 0;">One-Time Password (OTP) Verification</h2>
          <p style="color: #94a3b8; font-size: 14px; line-height: 1.6;">
            A sign-in or authorization request was initiated for your <strong>${roleTitle}</strong> account associated with <strong>${email}</strong>.
          </p>
          <div style="margin: 28px 0; text-align: center;">
            <div style="display: inline-block; background: #1e293b; border: 2px dashed #38bdf8; border-radius: 10px; padding: 14px 32px;">
              <span style="font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #38bdf8; font-family: monospace;">${otp}</span>
            </div>
            <p style="color: #64748b; font-size: 12px; margin-top: 10px;">Valid for 10 minutes. Do not share this code with anyone.</p>
          </div>
          <div style="background: #1e293b; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 6px; margin-top: 24px;">
            <p style="margin: 0; color: #cbd5e1; font-size: 12px;">
              <strong>Security Notice:</strong> LandSecure officials will never ask you for your OTP over phone or email. If you did not request this, please disregard this email.
            </p>
          </div>
        </div>
        <div style="background: #0b1120; padding: 16px; text-align: center; border-top: 1px solid #1e293b;">
          <p style="margin: 0; color: #64748b; font-size: 11px;">
            &copy; 2026 LandSecure Portal &bull; Department of Stamps and Registration &bull; Bengaluru, Karnataka
          </p>
        </div>
      </div>
    `;

    // Console output for easy review & testing
    console.log("\n╔══════════════════════════════════════════════════════════╗");
    console.log(`║ 📧 LANDSECURE EMAIL OTP                                   ║`);
    console.log(`║ To:   ${email.padEnd(50)} ║`);
    console.log(`║ Role: ${role.padEnd(50)} ║`);
    console.log(`║ OTP:  ${otp.padEnd(50)} ║`);
    console.log(`║ Expiry: 10 minutes                                       ║`);
    console.log("╚══════════════════════════════════════════════════════════╝\n");

    if (this.isConfigured && this.transporter) {
      try {
        const info = await this.transporter.sendMail({
          from: `"LandSecure Karnataka" <${process.env.EMAIL_USER}>`,
          to: email,
          subject,
          html: htmlContent
        });
        console.log(`✅ Email sent successfully to ${email}. MessageId: ${info.messageId}`);
        return { success: true, delivered: true, messageId: info.messageId };
      } catch (err) {
        console.error("❌ Failed to send email via SMTP:", err.message);
        return {
          success: true,
          delivered: false,
          devFallback: true,
          devOtp: otp,
          error: err.message,
          note: `SMTP delivery failed (${err.message}); demo code provided.`
        };
      }
    }

    // Dev mode fallback
    return {
      success: true,
      delivered: false,
      devFallback: true,
      devOtp: otp,
      note: "SMTP not configured in .env. OTP logged to backend console."
    };
  }

  /**
   * Send Application Status Notification Email
   */
  async sendApplicationStatusEmail(email, landId, status, remarks = "") {
    if (!this.isConfigured || !this.transporter) {
      console.log(`ℹ️ [Notification] Application ${landId} status changed to ${status} for ${email}`);
      return;
    }

    try {
      await this.transporter.sendMail({
        from: `"LandSecure Notifications" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `[LandSecure] Application ${landId} Status Update: ${status}`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; background: #0f172a; color: #f8fafc; border-radius: 8px;">
            <h2 style="color: #38bdf8;">Application Update: ${landId}</h2>
            <p>Your land registration application status is now: <strong style="color: #10b981;">${status}</strong>.</p>
            ${remarks ? `<p>Officer Remarks: <em>${remarks}</em></p>` : ""}
            <p>You can verify this record on the LandSecure portal anytime.</p>
          </div>
        `
      });
    } catch (e) {
      console.error("Error sending status notification:", e.message);
    }
  }
}

module.exports = new EmailService();
