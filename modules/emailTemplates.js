function buildWelcomeEmailTemplate(data) {
  return `
  <div style="font-family: Arial, sans-serif; background: #f9fafb; padding: 20px;">
    <table width="100%" style="max-width: 600px; margin: auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
      <tr>
        <td style="background: #0a2540; padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Welcome to Tritech!</h1>
        </td>
      </tr>
      <tr>
        <td style="padding: 30px; color: #333; line-height: 1.6;">
          <p style="font-size: 18px;">Hello ${data.name || 'there'},</p>
          <p>
            🎉 We’re thrilled to have you onboard as part of the Tritech family.  
            Your account has been successfully created, and you’re now ready to explore all the powerful tools we’ve built to help your business grow.
          </p>
          <p>
            Here are some things you can do right away:
          </p>
          <ul style="padding-left: 20px;">
            <li>Log in to your dashboard to start managing clients</li>
            <li>Explore plan management and analytics</li>
            <li>Customize your settings for a smooth experience</li>
          </ul>
          <p>
            If you need help, our support team is always ready.  
            Just reply to this email or visit our <a href="https://tritechtechnologyllc.com/support" style="color:#0a2540; text-decoration:none;">support center</a>.
          </p>
          <p style="margin-top: 20px;">🚀 Let’s build something amazing together!</p>
          <p style="font-weight: bold;">— The Tritech Team</p>
        </td>
      </tr>
      <tr>
        <td style="background: #f0f0f0; text-align: center; padding: 15px; font-size: 12px; color: #888;">
          © ${new Date().getFullYear()} Tritech Technology LLC. All rights reserved.
        </td>
      </tr>
    </table>
  </div>
  `;
}

module.exports = { buildWelcomeEmailTemplate };
