const { db } = require('../db');

/**
 * Genera un PIN alfanumérico seguro (sin O/0, I/1)
 * @returns {string} PIN de 6 caracteres
 */
const generateSharePin = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let pin = '';
  for (let i = 0; i < 6; i++) {
    pin += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pin;
};

/**
 * Obtiene un PIN único garantizando que no haya colisiones en la base de datos
 * @returns {Promise<string>} PIN único
 */
const getUniqueSharePin = () => {
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const pin = generateSharePin();
      db.get('SELECT id FROM users WHERE share_pin = ?', [pin], (err, user) => {
        if (err) return reject(err);
        if (user) return attempt(); // Colisión, intentar de nuevo
        resolve(pin);
      });
    };
    attempt();
  });
};

module.exports = {
  generateSharePin,
  getUniqueSharePin
};
