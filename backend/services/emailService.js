const { Resend } = require('resend');

// Inicializar Resend sin crashear el servidor si falta la llave (solo fallará al enviar)
const resend = new Resend(process.env.RESEND_API_KEY || 're_missing_key');

// Sin dominio verificado: usar onboarding@resend.dev (solo entrega al email de tu cuenta Resend).
// Con dominio verificado: configurar RESEND_FROM_EMAIL=Threshold <noreply@tudominio.com>
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

/**
 * Envía un correo de recuperación de contraseña con un código OTP de 6 dígitos.
 * @param {string} toEmail - Dirección de correo destino
 * @param {string} code - Código OTP de 6 dígitos
 * @param {string} name - Nombre del usuario (para personalizar el email)
 */
async function sendPasswordResetEmail(toEmail, code, name = 'estudiante') {
  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: toEmail,
    subject: 'Código de verificación — Threshold',
    html: `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recuperar contraseña</title>
</head>
<body style="margin:0;padding:0;background:#F4F4F4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F4F4;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#1A1A1A;border-radius:16px;overflow:hidden;max-width:520px;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1A1A1A 0%,#2D2620 100%);padding:40px 40px 32px;text-align:center;border-bottom:1px solid rgba(197,160,89,0.2);">
              <p style="margin:0 0 8px;font-size:13px;letter-spacing:4px;text-transform:uppercase;color:#C5A059;font-weight:600;">THRESHOLD</p>
              <h1 style="margin:0;font-size:24px;font-weight:700;color:#FFFFFF;">Recupera tu contraseña</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <p style="margin:0 0 16px;font-size:16px;color:#D0D0D0;line-height:1.6;">
                Hola, <strong style="color:#FFFFFF;">${name}</strong>.<br>
                Recibimos una solicitud para restablecer la contraseña de tu cuenta de Threshold.
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#A0A0A0;line-height:1.6;">
                Usa el siguiente código de verificación en la app. <strong style="color:#D0D0D0;">Expira en 15 minutos.</strong>
              </p>

              <!-- OTP Code -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 32px;">
                <tr>
                  <td align="center">
                    <div style="display:inline-block;background:linear-gradient(135deg,#2A2117,#1A1A1A);border:1.5px solid #C5A059;border-radius:12px;padding:24px 48px;">
                      <p style="margin:0;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#C5A059;margin-bottom:10px;font-weight:600;">Código de verificación</p>
                      <p style="margin:0;font-size:48px;font-weight:800;letter-spacing:12px;color:#FFFFFF;font-family:'Courier New',Courier,monospace;">${code}</p>
                    </div>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;font-size:14px;color:#707070;line-height:1.6;">
                Si no solicitaste este cambio, puedes ignorar este correo de manera segura. Tu contraseña no será modificada.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#111111;padding:24px 40px;border-top:1px solid #2A2A2A;text-align:center;">
              <p style="margin:0;font-size:12px;color:#505050;">
                © 2026 Threshold Inc. · Todos los derechos reservados
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
  });

  if (error) {
    console.error('[EmailService] Error enviando email de reset:', error);
    throw new Error(`Error de email: ${error.message}`);
  }

  console.log(`[EmailService] ✅ Email de reset enviado a ${toEmail} (id: ${data?.id})`);
  return data;
}

module.exports = { sendPasswordResetEmail };
