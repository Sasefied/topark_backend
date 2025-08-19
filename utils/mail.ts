import nodemailer from "nodemailer";
import config from "../config";

const sendEmail = async (options: {
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; path: string }[];
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

    const { to, subject, html, attachments } = options;

    const mail = {
      from: config.SMTP_USER,
      to,
      subject,
      html,
      ...(attachments
        ? { attachments: attachments.map((attachment) => ({ filename: attachment.filename, path: attachment.path  })) }
        : {}),
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
