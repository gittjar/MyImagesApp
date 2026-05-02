#!/usr/bin/env node
/**
 * One-time admin creation script.
 * Usage: node scripts/createAdmin.js
 *
 * - Refuses to run if an admin already exists.
 * - This file is safe to keep in the repo — it contains no secrets.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const readline = require('readline');
const User = require('../src/models/User');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((res) => rl.question(q, res));

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB.\n');

  const existingAdmin = await User.findOne({ role: 'admin' });
  if (existingAdmin) {
    console.log(`Admin already exists: ${existingAdmin.email}`);
    console.log('To change admin, update the role directly in MongoDB Atlas.');
    process.exit(0);
  }

  console.log('No admin found. Creating one now.\n');

  const name = await ask('Name: ');
  const email = (await ask('Email: ')).trim().toLowerCase();
  const password = await ask('Password (min 6 chars): ');
  rl.close();

  if (!name || !email || password.length < 6) {
    console.error('Invalid input. Aborting.');
    process.exit(1);
  }

  const existing = await User.findOne({ email });
  if (existing) {
    // Promote existing user to admin
    existing.role = 'admin';
    if (!existing.name) existing.name = name;
    await existing.save();
    console.log(`\nExisting user promoted to admin: ${email}`);
  } else {
    await User.create({ name, email, password, role: 'admin' });
    console.log(`\nAdmin account created: ${email}`);
  }

  console.log('Done. You can now log in with these credentials.');
  process.exit(0);
};

run().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
