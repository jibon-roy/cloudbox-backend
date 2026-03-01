export const resetPasswordEmail = (token: string, resetUrl?: string) => {
  const link = resetUrl
    ? `${resetUrl}${resetUrl.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`
    : null;

  return `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <h2>Password reset requested</h2>
      <p>You requested to reset your password. Use the token below or click the link to reset it.</p>
      <p style="font-size: 18px; font-weight: bold;">${token}</p>
      ${link ? `<p><a href="${link}">Reset password</a></p>` : ""}
      <p>If you didn't request this, ignore this email.</p>
    </div>
  `;
};

export default resetPasswordEmail;
