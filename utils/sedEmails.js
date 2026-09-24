const sendVerificationEmail = async ({ email, name, token }) => {
  const verificationUrl = `${process.env.API_URL || 'http://localhost:3000'}/api/auth/verify-email/${token}`;
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sender: { name: 'TechStore', email: process.env.EMAIL_FROM },
      to: [{ email, name }],
      subject: 'Verifica tu cuenta de TechStore',
      htmlContent: `<p>Hola ${name},</p><p>Gracias por crear tu cuenta. Confirma tu correo haciendo clic en el siguiente enlace:</p><p><a href="${verificationUrl}">Verificar mi correo</a></p>`
    })
  });

  if (!response.ok) {
    const errorDetails = await response.text();
    console.error('Brevo rechazó el correo:', response.status, errorDetails);
    throw new Error(`Brevo rechazó el correo (${response.status})`);
  }
};

module.exports = { sendVerificationEmail };