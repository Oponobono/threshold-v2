const validateOwner = (req, res, next) => {
  const { userId } = req.params;
  
  if (!userId) return next();

  if (parseInt(userId, 10) !== req.user.id) {
    return res.status(403).json({ error: 'Acceso denegado. No eres el propietario de este recurso.' });
  }
  
  next();
};

module.exports = validateOwner;
