import * as nodemailer from "npm:nodemailer@6.9.13";

export async function sendEmail({
  to,
  subject,
  html_content,
}: {
  to: string;
  subject: string;
  html_content: string;
}): Promise<any> {
  const emailAccount = Deno.env.get("ZOHO_EMAIL");
  const emailPassword = Deno.env.get("ZOHO_PASSWORD");

  if (!emailAccount || !emailPassword) {
    console.error("Missing Zoho credentials in Edge Function Secrets");
    return { success: false, error: "Missing Zoho credentials" };
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.zoho.com",
    port: 465,
    secure: true,
    auth: {
      user: emailAccount,
      pass: emailPassword,
    },
  });

  try {
    const info = await transporter.sendMail({
      from: emailAccount,
      to,
      subject,
      html: html_content,
    });
    
    console.log(`Email successfully dispatched: [${subject}] to ${to}`);
    return { success: true };
  } catch (error: any) {
    console.error("Error sending email via Shared Module:", error);
    return { success: false, error: error.message || String(error) };
  }
}

