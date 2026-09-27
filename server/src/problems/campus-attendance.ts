import type { Problem } from '../domain/problem.ts';

export const campusAttendance: Problem = {
  slug: 'campus-attendance',
  title: 'Campus Attendance Tracker',
  difficulty: 'Medium',
  timeboxMinutes: 45,
  summary: 'Lectures and labs, a 75% rule that keeps changing, warnings before a student is debarred, and corrections.',
  context:
    'At many Indian universities, attendance decides whether a student may sit the end-term exam: fall below 75% in a course and you are debarred. Faculty mark attendance for every lecture and lab, students want to know exactly how many classes they can still miss, and the university keeps adjusting the rules.',
  origin: 'Drawn from GalgotiasLife, an attendance tracker the author built for Galgotias University students.',
  requirements: [
    'Students are enrolled in courses, and each course has scheduled sessions: lectures and labs.',
    'A faculty member marks each student in a session as present, absent or on medical leave.',
    'A student sees their percentage per course, and how many more classes they can miss (or must attend) to stay above the threshold.',
    'The attendance policy is configurable: 75% today, labs may count double in some courses, and medical leave is excused up to a cap.',
    'A student who falls below the threshold is warned by a notification.',
    'The faculty member who marked a session can correct it within 48 hours.',
  ],
  outOfScope: ['Login and single sign-on', 'Timetable generation', 'Biometric or QR hardware', 'Fee payments'],
  concepts: [
    { name: 'Student', synonyms: ['student', 'learner'] },
    { name: 'Course', synonyms: ['course', 'subject'] },
    { name: 'Session', synonyms: ['session', 'lecture', 'lab', 'period', 'class'] },
    { name: 'AttendanceRecord', synonyms: ['attendance', 'record', 'mark', 'entry'] },
    { name: 'Policy', synonyms: ['policy', 'rule', 'threshold'] },
  ],
  variationPoints: [
    {
      id: 'attendance-policy',
      name: 'Attendance policy',
      why: 'The counting rules change by course and by semester: thresholds, labs counting double, medical caps.',
      synonyms: ['policy', 'rule', 'calculator', 'counting'],
      suggestion:
        'An AttendancePolicy interface lets each course plug in its own counting rules without editing the code that marks attendance.',
    },
    {
      id: 'notification-channel',
      name: 'Notifications',
      why: 'Warnings go out by app push today, and by email or SMS later.',
      synonyms: ['notifier', 'notification', 'channel', 'sender', 'observer', 'listener', 'subscriber'],
      suggestion:
        'A Notifier interface, or an observer on attendance changes, keeps warning logic out of the marking code and lets new channels plug in.',
    },
  ],
  edgeCases: [
    {
      id: 'duplicate-marking',
      description: 'The same session is marked twice, from two devices or by a retried request.',
      keywords: ['duplicate', 'twice', 'idempot', 'already marked', 'double'],
    },
    {
      id: 'cancelled-session',
      description: 'A lecture is cancelled or rescheduled after attendance was taken.',
      keywords: ['cancel', 'reschedul', 'postpone', 'moved'],
    },
    {
      id: 'late-correction',
      description: 'A correction arrives after the 48-hour window.',
      keywords: ['48', 'window', 'late', 'deadline', 'correction'],
    },
    {
      id: 'late-enrolment',
      description: 'A student joins the course after some sessions have already happened.',
      keywords: ['late enrol', 'joined', 'enrol', 'midway', 'added later'],
    },
  ],
  acceptedVariants: [
    'The percentage can be computed from the records each time or kept as a running count. A running count needs care when a record is corrected.',
    'Policies can belong to a course or to a whole programme.',
    'Warnings can be sent the moment a mark is saved or computed by a daily job.',
  ],
  twist: {
    id: 'exemptions',
    title: 'Exemptions and condonation',
    prompt:
      'The university adds two rules. Sessions missed while representing the university at an event count as present. Students between 65% and 75% may apply once per semester for condonation, which a dean approves or rejects. Update your design and explain what changed.',
  },
  starterDiagram: `classDiagram
  %% Replace this with your design.
  class Course {
    +attendanceOf(Student student) double
  }
  class Student`,
};
