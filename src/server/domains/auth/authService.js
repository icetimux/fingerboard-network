import bcrypt from 'bcryptjs';
import { Resend } from 'resend';
import {
  findUserByUsername,
  findUserByEmail,
  findUserById,
  createUser,
  updatePassword,
  createResetToken,
  findResetToken,
  consumeResetToken,
} from './authRepository.js';

let _resend = null;
function getResend() {
  if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set. Password reset emails are unavailable.');
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY);
  return _resend;
}
const FROM_EMAIL = process.env.RESEND_FROM || 'noreply@fingerboard.network';
const SITE_URL = process.env.SITE_URL || 'http://localhost:3000';

const SALT_ROUNDS = 12;

export async function register(username, email, password) {
  if (!username || !email || !password) throw new Error('All fields are required.');
  if (username.length < 3) throw new Error('Username must be at least 3 characters.');
  if (password.length < 6) throw new Error('Password must be at least 6 characters.');
  if (!/^[a-zA-Z0-9_.\-]+$/.test(username))
    throw new Error('Username may only contain letters, numbers, underscores, hyphens, and dots.');

  if (await findUserByUsername(username)) throw new Error('That username is already taken.');
  if (await findUserByEmail(email)) throw new Error('An account with that email already exists.');

  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  const id = await createUser(username, email, hash);
  return { id, username };
}

export async function login(username, password) {
  const user = await findUserByUsername(username);
  if (!user) throw new Error('Invalid username or password.');
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) throw new Error('Invalid username or password.');
  return { id: user.id, username: user.username };
}

export async function requestPasswordReset(username, email) {
  const user = await findUserByUsername(username);
  // Same error for both mismatch cases — prevents revealing whether a username exists
  if (!user || user.email.toLowerCase() !== email.toLowerCase()) {
    throw new Error('No account found with that username and email combination.');
  }
  const token = await createResetToken(user.id);
  const { error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to: user.email,
    subject: 'Fingerboard Network — Password Reset',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="margin-bottom:8px">Password Reset</h2>
        <p>Hi <strong>${user.username}</strong>,</p>
        <p>Someone requested a password reset for your Fingerboard Network account.</p>
        <p>Your reset token is:</p>
        <p style="font-family:monospace;font-size:18px;background:#f4f4f8;padding:12px 16px;border-radius:8px;letter-spacing:2px">${token}</p>
        <p>Enter this token on the reset password page along with your new password. It expires in <strong>1 hour</strong>.</p>
        <p>If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });
  if (error) {
    console.error('[Resend] Failed to send reset email:', error);
    throw new Error('Failed to send reset email. Please try again later.');
  }
}

export async function resetPassword(username, token, newPassword) {
  if (newPassword.length < 6) throw new Error('Password must be at least 6 characters.');
  const user = await findUserByUsername(username);
  if (!user) throw new Error('Invalid reset request.');
  const tokenRow = await findResetToken(token);
  if (!tokenRow || tokenRow.user_id !== user.id) throw new Error('Invalid or expired reset token.');
  if (Date.now() > tokenRow.expires_at) throw new Error('This reset token has expired. Please request a new one.');
  const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await updatePassword(user.id, hash);
  await consumeResetToken(tokenRow.id);
}

export async function changePassword(userId, currentPassword, newPassword) {
  if (newPassword.length < 6) throw new Error('Password must be at least 6 characters.');
  const user = await findUserById(userId);
  if (!user) throw new Error('User not found.');
  const match = await bcrypt.compare(currentPassword, user.password_hash);
  if (!match) throw new Error('Current password is incorrect.');
  const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await updatePassword(userId, hash);
}
