const fs = require('fs');

// 1. Revert styles
const stylePath = 'c:\\Users\\cris7\\OneDrive\\Desktop\\Threshold\\mobile\\src\\styles\\CourseHeroCard.styles.ts';
let styleContent = fs.readFileSync(stylePath, 'utf8');
styleContent = styleContent.replace(/minHeight: 280,\r?\n\s*justifyContent: 'space-between',\r?\n\s*/, '');
fs.writeFileSync(stylePath, styleContent, 'utf8');
console.log('Reverted CourseHeroCard.styles.ts');

// 2. Modify CourseHeroCard.tsx
const cardPath = 'c:\\Users\\cris7\\OneDrive\\Desktop\\Threshold\\mobile\\src\\components\\dashboard\\CourseHeroCard.tsx';
let cardContent = fs.readFileSync(cardPath, 'utf8');

// Replace tags
cardContent = cardContent.replace(
  /\{\/\* Tags \*\/\}\r?\n\s*\{vm\.tags && vm\.tags\.length > 0 \? \([\s\S]*?\) : null\}/,
  `{/* Tags */}\n        {vm.tags && vm.tags.length > 0 ? (\n          <Animated.View layout={Layout.springify().damping(14).stiffness(140)} style={cHCardStyles.tagsRow}>\n            {vm.tags.map((tag, i) => (\n              <View key={i} style={cHCardStyles.tagBadge}>\n                <Text style={cHCardStyles.tagText}>{tag}</Text>\n              </View>\n            ))}\n          </Animated.View>\n        ) : <View style={{ height: 26 }} />}`
);

// Replace Progress
cardContent = cardContent.replace(
  /\{\/\* Progress section - KPI principal \*\/\}\r?\n\s*\{vm\.totalClasses > 0 && \([\s\S]*?<\/Animated\.View>\r?\n\s*\)\}/,
  `{/* Progress section - KPI principal */}\n        {vm.totalClasses > 0 ? (\n          <Animated.View layout={Layout.springify().damping(14).stiffness(140)}>\n            <View style={cHCardStyles.progressBarBg}>\n              <View style={[cHCardStyles.progressBarFill, { width: \`\${vm.progress}%\` as any }]} />\n            </View>\n            <Text style={cHCardStyles.classesText}>\n              {vm.completedClasses} / {vm.totalClasses} clases\n            </Text>\n            <Text style={cHCardStyles.remainingText}>\n              {remaining} clases restantes\n            </Text>\n          </Animated.View>\n        ) : <View style={{ height: 44 }} />}`
);

// Replace Knowledge
cardContent = cardContent.replace(
  /\{\/\* Knowledge - secundario \*\/\}\r?\n\s*\{vm\.knowledge && \([\s\S]*?<\/Animated\.View>\r?\n\s*\)\}/,
  `{/* Knowledge - secundario */}\n        {vm.knowledge ? (\n          <Animated.View layout={Layout.springify().damping(14).stiffness(140)}>\n            <TouchableOpacity\n              style={cHCardStyles.knowledgeRow}\n              onPress={() => setTooltipText(t('dashboard.heroTooltips.knowledge'))}\n            >\n              <Text style={cHCardStyles.knowledgeLabel}>{vm.knowledge.subjectName}</Text>\n              <View style={{\n                flexDirection: 'row',\n                alignItems: 'center',\n                gap: 4,\n                backgroundColor: MemoryLevelMapper.toColor(vm.knowledge.memoryLevel) + '15',\n                paddingHorizontal: 8,\n                paddingVertical: 3,\n                borderRadius: 100,\n              }}>\n                <Ionicons\n                  name={vm.knowledge.memoryLevel === 'excellent' ? 'shield-checkmark' : vm.knowledge.memoryLevel === 'good' ? 'checkmark-circle' : vm.knowledge.memoryLevel === 'recovering' ? 'trending-up' : 'alert-circle'}\n                  size={12}\n                  color={MemoryLevelMapper.toColor(vm.knowledge.memoryLevel)}\n                />\n                <Text style={{ fontSize: 11, fontWeight: '700', color: MemoryLevelMapper.toColor(vm.knowledge.memoryLevel) }}>\n                  {vm.knowledge.score}%\n                </Text>\n              </View>\n            </TouchableOpacity>\n          </Animated.View>\n        ) : <View style={{ height: 42 }} />}`
);

fs.writeFileSync(cardPath, cardContent, 'utf8');
console.log('Updated CourseHeroCard.tsx with placeholders');
