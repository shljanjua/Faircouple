/**
 * Love vs Attraction assessment.
 *
 * Attraction is measured in peaks (intensity, novelty, chemistry).
 * Love is measured in averages (consistency, effort, repair, direction).
 * Each question loads onto one of the two axes; the verdict compares them.
 */

export type Axis = 'love' | 'attraction';

export interface AssessmentQuestion {
  id: string;
  axis: Axis;
  text: string;
  helper?: string;
  reverse?: boolean;
}

export const LIKERT = [
  { value: 1, label: 'Never' },
  { value: 2, label: 'Rarely' },
  { value: 3, label: 'Sometimes' },
  { value: 4, label: 'Often' },
  { value: 5, label: 'Always' },
];

export const LOVE_ATTRACTION_QUESTIONS: AssessmentQuestion[] = [
  {
    id: 'boring_tuesday',
    axis: 'love',
    text: 'We enjoy each other on an ordinary day with nothing planned.',
    helper: 'Attraction needs stimulation. Love survives a quiet Tuesday.',
  },
  {
    id: 'inconvenient',
    axis: 'love',
    text: 'They show up for me when it is inconvenient for them.',
  },
  {
    id: 'effort_mutual',
    axis: 'love',
    text: 'Effort between us is mutual — neither of us is always the one trying.',
  },
  {
    id: 'repair',
    axis: 'love',
    text: 'After an argument we repair, rather than one of us going silent or winning.',
  },
  {
    id: 'unimpressive',
    axis: 'love',
    text: 'I can be tired, wrong or unimpressive around them without performing.',
  },
  {
    id: 'concrete_future',
    axis: 'love',
    text: 'We make concrete plans together — dates, money, cities, timelines.',
  },
  {
    id: 'bad_news',
    axis: 'love',
    text: 'When I bring bad news, they ask a second question instead of changing the subject.',
  },
  {
    id: 'respect_boundaries',
    axis: 'love',
    text: 'They respect my time with friends, hobbies and family without making it a problem.',
  },
  {
    id: 'consistency',
    axis: 'love',
    text: 'Their behaviour is consistent — what they say and what they do match.',
  },
  {
    id: 'support_ambition',
    axis: 'love',
    text: 'They actively support my ambitions, even when it costs them time.',
  },
  {
    id: 'physical_pull',
    axis: 'attraction',
    text: 'The physical pull between us is intense.',
  },
  {
    id: 'novelty_needed',
    axis: 'attraction',
    text: 'Things feel flat unless something new or exciting is happening.',
  },
  {
    id: 'overthink_messages',
    axis: 'attraction',
    text: 'I re-read their messages and analyse their tone.',
  },
  {
    id: 'chase',
    axis: 'attraction',
    text: 'Part of the excitement is not being sure where I stand.',
  },
  {
    id: 'jealousy',
    axis: 'attraction',
    text: 'I feel jealous or possessive more often than secure.',
  },
  {
    id: 'idealise',
    axis: 'attraction',
    text: 'I find it hard to name anything genuinely annoying about them.',
  },
  {
    id: 'highs_lows',
    axis: 'attraction',
    text: 'Our relationship swings between very high highs and very low lows.',
  },
  {
    id: 'appearance_first',
    axis: 'attraction',
    text: 'What I value most about them is how they look or how they make me feel in public.',
  },
  {
    id: 'avoid_hard_talks',
    axis: 'attraction',
    text: 'We avoid difficult conversations to keep the mood good.',
  },
  {
    id: 'fear_ending',
    axis: 'attraction',
    text: 'I stay partly because I fear how it would feel to lose the intensity.',
  },
];

export interface AssessmentResult {
  loveScore: number;       // 0–100
  attractionScore: number; // 0–100
  difference: number;
  key: 'love' | 'love_with_spark' | 'balanced' | 'attraction_led' | 'infatuation' | 'early';
  verdict: string;
  summary: string;
  guidance: string[];
}

