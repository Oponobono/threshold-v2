const fs = require('fs');
const path = 'c:\\Users\\cris7\\OneDrive\\Desktop\\Threshold\\mobile\\app\\(tabs)\\index.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(
  /const handleHeroCardLayout = useCallback\(\(_key: string, height: number\) => \{[\s\S]*?\}, \[selectedDashboardCourseId, heroTranslateY\]\);/,
  `const handleHeroCardLayout = useCallback((_key: string, height: number) => {\n    cardHeightMap.current.set(_key, height);\n    const currentKey = selectedDashboardCourseId ?? 'all';\n    if (_key === currentKey) {\n      animatedHeroHeight.value = height;\n    }\n  }, [selectedDashboardCourseId, animatedHeroHeight]);`
);

content = content.replace(
  /const handleHeroCardSelect = useCallback\(\(courseId: string \| null\) => \{[\s\S]*?\}, \[heroTranslateY\]\);/,
  `const handleHeroCardSelect = useCallback((courseId: string | null) => {\n    setSelectedDashboardCourseId(courseId);\n    const key = courseId ?? 'all';\n    const measured = cardHeightMap.current.get(key);\n    if (measured) {\n      animatedHeroHeight.value = measured;\n    }\n  }, [animatedHeroHeight]);`
);

content = content.replace(
  /<View style=\{\{ marginHorizontal: -24 \}\}>\s*<FlatList\s*ref=\{heroCarouselRef\}/,
  `<Reanimated.View layout={LinearTransition.springify().damping(18).stiffness(180)}>\n              <Reanimated.View style={[heroContainerAnimatedStyle, { marginHorizontal: -24, overflow: 'visible' }]}>\n                <FlatList\n                  ref={heroCarouselRef}`
);

content = content.replace(
  /<\/View>\s*\)\}\s*<\/>\s*\)\}\s*\{\/\* Content below hero.*?\*\/\}\s*<Animated\.View style=\{\{ transform: \[\{ translateY: heroTranslateY \}\] \}\}>\s*\{\/\* QuickActionRow: class progress for flat courses \*\/\}/s,
  `</Reanimated.View>\n              )}\n            </Reanimated.View>\n          )}\n\n          {/* QuickActionRow: class progress for flat courses */}\n          <Reanimated.View layout={LinearTransition.springify().damping(18).stiffness(180)}>`
);

content = content.replace(
  /<\/Animated\.View>\s*<\/View>\s*\{\/\* 5\. STUDY TOOLS \*\/\}/,
  `</Reanimated.View>\n        </View>\n        {/* 5. STUDY TOOLS */}`
);

fs.writeFileSync(path, content, 'utf8');
console.log('Done replacement');
