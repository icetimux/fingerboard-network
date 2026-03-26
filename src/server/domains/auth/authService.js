import bcrypt from 'bcryptjs';
import {
  findUserByUsername,
  findUserByEmail,
  findUserById,
  createUser,
  updatePassword,
} from './authRepository.js';

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

export async function resetPasswordDirect(username, email, newPassword) {
  if (newPassword.length < 6) throw new Error('Password must be at least 6 characters.');
  const user = await findUserByUsername(username);
  // Same error for both mismatch cases — prevents revealing whether a username exists
  if (!user || user.email.toLowerCase() !== email.toLowerCase()) {
    throw new Error('No account found with that username and email combination.');
  }
  const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await updatePassword(user.id, hash);
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
