import nodemailer from "nodemailer";
import config from "../config";

const sendEmail = async (options: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> => {
  try {
    const transporter = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      auth: {
        user: config.SMTP_USER,
        pass: config.SMTP_PASSWORD,
      },
    });

    const { to, subject, html } = options;

    const mail = {
      from: config.SMTP_USER,
      to,
      subject,
      html,
    };

    await transporter.sendMail(mail);
    console.log("Email sent");
    return true;
  } catch (error) {
    console.log("Error sending email", error);
    return false;
  }
};

export default sendEmail;
