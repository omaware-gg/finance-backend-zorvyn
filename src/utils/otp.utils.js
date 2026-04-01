const crypto = require('crypto');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const config = require('../config/env');

const OTP_EXPIRY_MINUTES = 5;
const SALT_ROUNDS = 10;

function generateOtp() {
  const otp = String(crypto.randomInt(100000, 999999));
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
  return { otp, expiresAt };
}

function hashOtp(otp) {
  return bcrypt.hash(otp, SALT_ROUNDS);
}

function verifyOtp(plain, hashed) {
  return bcrypt.compare(plain, hashed);
}

async function sendOtpEmail(email, otp) {
  const transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
  });

  await transporter.sendMail({
    from: `"${config.otpIssuer}" <${config.smtp.user}>`,
    to: email,
    subject: 'Finance Dashboard — Your Admin Login OTP',
    text: `Your OTP is: ${otp}. It expires in ${OTP_EXPIRY_MINUTES} minutes. Do not share this.`,
  });
}

module.exports = { generateOtp, hashOtp, verifyOtp, sendOtpEmail };
