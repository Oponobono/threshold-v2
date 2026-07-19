const fs = require('fs');

const path = 'c:\\Users\\cris7\\OneDrive\\Desktop\\Threshold\\mobile\\src\\components\\dashboard\\CourseHeroCard.tsx';
let content = fs.readFileSync(path, 'utf8');

// Change the placeholder height for recent activity from 100 to 70 (since we removed 1 item)
content = content.replace(
  /\{\/\* Recent Activity - Top 3 \*\/\}\r?\n\s*\{vm\.recentActivity\.length > 0 \? \([\s\S]*?\) : <View style=\{\{ height: 100 \}\} \/>\}/,
  `{/* Recent Activity - Top 2 */}\n        {vm.recentActivity.length > 0 ? (\n          <Animated.View layout={Layout.springify().damping(14).stiffness(140)} style={cHCardStyles.recentActivitySection}>\n            <Text style={cHCardStyles.recentActivityHeader}>Más activas</Text>\n            {vm.recentActivity.map((item, i) => (\n              <View key={i} style={cHCardStyles.activityItem}>\n                <View style={[cHCardStyles.activityDot, { backgroundColor: i === 0 ? theme.colors.primary : theme.colors.text.placeholder }]} />\n                <Text style={cHCardStyles.activityName} numberOfLines={1}>{item.name}</Text>\n                <Text style={cHCardStyles.activityTime}>{item.lastActivity}</Text>\n              </View>\n            ))}\n          </Animated.View>\n        ) : <View style={{ height: 70 }} />}`
);

// If there's an extra empty space somewhere at the bottom of the card, we should remove it.
// The user said: "debajo hay un espacio vacio sin sentido, lo quitaremos".
// In AllSubjectsHeroCard, after the exam badge, is there anything? No. 
// Maybe the user refers to the exam badge itself? "debajo hay un espacio vacio sin sentido"
// The exam badge has `marginTop: 8` and `paddingVertical: 8`... wait, maybe there's a margin?
// Let's change the exam placeholder from 40 to 0 if we want to remove the empty space at the bottom? No, if it's 0, then when there is NO exam, the card shrinks! That's exactly what we DON'T want.
// Wait! If the card is "mucho más grande que el card de un curso con todos sus elementos", it means the total height of AllSubjectsHeroCard EXCEEDS the total height of CourseHeroCard!
// CourseHeroCard height is ~337.
// AllSubjectsHeroCard height:
// topRow: 24
// Title: 32
// globalProgress: 44 + marginVertical 16 = 60
// recommendation: 76
// divider: 15
// ecosystem: ~24
// recentActivity: header 14 + 2 items(30) = 44 + margin 12 = 56
// examBadge: 40
// Total: 24 + 32 + 60 + 76 + 15 + 24 + 56 + 40 = 327 + padding 40 = 367 !!
// 367 > 337. It IS taller!

// To make it exactly 337:
// We need to remove 30px.
// By reducing recentActivity from 3 to 2, we removed ~30px.
// So now recentActivity is ~56.
// Let's remove the placeholder for `upcomingExam` at the very bottom? Or just reduce the sizes slightly.
// The user said: "en la lista de materias mas activas, tendremos solo 2. debajo hay un espacio vacio sin sentido, lo quitaremos y de esta forma nos quedara una altura exacta a la de los cursos completos"
// It sounds like they want to remove the placeholder for `upcomingExam` completely! (Because when there is no exam, it leaves a 40px empty space at the bottom). Let's remove the 40px placeholder and see.

content = content.replace(
  /\) : <View style=\{\{ height: 40 \}\} \/>\}/g,
  ') : null}'
);

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed recent activity and removed exam placeholder');
