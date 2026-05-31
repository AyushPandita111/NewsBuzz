import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

async function sendEmail(username, email, code, CheckUserExist) {

  console.log("sendEmail function called for:", email);

  const GMAIL_USER = process.env.GMAIL_USER;
  const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

  const transport = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: GMAIL_USER,
      pass: GMAIL_APP_PASSWORD,
    },
  });

  let mailOptions;

  if (CheckUserExist) {
    mailOptions = {
      from: `NewsBuzz <${GMAIL_USER}>`,
      to: `${email}`,
      subject: 'NewsBuzz - Forgot Password Verification Code',
      html: `<p>Dear ${username},</p>
             <p>We received a request to reset the password for your account on NewsBuzz. To proceed, please use the verification code below:</p>
             <h2>Verification Code: ${code}</h2>
             <p>If you did not request a password reset, please ignore this email. Your password will remain unchanged.</p>
             <p>Thank you for using NewsBuzz!</p>
             <p>Best regards,<br>The NewsBuzz Team</p>`,
    };
  } else {
    mailOptions = {
      from: `NewsBuzz <${GMAIL_USER}>`,
      to: `${email}`,
      subject: 'Welcome to NewsBuzz - Email Verification',
      html: `
      <p>Dear ${username},</p>
      <p>Welcome to NewsBuzz! We're excited to have you on board.</p>
      <p>To verify your email address and activate your account, please use the verification code below:</p>
      <h2>Verification Code: ${code}</h2>
      <p>If you did not sign up for NewsBuzz, please ignore this email.</p>
      <p>Thank you for joining NewsBuzz!</p>
      <p>Best regards,<br>The NewsBuzz Team</p>`,
    };
  }

  try {
    const result = await transport.sendMail(mailOptions);
    console.log("Email sent successfully:", result.response);
    return result;
  } catch (err) {
    console.error("Email sending failed:", err.message);
    // Re-throw so callers know it failed
    throw err;
  }
}

export default sendEmail;
