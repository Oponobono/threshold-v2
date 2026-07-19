const fs = require('fs');
const path = 'c:\\Users\\cris7\\OneDrive\\Desktop\\Threshold\\mobile\\app\\(tabs)\\index.tsx';
let content = fs.readFileSync(path, 'utf8');

const target = `                      onEditPress={() => handleEditCourse(item.course)}
                    const isActive = itemCourseId === selectedDashboardCourseId;`;

const replacement = `                      onEditPress={() => handleEditCourse(item.course)}
                      onDeletePress={() => handleDeleteCourse(item.course)}
                      onHeightChange={(h) => handleHeroCardLayout(item.course.id, h)}
                    />
                    );
                  }}
                />
              </Reanimated.View>

              {/* Pagination dots */}
              {heroCourseItems.length > 1 && (
                <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 }}>
                  {heroCourseItems.map((item, idx) => {
                    const itemCourseId = item.type === 'course' ? item.course.id : item.type === 'independent' ? 'independent' : null;
                    const isActive = itemCourseId === selectedDashboardCourseId;`;

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(path, content, 'utf8');
    console.log('Done restoring');
} else {
    console.log('Target not found!');
}
