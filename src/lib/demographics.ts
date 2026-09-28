// Shared between the survey form, its submit route, and the admin view -
// keeping one copy avoids the three drifting out of sync.
export const DEMOGRAPHIC_SCHOOLS = [
  'McCombs School of Business',
  'College of Liberal Arts',
  'College of Education',
  'College of Natural Sciences',
  'Undecided',
  'Moody College of Communication',
  'Cockrell School of Engineering',
  'Other Schools',
] as const

export const CLASS_STANDINGS = ['freshman', 'sophomore', 'junior', 'senior'] as const

export const CLASS_STANDING_LABELS: Record<string, string> = {
  freshman: 'Freshman',
  sophomore: 'Sophomore',
  junior: 'Junior',
  senior: 'Senior',
}