export function scoreAssessment(answers: Record<string, number>): AssessmentResult {
  const collect = (axis: Axis) => {
    const questions = LOVE_ATTRACTION_QUESTIONS.filter((q) => q.axis === axis);
    const values = questions
      .map((q) => {
        const raw = answers[q.id];
        if (typeof raw !== 'number') return null;
        return q.reverse ? 6 - raw : raw;
      })
      .filter((v): v is number => v !== null);
    if (!values.length) return { score: 0, answered: 0, total: questions.length };
    const sum = values.reduce((a, b) => a + b, 0);
    // 1–5 scale → 0–100
    return {
      score: Math.round(((sum / values.length - 1) / 4) * 100),
      answered: values.length,
      total: questions.length,
    };
  };

  const love = collect('love');
  const attraction = collect('attraction');
  const answeredRatio =
    (love.answered + attraction.answered) / LOVE_ATTRACTION_QUESTIONS.length;

  const loveScore = love.score;
  const attractionScore = attraction.score;
  const difference = loveScore - attractionScore;

  if (answeredRatio < 0.6) {
    return {
      loveScore,
      attractionScore,
      difference,
      key: 'early',
      verdict: 'Not enough answers yet',
      summary: 'Answer at least 12 questions for a meaningful result.',
      guidance: ['Finish the assessment, then ask your partner to take it independently.'],
    };
  }

  let key: AssessmentResult['key'];
  let verdict: string;
  let summary: string;
  let guidance: string[];

  if (loveScore >= 70 && attractionScore >= 60) {
    key = 'love_with_spark';
    verdict = 'Love — with the spark intact';
    summary =
      'Your answers describe consistency *and* chemistry. This is the healthiest combination: the intensity is real, and it is sitting on top of reliable behaviour.';
    guidance = [
      'Keep the weekly check-in — this is exactly the state that quietly erodes without maintenance.',
      'Protect novelty deliberately: plan something new each month rather than waiting for it.',
      'Watch the fairness balance index; strong couples usually break on effort, not on feeling.',
    ];
  } else if (loveScore >= 70) {
    key = 'love';
    verdict = 'Love — built on consistency';
    summary =
      'The structure is there: mutual effort, repair after conflict, real plans. Attraction scores lower, which usually means comfort has replaced intensity rather than that something is wrong.';
    guidance = [
      'Reintroduce novelty on purpose — new places, new activities, phone-free dates.',
      'Say the appreciation out loud. Long-term couples assume it is understood; it is not.',
      'Book physical time the way you book everything else.',
    ];
  } else if (attractionScore >= 70 && loveScore < 50) {
    key = 'infatuation';
    verdict = 'Attraction — not yet love';
    summary =
      'High intensity, low consistency. The highs and lows, the jealousy, the avoided conversations — these are the signature of infatuation rather than a stable bond.';
    guidance = [
      'Test it against a boring week: how does it feel with nothing exciting happening?',
      'Have one difficult conversation you have been avoiding, and watch what happens next.',
      'Track effort for six weeks. Infatuation shows spikes and collapses; love shows a stable line.',
    ];
  } else if (attractionScore > loveScore + 10) {
    key = 'attraction_led';
    verdict = 'Attraction-led';
    summary =
      'Chemistry is currently carrying more weight than structure. That is normal early on — it becomes a problem only if it stays that way past the first year.';
    guidance = [
      'Make one concrete plan together with a date attached.',
      'Notice who initiates repair after conflict. If it is always the same person, that is the imbalance.',
      'Ask your partner to take this assessment independently, then compare.',
    ];
  } else if (Math.abs(difference) <= 10) {
    key = 'balanced';
    verdict = 'Balanced — early but promising';
    summary =
      'Love and attraction are scoring similarly. The foundation is forming; consistency over the next few months is what decides which way it settles.';
    guidance = [
      'Start the weekly fairness ritual now — habits are cheap to build early.',
      'Watch the deal-breaker area carefully; it is the one that never improves on its own.',
      'Re-take this in eight weeks and compare the two results.',
    ];
  } else {
    key = 'early';
    verdict = 'Unclear — more data needed';
    summary =
      'Your answers do not lean strongly either way. That usually means the relationship is new, or that it is in a flat period.';
    guidance = [
      'Log emotions daily for four weeks, then re-take this.',
      'Ask your partner to take it separately — the gap between your two results is the most useful number.',
    ];
  }

  return { loveScore, attractionScore, difference, key, verdict, summary, guidance };
}

/** Compatibility questionnaire used inside the app (both partners answer). */
export interface CompatibilityDimension {
  key: string;
  label: string;
  emoji: string;
  question: string;
}

export const COMPATIBILITY_DIMENSIONS: CompatibilityDimension[] = [
  { key: 'emotional', label: 'Emotional', emoji: '🤝', question: 'How understood do you feel by your partner right now?' },
  { key: 'communication', label: 'Communication', emoji: '💬', question: 'How easily can you raise a hard subject?' },
  { key: 'trust', label: 'Trust', emoji: '🧠', question: 'How secure do you feel about their loyalty and honesty?' },
  { key: 'financial', label: 'Financial', emoji: '💸', question: 'How fair does the money side feel to you?' },
  { key: 'intimacy', label: 'Affection', emoji: '💕', question: 'How satisfied are you with affection and closeness?' },
  { key: 'lifestyle', label: 'Lifestyle', emoji: '🏡', question: 'How well do your daily routines and habits fit together?' },
  { key: 'future_goals', label: 'Future', emoji: '🎯', question: 'How aligned are you on where this is going?' },
  { key: 'conflict', label: 'Conflict', emoji: '⚖️', question: 'How well do you repair after a disagreement?' },
];

export function scoreCompatibility(
  mine: Record<string, number>,
  theirs: Record<string, number> | null
) {
  const dimensions = COMPATIBILITY_DIMENSIONS.map((dimension) => {
    const a = mine[dimension.key] ?? 0;
    const b = theirs?.[dimension.key] ?? null;
    const combined = b === null ? a : (a + b) / 2;
    return {
      ...dimension,
      mine: a,
      theirs: b,
      score: Math.round((combined / 10) * 100),
      gap: b === null ? null : Math.abs(a - b),
    };
  });

  const withData = dimensions.filter((d) => d.mine > 0);
  const overall = withData.length
    ? Math.round(withData.reduce((sum, d) => sum + d.score, 0) / withData.length)
    : 0;

  const biggestGap = dimensions
    .filter((d) => d.gap !== null)
    .sort((x, y) => (y.gap ?? 0) - (x.gap ?? 0))[0];

  return { overall, dimensions, biggestGap: biggestGap ?? null };
}
