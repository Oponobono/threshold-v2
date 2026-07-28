import type { CourseHeroViewModel, GlobalHeroViewModel } from '../../../types/heroViewModels';

export function courseHeroComparator(
  prev: { viewModel: CourseHeroViewModel; isActive: boolean; onPress?: () => void },
  next: { viewModel: CourseHeroViewModel; isActive: boolean; onPress?: () => void }
): boolean {
  return (
    prev.isActive === next.isActive &&
    prev.viewModel.progress === next.viewModel.progress &&
    prev.viewModel.completedClasses === next.viewModel.completedClasses &&
    prev.viewModel.totalClasses === next.viewModel.totalClasses &&
    prev.viewModel.momentum === next.viewModel.momentum &&
    prev.viewModel.subjectCount === next.viewModel.subjectCount &&
    prev.viewModel.title === next.viewModel.title &&
    prev.viewModel.instructor === next.viewModel.instructor
  );
}

export function globalHeroComparator(
  prev: { viewModel: GlobalHeroViewModel; isActive: boolean },
  next: { viewModel: GlobalHeroViewModel; isActive: boolean }
): boolean {
  return (
    prev.isActive === next.isActive &&
    prev.viewModel.health === next.viewModel.health &&
    prev.viewModel.courseCount === next.viewModel.courseCount &&
    prev.viewModel.subjectCount === next.viewModel.subjectCount &&
    prev.viewModel.globalProgress.percentage === next.viewModel.globalProgress.percentage
  );
}
