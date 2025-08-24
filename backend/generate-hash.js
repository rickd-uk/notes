const bcrypt = require("bcrypt");
require("dotenv").config(); // Make sure to load environment variables

async function generateHash() {
  // --- Improved Security ---
  const plainPassword = "notesapp2025";

  // 1. Load configuration from environment variables
  const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 12;
  const pepper = process.env.BCRYPT_PEPPER;

  if (!pepper) {
    console.error("Error: BCRYPT_PEPPER is not set in your .env file.");
    return;
  }

  try {
    // 2. Add the pepper to the password before hashing
    const passwordWithPepper = plainPassword + pepper;

    // 3. Generate the hash with a stronger work factor
    const hash = await bcrypt.hash(passwordWithPepper, saltRounds);

    console.log("Password:", plainPassword);
    console.log("Password hash:", hash);
    console.log("Salt Rounds:", saltRounds);
  } catch (error) {
    console.error("Error generating hash:", error);
  }
}

generateHash();
