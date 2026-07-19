const fs = require('fs');

const dashPath = 'c:\\Users\\cris7\\OneDrive\\Desktop\\Threshold\\mobile\\src\\locales\\es\\dashboard.json';
let dashContent = fs.readFileSync(dashPath, 'utf8');

const newTooltips = `"heroTooltips": {
    "globalHealth": {
      "excellent": "Tu memoria global está en un nivel óptimo. Has mantenido un ritmo de estudio excelente en todas tus materias.",
      "good": "Tu memoria global está saludable. Mantienes un buen ritmo, aunque algunas materias podrían requerir un poco más de atención.",
      "fair": "Tu memoria global está bajando. Es un buen momento para dedicarle tiempo a las materias que has dejado de repasar.",
      "poor": "Tu memoria global está en riesgo. Necesitas organizar una sesión de estudio para recuperar los conceptos que estás olvidando.",
      "critical": "Alerta crítica. Tu memoria global está en niveles muy bajos. Debes empezar a repasar inmediatamente para no perder todo tu progreso."
    },
    "momentum": {
      "excellent": "Estudio constante. Has mantenido un ritmo de estudio impecable en las últimas semanas.",
      "good": "Estudio intermitente. Tienes actividad reciente, pero podrías ser más constante para no perder el ritmo.",
      "fair": "Estudio bajo. Te estás atrasando en esta materia, intenta dedicarle un poco de tiempo pronto.",
      "poor": "Poco estudio reciente. Retoma el ritmo lo antes posible para no atrasarte en esta materia.",
      "critical": "Abandono total. Hace mucho que no estudias esta materia. El conocimiento empezará a desvanecerse si no actúas pronto."
    },
    "knowledge": {
      "excellent": "Excelente retención. Tienes estos conceptos muy frescos gracias a tus repasos constantes.",
      "good": "Buena retención. Recuerdas la mayor parte del contenido, pero un repaso pronto te ayudará a no olvidarlo.",
      "fair": "Retención regular. Estás empezando a olvidar algunos conceptos importantes. Te recomendamos repasar pronto.",
      "poor": "Retención baja. Ha pasado tiempo sin repasar o los temas son difíciles. Necesitas estudiar pronto para no olvidar.",
      "critical": "Conocimiento crítico. Es probable que hayas olvidado casi todo de esta materia. Prepárate para reaprender varios conceptos."
    },
    "tapToLearnMore": "Toca para más info"
  }`;

dashContent = dashContent.replace(/"heroTooltips":\s*\{[\s\S]*?\}(?=\n\})/, newTooltips);
fs.writeFileSync(dashPath, dashContent, 'utf8');


const cardPath = 'c:\\Users\\cris7\\OneDrive\\Desktop\\Threshold\\mobile\\src\\components\\dashboard\\CourseHeroCard.tsx';
let cardContent = fs.readFileSync(cardPath, 'utf8');

cardContent = cardContent.replace(
  /const level = vm\.momentum >= 90 \? 'excellent' : vm\.momentum >= 50 \? 'good' : 'poor';/,
  "const level = vm.momentum >= 90 ? 'excellent' : vm.momentum >= 70 ? 'good' : vm.momentum >= 50 ? 'fair' : vm.momentum >= 25 ? 'poor' : 'critical';"
);

cardContent = cardContent.replace(
  /const level = vm\.knowledge!\.score >= 90 \? 'excellent' : vm\.knowledge!\.score >= 70 \? 'good' : vm\.knowledge!\.score >= 50 \? 'fair' : 'poor';/,
  "const level = vm.knowledge!.score >= 90 ? 'excellent' : vm.knowledge!.score >= 70 ? 'good' : vm.knowledge!.score >= 50 ? 'fair' : vm.knowledge!.score >= 25 ? 'poor' : 'critical';"
);

cardContent = cardContent.replace(
  /const level = vm\.health >= 90 \? 'excellent' : vm\.health >= 70 \? 'good' : vm\.health >= 50 \? 'fair' : 'poor';/,
  "const level = vm.health >= 90 ? 'excellent' : vm.health >= 70 ? 'good' : vm.health >= 50 ? 'fair' : vm.health >= 25 ? 'poor' : 'critical';"
);

fs.writeFileSync(cardPath, cardContent, 'utf8');
console.log('Added critical intervals');
