const nodemailer = require("nodemailer")
const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD } = require("../config")

const sendEmail = async (options) => {
  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASSWORD,
      },
    })

    const { to, subject, html } = options

    const mail = {
      from: SMTP_USER,
      to,
      subject,
      html,
    }

    await transporter.sendMail(mail)
    console.log("Email sent")
    return true
  } catch (error) {
    console.log("Error sending email", error)
    return false
  }
}

module.exports = sendEmail
