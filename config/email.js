
const nodemailer = require("nodemailer");

// For development, we can use a free testing service like Ethereal.
// For production, replace with your actual email provider's settings.
const transporter = nodemailer.createTransport({
  host: "smtp.ethereal.email",
  port: 587,
  auth: {
    user: "ethereal-user@example.com", // Replace with your Ethereal username
    pass: "your-ethereal-password",   // Replace with your Ethereal password
  },
});

module.exports = transporter;
