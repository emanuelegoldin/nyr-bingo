/**
 * Email Service
 * Handles sending emails via SMTP (SMTP Soho)
 * Spec Reference: 01-authentication.md - Email Verification
 */

import type { Transporter } from 'nodemailer';
import nodemailer from 'nodemailer';

// Default SMTP provider for this application
const DEFAULT_SMTP_HOST = 'smtp.soho.com';

// Email configuration from environment variables
const SMTP_HOST = process.env.SMTP_HOST || DEFAULT_SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_SECURE = process.env.SMTP_SECURE === 'true'; // Use TLS
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASSWORD = process.env.SMTP_PASSWORD || '';
const SMTP_FROM_NAME = process.env.SMTP_FROM_NAME || 'Resolution Bingo';
const SMTP_FROM_EMAIL = process.env.SMTP_FROM_EMAIL || 'noreply@resolutionbingo.com';
const APP_BASE_URL = process.env.APP_BASE_URL || 'http://localhost:9002';

// Create a reusable transporter
let transporter: Transporter | null = null;

/**
 * Get or create the email transporter
 * Lazy initialization to avoid creating the transporter if email is not needed
 */
function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASSWORD,
      },
    });
  }
  return transporter;
}

/**
 * Check if email service is configured
 * Returns true if all required SMTP settings are present
 */
export function isEmailConfigured(): boolean {
  return !!(SMTP_HOST && SMTP_USER && SMTP_PASSWORD);
}

/**
 * Send verification email to user
 * Spec: 01-authentication.md - System sends a verification email with a single-use token or link
 * 
 * @param email - Recipient email address
 * @param username - User's username for personalization
 * @param token - Verification token to include in the link
 * @returns Promise<boolean> - true if email sent successfully, false otherwise
 */
export async function sendVerificationEmail(
  email: string,
  username: string,
  token: string
): Promise<{ success: boolean; error?: string }> {
  // Check if email is configured
  if (!isEmailConfigured()) {
    console.log('[Email Service] SMTP not configured. Email will not be sent in development mode.');
    return { 
      success: false, 
      error: 'Email service not configured' 
    };
  }

  try {
    const verificationUrl = `${APP_BASE_URL}/verify?token=${token}`;
    
    const mailOptions = {
      from: `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`,
      to: email,
      subject: 'Verify Your Email - Resolution Bingo',
      text: `
Hello ${username},

Thank you for registering with Resolution Bingo!

Please verify your email address by clicking the link below:

${verificationUrl}

This link will expire in 24 hours.

If you did not create an account, please ignore this email.

Best regards,
The Resolution Bingo Team
      `.trim(),
      html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
    .content { padding: 30px 20px; background-color: #f9f9f9; }
    .button { display: inline-block; padding: 12px 30px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to Resolution Bingo!</h1>
    </div>
    <div class="content">
      <p>Hello <strong>${username}</strong>,</p>
      <p>Thank you for registering with Resolution Bingo!</p>
      <p>Please verify your email address by clicking the button below:</p>
      <p style="text-align: center;">
        <a href="${verificationUrl}" class="button">Verify Email Address</a>
      </p>
      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break: break-all;">${verificationUrl}</p>
      <p><strong>This link will expire in 24 hours.</strong></p>
      <p>If you did not create an account, please ignore this email.</p>
    </div>
    <div class="footer">
      <p>Best regards,<br>The Resolution Bingo Team</p>
    </div>
  </div>
</body>
</html>
      `.trim(),
    };

    const transporter = getTransporter();
    await transporter.sendMail(mailOptions);
    
    return { success: true };
  } catch (error) {
    console.error('[Email Service] Error sending verification email:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to send email' 
    };
  }
}
