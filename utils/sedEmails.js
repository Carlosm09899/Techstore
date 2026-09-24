const sendWelcomeEmail = async ({ email, name }) => {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': process.env.BREVO_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sender: { name: 'TechStore', email: process.env.EMAIL_FROM },
      to: [{ email, name }],
      subject: '¡Bienvenido a TechStore!',
      htmlContent: `<p>Hola ${name},</p><p>Tu cuenta de TechStore fue creada correctamente. Ya puedes iniciar sesión y disfrutar de nuestro catálogo.</p><p>¡Gracias por registrarte!</p>`
    })
  });

  if (!response.ok) {
    throw new Error(`Brevo rechazó el correo (${response.status})`);
  }
};

module.exports = { sendWelcomeEmail };