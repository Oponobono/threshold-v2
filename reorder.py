import os

file_path = r"c:\Users\cris7\OneDrive\Desktop\Threshold\mobile\app\(tabs)\index.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    lines = f.readlines()

def get_lines(start, end):
    # start and end are 1-indexed
    return lines[start-1:end]

header = get_lines(1, 606)

courses = get_lines(607, 815)
# 816 is {/* 3. QUICK ADD & NEXT CLASS */}
# 817 is <View style={styles.section}>
# 818-819 empty
next_class = get_lines(820, 855)
# 856 empty
knowledge = get_lines(857, 861)
# 862 empty
daily_review = get_lines(863, 867)
# 868 is </View>

overview_title = get_lines(870, 873)  # {/ 4. ORIGINAL METRICS (2x2) /} \n <View...> \n <Text...> \n <View style={styles.grid}>
todays_schedule = get_lines(874, 881)
next_assignment = get_lines(882, 912)
overview_footer = get_lines(913, 914)  # </View>\n</View>

study_tools_and_rest = get_lines(915, len(lines))

new_content = []
new_content.extend(header)

new_content.append("\n        {/* ====================================================== */}\n")
new_content.append("        {/* ORIENTATION                                            */}\n")
new_content.append("        {/* ====================================================== */}\n")
new_content.append("        <View style={styles.section}>\n")
new_content.extend(knowledge)
new_content.append("        </View>\n")

new_content.append("\n        {/* ====================================================== */}\n")
new_content.append("        {/* TODAY FOCUS                                            */}\n")
new_content.append("        {/* ====================================================== */}\n")
new_content.append("        <View style={styles.section}>\n")
new_content.extend(daily_review)
new_content.append("\n")
new_content.extend(next_class)
new_content.append("\n")
# Wrap next_assignment in its own grid so styles match
new_content.append("          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>{t('dashboard.nextAssignment')}</Text>\n")
new_content.append("          <View style={styles.grid}>\n")
new_content.extend(next_assignment)
new_content.append("          </View>\n")
new_content.append("        </View>\n")

new_content.append("\n        {/* ====================================================== */}\n")
new_content.append("        {/* ECOSYSTEM                                              */}\n")
new_content.append("        {/* ====================================================== */}\n")
new_content.extend(courses)

new_content.append("\n        {/* ORIGINAL METRICS (Today's Schedule Only) */}\n")
new_content.append("        <View style={styles.section}>\n")
new_content.append("          <Text style={styles.sectionTitle}>{t('dashboard.overview')}</Text>\n")
new_content.append("          <View style={styles.grid}>\n")
new_content.extend(todays_schedule)
new_content.append("          </View>\n")
new_content.append("        </View>\n")

new_content.extend(study_tools_and_rest)

with open(file_path, "w", encoding="utf-8") as f:
    f.writelines(new_content)

print("Dashboard reordered successfully!")
