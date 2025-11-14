import bcryptjs from 'bcryptjs';
import { getAsync, runAsync, allAsync } from './db.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from './middleware.js';

export async function register(db, email, username, password, firstName, lastName, birthDate) {
  // Check if user exists
  const existingUser = await getAsync(db, 'SELECT * FROM users WHERE email = ? OR username = ?', [email, username]);
  if (existingUser) {
    return { success: false, message: 'Email or username already exists' };
  }

  // Hash password
  const passwordHash = await bcryptjs.hash(password, 10);

  // Create user
  const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  await runAsync(db,
    `INSERT INTO users (id, email, username, passwordHash, firstName, lastName, birthDate, role, approved)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, email, username, passwordHash, firstName, lastName, birthDate, 'free', 0]
  );

  return { success: true, message: 'User registered successfully' };
}

export async function login(db, email, password) {
  const user = await getAsync(db, 'SELECT * FROM users WHERE email = ?', [email]);
  
  if (!user) {
    return { success: false, message: 'Invalid email or password' };
  }

  if (user.isBanned) {
    return { success: false, message: `Your account has been banned. Reason: ${user.bannedReason || 'No reason provided'}` };
  }

  // Admin users don't need approval
  if (user.role !== 'admin' && !user.approved && (user.role === 'free' || user.role === 'plus')) {
    return { success: false, message: 'Your account is pending approval' };
  }

  const passwordMatch = await bcryptjs.compare(password, user.passwordHash);
  if (!passwordMatch) {
    return { success: false, message: 'Invalid email or password' };
  }

  const accessToken = generateAccessToken(user.id);
  const refreshToken = generateRefreshToken(user.id);

  // Save refresh token
  const sessionId = `session_${Date.now()}`;
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await runAsync(db,
    'INSERT INTO sessions (id, userId, refreshToken, expiresAt) VALUES (?, ?, ?, ?)',
    [sessionId, user.id, refreshToken, expiresAt]
  );

  return {
    success: true,
    message: 'Login successful',
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      approved: user.approved
    }
  };
}

export async function refreshAccessToken(db, refreshToken) {
  const decoded = verifyRefreshToken(refreshToken);
  if (!decoded) {
    return { success: false, message: 'Invalid refresh token' };
  }

  // Check if session exists
  const session = await getAsync(db, 'SELECT * FROM sessions WHERE userId = ? AND refreshToken = ?', [decoded.userId, refreshToken]);
  if (!session) {
    return { success: false, message: 'Session not found' };
  }

  const newAccessToken = generateAccessToken(decoded.userId);
  return { success: true, accessToken: newAccessToken };
}

export async function changePassword(db, userId, oldPassword, newPassword) {
  const user = await getAsync(db, 'SELECT * FROM users WHERE id = ?', [userId]);
  if (!user) {
    return { success: false, message: 'User not found' };
  }

  const passwordMatch = await bcryptjs.compare(oldPassword, user.passwordHash);
  if (!passwordMatch) {
    return { success: false, message: 'Current password is incorrect' };
  }

  const newPasswordHash = await bcryptjs.hash(newPassword, 10);
  await runAsync(db, 'UPDATE users SET passwordHash = ? WHERE id = ?', [newPasswordHash, userId]);

  return { success: true, message: 'Password changed successfully' };
}

export async function getCurrentUser(db, userId) {
  const user = await getAsync(db, 'SELECT * FROM users WHERE id = ?', [userId]);
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    birthDate: user.birthDate,
    role: user.role,
    approved: user.approved,
    bio: user.bio,
    location: user.location,
    phone: user.phone,
    website: user.website,
    profilePhoto: user.profilePhoto,
    socialLinks: {
      instagram: user.instagram,
      facebook: user.facebook,
      strava: user.strava
    }
  };
}

export async function updateUserProfile(db, userId, profileData) {
  const user = await getAsync(db, 'SELECT * FROM users WHERE id = ?', [userId]);
  if (!user) {
    return { success: false, message: 'User not found' };
  }

  await runAsync(db,
    `UPDATE users 
     SET firstName = ?, lastName = ?, bio = ?, location = ?, phone = ?, website = ?,
         instagram = ?, facebook = ?, strava = ?, profilePhoto = ?, updatedAt = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [
      profileData.firstName || user.firstName,
      profileData.lastName || user.lastName,
      profileData.bio || user.bio,
      profileData.location || user.location,
      profileData.phone || user.phone,
      profileData.website || user.website,
      profileData.socialLinks?.instagram || user.instagram,
      profileData.socialLinks?.facebook || user.facebook,
      profileData.socialLinks?.strava || user.strava,
      profileData.profilePhoto || user.profilePhoto,
      userId
    ]
  );

  const updatedUser = await getCurrentUser(db, userId);
  return { success: true, message: 'Profile updated successfully', user: updatedUser };
}
