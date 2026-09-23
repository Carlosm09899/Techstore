export const sendVerificationEmail = async ({ email, name, token, clientUrl }) => {
  const url = `${clientUrl}/verificar-correo?token=${token}`;
  
  await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sender: { name: 'TechStore', email: process.env.EMAIL_FROM },
      to: [{ email, name }],
      subject: 'Verifica tu cuenta - TechStore',
      htmlContent: `<p>Hola ${name}, activa tu cuenta dando clic en el siguiente enlace:</p><a href="${url}">Verificar Correo</a>`
    })
  });
};