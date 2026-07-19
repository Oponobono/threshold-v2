const fs = require('fs');

// 1. Update heroViewModels.ts
const typesPath = 'c:\\Users\\cris7\\OneDrive\\Desktop\\Threshold\\mobile\\src\\types\\heroViewModels.ts';
let typesContent = fs.readFileSync(typesPath, 'utf8');
typesContent = typesContent.replace(
  /readonly subjectCount: number;\r?\n/,
  "readonly subjectCount: number;\n  readonly globalProgress: { completed: number; total: number; percentage: number };\n"
);
fs.writeFileSync(typesPath, typesContent, 'utf8');

// 2. Update GlobalHeroPresenter.ts
const presenterPath = 'c:\\Users\\cris7\\OneDrive\\Desktop\\Threshold\\mobile\\src\\presentation\\heroes\\GlobalHeroPresenter.ts';
let presenterContent = fs.readFileSync(presenterPath, 'utf8');
presenterContent = presenterContent.replace(
  /const health = healthScore \?\? HealthScoringService\.calculateFromSubjects\(subjects\);/,
  `const health = healthScore ?? HealthScoringService.calculateFromSubjects(subjects);\n\n    let totalClasses = 0;\n    let completedClasses = 0;\n    courses.forEach(c => {\n      totalClasses += c.total_classes || 0;\n      completedClasses += c.completed_classes || 0;\n    });\n    const percentage = totalClasses > 0 ? Math.min(Math.round((completedClasses / totalClasses) * 100), 100) : 0;`
);
presenterContent = presenterContent.replace(
  /subjectCount: subjects\.length,/,
  `subjectCount: subjects.length,\n      globalProgress: { completed: completedClasses, total: totalClasses, percentage },`
);
fs.writeFileSync(presenterPath, presenterContent, 'utf8');

// 3. Update CourseHeroCard.tsx
const cardPath = 'c:\\Users\\cris7\\OneDrive\\Desktop\\Threshold\\mobile\\src\\components\\dashboard\\CourseHeroCard.tsx';
let cardContent = fs.readFileSync(cardPath, 'utf8');

// Add the progress bar to AllSubjectsHeroCard after Health Score and before Recommendation
cardContent = cardContent.replace(
  /\{\/\* Recommendation - Acción principal \*\/\}/,
  `{/* Progreso Global */}\n        <View style={{ height: 44, marginVertical: 8 }}>\n          {vm.globalProgress.total > 0 ? (\n            <Animated.View layout={Layout.springify().damping(14).stiffness(140)}>\n              <View style={cHCardStyles.progressBarBg}>\n                <View style={[cHCardStyles.progressBarFill, { width: \`\${vm.globalProgress.percentage}%\` as any, backgroundColor: theme.colors.primary }]} />\n              </View>\n              <Text style={cHCardStyles.classesText}>\n                {vm.globalProgress.completed} / {vm.globalProgress.total} clases en total\n              </Text>\n              <Text style={cHCardStyles.remainingText}>\n                Progreso académico global\n              </Text>\n            </Animated.View>\n          ) : <View style={{ height: 44 }} />}\n        </View>\n\n        {/* Recommendation - Acción principal */}`
);

// We also need to make sure the Recent Activity has a placeholder, and Exam has a placeholder.
cardContent = cardContent.replace(
  /\{\/\* Recent Activity - Top 3 \*\/\}\r?\n\s*\{vm\.recentActivity\.length > 0 && \([\s\S]*?<\/Animated\.View>\r?\n\s*\)\}/,
  `{/* Recent Activity - Top 3 */}\n        {vm.recentActivity.length > 0 ? (\n          <Animated.View layout={Layout.springify().damping(14).stiffness(140)} style={cHCardStyles.recentActivitySection}>\n            <Text style={cHCardStyles.recentActivityHeader}>Más activas</Text>\n            {vm.recentActivity.map((item, i) => (\n              <View key={i} style={cHCardStyles.activityItem}>\n                <View style={[cHCardStyles.activityDot, { backgroundColor: i === 0 ? theme.colors.primary : theme.colors.text.placeholder }]} />\n                <Text style={cHCardStyles.activityName} numberOfLines={1}>{item.name}</Text>\n                <Text style={cHCardStyles.activityTime}>{item.lastActivity}</Text>\n              </View>\n            ))}\n          </Animated.View>\n        ) : <View style={{ height: 100 }} />}`
);

cardContent = cardContent.replace(
  /\{\/\* Smart Exam Badge \*\/\}\r?\n\s*\{vm\.upcomingExam && \([\s\S]*?<\/Animated\.View>\r?\n\s*\)\}/,
  `{/* Smart Exam Badge */}\n        {vm.upcomingExam ? (\n          <Animated.View layout={Layout.springify().damping(14).stiffness(140)} style={[cHCardStyles.examBadge, {\n            backgroundColor: vm.upcomingExam.isOverdue ? '#FF2D5518'\n              : vm.upcomingExam.isUrgent ? '#FF950018'\n              : theme.colors.primary + '10',\n          }]}>\n            <Ionicons\n              name={vm.upcomingExam.isOverdue ? 'alert-circle-outline' : vm.upcomingExam.isUrgent ? 'warning-outline' : 'calendar-outline'}\n              size={14}\n              color={vm.upcomingExam.isOverdue ? '#FF2D55' : vm.upcomingExam.isUrgent ? '#FF9500' : theme.colors.primary}\n            />\n            <Text style={[cHCardStyles.examText, {\n              color: vm.upcomingExam.isOverdue ? '#FF2D55' : vm.upcomingExam.isUrgent ? '#FF9500' : theme.colors.primary,\n            }]} numberOfLines={1}>\n              {vm.upcomingExam.isOverdue ? 'Pendiente de calificar' : vm.upcomingExam.name}\n            </Text>\n            <Text style={[cHCardStyles.examCountdown, {\n              color: vm.upcomingExam.isOverdue ? '#FF2D55' : vm.upcomingExam.isUrgent ? '#FF9500' : theme.colors.primary,\n            }]}>\n              {vm.upcomingExam.isOverdue\n                ? \`\${Math.abs(vm.upcomingExam.daysLeft)}d\`\n                : formatExamCountdown(vm.upcomingExam.daysLeft)}\n            </Text>\n          </Animated.View>\n        ) : <View style={{ height: 40 }} />}`
);

fs.writeFileSync(cardPath, cardContent, 'utf8');
console.log('Added Global Progress and missing placeholders to AllSubjectsHeroCard');
