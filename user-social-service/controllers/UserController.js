const User = require("../models/User");
const Follower = require("../models/Follower");
const {
  hashPassword,
  verifyPassword,
  generateToken,
} = require("../utils/auth");
const { publishUserEvent } = require("../config/kafka");
const { Sequelize, fn, col } = require("sequelize");

// --- 1. User Authentication and Management ---

exports.registerUser = async (req, res) => {
  const { username, email, password } = req.body;

  // Basic Input Validation
  if (!username || !email || !password) {
    return res.status(400).send({
      message: "Missing required fields: username, email, and password.",
    });
  }

  try {
    // 1. Hash the password securely
    const password_hash = await hashPassword(password);

    // 2. Create the user record
    const newUser = await User.create({
      username,
      email,
      password_hash,
      is_organization: req.body.is_organization || false, // Allows organization flag via request
    });

    // 3. Return the public data
    res.status(201).send({
      user_id: newUser.user_id,
      username: newUser.username,
      message: "User registered successfully.",
    });
  } catch (error) {
    // Handle unique constraint violation (409 Conflict)
    if (error instanceof Sequelize.UniqueConstraintError) {
      return res
        .status(409)
        .send({ message: "Username or email already exists." });
    }
    console.error("Registration error:", error);
    res.status(500).send({
      message: "An internal server error occurred during registration.",
    });
  }
};

exports.loginUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .send({ message: "Email and password are required." });
  }

  try {
    // 1. Find the user by email
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).send({ message: "Invalid credentials." });
    }

    // 2. Verify the password hash
    const isValid = await verifyPassword(password, user.password_hash);
    if (!isValid) {
      return res.status(401).send({ message: "Invalid credentials." });
    }

    // 3. Generate JWT Token
    const token = generateToken({
      user_id: user.user_id,
      username: user.username,
      is_organization: user.is_organization,
    });

    // 4. Successful response
    res.status(200).send({
      user_id: user.user_id,
      token: token,
    });
  } catch (error) {
    console.error("Login error:", error);
    res
      .status(500)
      .send({ message: "An internal server error occurred during login." });
  }
};

exports.getProfile = async (req, res) => {
  const { user_id } = req.params;

  try {
    // 1. Fetch the user's base data
    const user = await User.findByPk(user_id, {
      attributes: [
        "user_id",
        "username",
        "email",
        "is_organization",
        "created_at",
      ],
    });

    if (!user) {
      return res.status(404).send({ message: "User not found." });
    }

    // 2. Calculate follower counts (on-the-fly calculation for accuracy)
    const followerCount = await Follower.count({
      where: { following_id: user_id },
    });
    const followingCount = await Follower.count({
      where: { follower_id: user_id },
    });

    // 3. Combine and return the profile data
    const profile = {
      ...user.toJSON(),
      followers_count: followerCount,
      following_count: followingCount,
    };

    res.status(200).send(profile);
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).send({ message: "An internal server error occurred." });
  }
};

// --- 2. Social Connections (Follow/Unfollow) ---

exports.followUser = async (req, res) => {
  if (!req.user || !req.user.id) {
    return res.status(401).send({ message: "Authentication context missing." });
  }

  // Use the ID attached securely by the 'authenticate' middleware
  const follower_id = req.user.id;
  console.log(follower_id, "from middleware");
  const { target_user_id } = req.body;

  if (follower_id === target_user_id) {
    return res.status(400).send({ message: "Cannot follow yourself." });
  }

  try {
    const targetUser = await User.findByPk(target_user_id);
    if (!targetUser) {
      return res
        .status(404)
        .send({ message: "Target user/organization not found." });
    }

    const [follow, created] = await Follower.findOrCreate({
      where: { follower_id, following_id: target_user_id },
      defaults: { follower_id, following_id: target_user_id },
    });

    if (!created) {
      return res
        .status(409)
        .send({ message: "Already following this user/organization." });
    }

    // Publish Event to Kafka
    await publishUserEvent("user_followed", {
      followerId: follower_id,
      followingId: target_user_id,
      timestamp: new Date().toISOString(),
    });

    res
      .status(200)
      .send({ status: `Successfully followed user ${target_user_id}` });
  } catch (error) {
    console.error("Error following user:", error);
    res.status(500).send({ message: "An internal server error occurred." });
  }
};

exports.unfollowUser = async (req, res) => {
  // const follower_id = req.params.user_id;
  const follower_id = req.user.id;
  const target_user_id = req.params.target_user_id;

  try {
    const deletedCount = await Follower.destroy({
      where: {
        follower_id: follower_id,
        following_id: target_user_id,
      },
    });

    if (deletedCount === 0) {
      return res
        .status(404)
        .send({ message: "Follow relationship not found." });
    }

    // Publish Event to Kafka
    await publishUserEvent("user_unfollowed", {
      followerId: follower_id,
      followingId: target_user_id,
      timestamp: new Date().toISOString(),
    });

    res
      .status(200)
      .send({ status: `Successfully unfollowed user ${target_user_id}` });
  } catch (error) {
    console.error("Error unfollowing user:", error);
    res.status(500).send({ message: "An internal server error occurred." });
  }
};

exports.getFollowing = async (req, res) => {
  const { user_id } = req.params;

  try {
    // Query the Follower table and JOIN with the User table to get profile details of those being followed
    const following = await Follower.findAll({
      where: { follower_id: user_id },
      attributes: [], // We only want the joined User attributes
      include: [
        {
          model: User,
          as: "FollowingUser", // Assuming the association is correctly defined
          attributes: ["user_id", "username", "is_organization"],
        },
      ],
    });

    // Reformat the output for a cleaner API response
    const formattedFollowing = following.map((follow) =>
      follow.FollowingUser.toJSON()
    );

    res.status(200).send({ following: formattedFollowing });
  } catch (error) {
    console.error("Get following error:", error);
    res.status(500).send({ message: "An internal server error occurred." });
  }
};

exports.getFollowers = async (req, res) => {
  const { user_id } = req.params;

  try {
    const followers = await Follower.findAll({
      where: { following_id: user_id },
      attributes: [], // We only want the joined User attributes
      include: [
        {
          model: User,
          as: "FollowerUser",
          attributes: ["user_id", "username", "is_organization"],
        },
      ],
    });

    // Reformat the output for a cleaner API response
    const formattedFollowers = followers.map((follow) =>
      follow.FollowerUser.toJSON()
    );

    res.status(200).send({ followers: formattedFollowers });
  } catch (error) {
    console.error("Get followers error:", error);
    res.status(500).send({ message: "An internal server error occurred." });
  }
};

exports.searchUsers = async (req, res) => {
  const { query, type } = req.query;

  if (!query && !type) {
    return res
      .status(400)
      .send({ message: "Search requires a 'query' or 'type' parameter." });
  }

  const where = {};

  if (query) {
    where.username = { [Op.iLike]: `%${query}%` };
  }

  if (type) {
    const isOrg =
      type.toLowerCase() === "organization" || type.toLowerCase() === "org";
    where.is_organization = isOrg;
  }

  try {
    // 3. Execute the search query
    const users = await User.findAll({
      where: where,
      attributes: ["user_id", "username", "is_organization"],
      order: [
        ["is_organization", "DESC"],
        ["username", "ASC"],
      ],
      limit: 50,
    });

    res.status(200).send({ results: users });
  } catch (error) {
    console.error("User search error:", error);
    res.status(500).send({
      message: "An internal server error occurred during user discovery.",
    });
  }
};
