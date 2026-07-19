const fs = require('fs');

const path = 'c:\\Users\\cris7\\OneDrive\\Desktop\\Threshold\\mobile\\src\\locales\\es\\dashboard.json';
let content = fs.readFileSync(path, 'utf8');

const newTooltips = `"heroTooltips": {
    "globalHealth": {
      "excellent": "Tu memoria global está en un nivel óptimo. Has mantenido un ritmo de estudio excelente en todas tus materias.",
      "good": "Tu memoria global está saludable. Mantienes un buen ritmo, aunque algunas materias podrían requerir un poco más de atención.",
      "fair": "Tu memoria global está bajando. Es un buen momento para dedicarle tiempo a las materias que has dejado de repasar.",
      "poor": "Tu memoria global está en riesgo. Necesitas organizar una sesión de estudio para recuperar los conceptos que estás olvidando."
    },
    "momentum": {
      "excellent": "Estudio constante. Has mantenido un ritmo de estudio impecable en las últimas semanas.",
      "good": "Estudio intermitente. Tienes actividad reciente, pero podrías ser más constante para no perder el ritmo.",
      "poor": "Poco estudio reciente. Retoma el ritmo lo antes posible para no atrasarte en esta materia."
    },
    "knowledge": {
      "excellent": "Excelente retención. Tienes estos conceptos muy frescos gracias a tus repasos constantes.",
      "good": "Buena retención. Recuerdas la mayor parte del contenido, pero un repaso pronto te ayudará a no olvidarlo.",
      "fair": "Retención regular. Estás empezando a olvidar algunos conceptos importantes. Te recomendamos repasar pronto.",
      "poor": "Retención baja. Ha pasado tiempo sin repasar o los temas son muy difíciles. Necesitas estudiar pronto para no olvidar."
    },
    "tapToLearnMore": "Toca para más info"
  }`;

content = content.replace(/"heroTooltips":\s*\{[\s\S]*?\}(?=\n\})/, newTooltips);

fs.writeFileSync(path, content, 'utf8');
console.log('Updated dashboard.json');
