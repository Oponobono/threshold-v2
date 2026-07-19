const fs = require('fs');

const cardPath = 'c:\\Users\\cris7\\OneDrive\\Desktop\\Threshold\\mobile\\src\\components\\dashboard\\CourseHeroCard.tsx';
let cardContent = fs.readFileSync(cardPath, 'utf8');

cardContent = cardContent.replace(
  /\{\/\* Recommendation - Acción principal \*\/\}\r?\n\s*\{vm\.recommendation && \([\s\S]*?<\/Animated\.View>\r?\n\s*\)\}/,
  `{/* Recommendation - Acción principal */}\n        {vm.recommendation ? (\n          <Animated.View layout={Layout.springify().damping(14).stiffness(140)} style={cHCardStyles.recommendationSection}>\n            <Text style={cHCardStyles.recommendationHeader}>Continúa aprendiendo</Text>\n            <Text style={cHCardStyles.recommendationSubject} numberOfLines={1}>\n              {vm.recommendation.subjectName}\n            </Text>\n            <Text style={cHCardStyles.recommendationDetail}>\n              {vm.recommendation.detail}\n            </Text>\n          </Animated.View>\n        ) : <View style={{ height: 76 }} />}`
);

fs.writeFileSync(cardPath, cardContent, 'utf8');
console.log('Fixed recommendation placeholder');
