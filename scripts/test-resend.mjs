import { Resend } from 'resend';

const apiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.RESEND_FROM_EMAIL || 'B2B LINK <notifications@brandnova.info>';
const toEmail = 'huzaifa.webdesigner@gmail.com';

console.log('--- Resend Email Dispatch Test ---');
console.log('Target recipient:', toEmail);
console.log('Configured sender:', fromEmail);
console.log('API Key detected:', apiKey ? `Yes (${apiKey.substring(0, 10)}...)` : 'NO');

if (!apiKey) {
  console.error('ERROR: RESEND_API_KEY is not defined in environment!');
  process.exit(1);
}

const resend = new Resend(apiKey);

async function main() {
  try {
    const response = await resend.emails.send({
      from: fromEmail,
      to: [toEmail],
      subject: '✅ B2B LINK - Resend API Key Test Verification',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>B2B LINK Verification</title>
        </head>
        <body style="margin: 0; padding: 40px 16px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
            <div style="background-color: #0f172a; padding: 24px 32px; border-bottom: 3px solid #2563eb;">
              <span style="font-size: 20px; font-weight: 700; color: #ffffff; text-transform: uppercase;">
                B2B <span style="color: #3b82f6;">LINK</span>
              </span>
              <div style="font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 4px;">Wholesale Platform Integration</div>
            </div>
            <div style="padding: 32px;">
              <div style="display: inline-block; background-color: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 9999px; text-transform: uppercase; margin-bottom: 16px;">
                Verified Active
              </div>
              <h2 style="font-size: 22px; font-weight: 700; color: #0f172a; margin: 0 0 12px 0;">Resend API Key Test Successful 🎉</h2>
              <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 20px 0;">
                Your Resend API key and sender configuration are active and successfully delivering emails for the <strong>B2B LINK Wholesale Platform</strong>.
              </p>
              
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin-bottom: 24px;">
                <table style="width: 100%; font-size: 13px; color: #334155;">
                  <tr>
                    <td style="padding: 4px 0; color: #64748b; width: 110px;">Recipient:</td>
                    <td style="padding: 4px 0; font-weight: 600; color: #0f172a;">${toEmail}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 0; color: #64748b;">Sender:</td>
                    <td style="padding: 4px 0; color: #2563eb;">${fromEmail}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 0; color: #64748b;">Delivered At:</td>
                    <td style="padding: 4px 0;">${new Date().toUTCString()}</td>
                  </tr>
                </table>
              </div>

              <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin: 0;">
                The platform is ready to dispatch:
                <br />• Product Inquiry alerts to sellers
                <br />• WTB Niche & Exact Barcode match notifications
                <br />• Quotation receipts to buyers
                <br />• Seller vetting decisions
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (response.error) {
      console.error('\n❌ RESEND DISPATCH ERROR:');
      console.error(JSON.stringify(response.error, null, 2));
      process.exit(1);
    }

    console.log('\n✅ EMAIL DISPATCHED SUCCESSFULLY!');
    console.log('Message ID:', response.data?.id);
    console.log('Full Response:', JSON.stringify(response.data, null, 2));
  } catch (err) {
    console.error('\n❌ UNEXPECTED EXCEPTION:', err);
    process.exit(1);
  }
}

main();
