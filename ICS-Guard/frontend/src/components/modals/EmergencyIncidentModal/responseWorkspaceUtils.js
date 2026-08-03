const eventTimestamp = event => {
  const value = event?.event_time || event?.timestamp || event?.createdAt || event?.created_at;
  const timestamp = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : 0;
};

export const selectLatestAiAdvice = timeline => {
  if (!Array.isArray(timeline)) return null;

  return timeline
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => (
      event?.action_type === 'ai_analysis'
      && event?.metadata?.ai === true
      && typeof event?.description === 'string'
      && event.description.trim().length > 0
    ))
    .sort((left, right) => (
      eventTimestamp(right.event) - eventTimestamp(left.event)
      || right.index - left.index
    ))[0]?.event || null;
};

export const hasFreshAiAdvice = (responseCase, previousAdviceId, requestedAt) => {
  if (!responseCase?.aiAdvice) return false;

  if (responseCase.aiAdviceId) {
    return String(responseCase.aiAdviceId) !== String(previousAdviceId || '');
  }

  const adviceTimestamp = new Date(responseCase.aiAdviceAt || 0).getTime();
  return Number.isFinite(adviceTimestamp) && adviceTimestamp >= requestedAt;
};

export const parseDiagnosisReport = report => {
  if (typeof report !== 'string' || !report.trim()) return null;

  const intro = [];
  const sections = [];
  let currentSection = null;

  report.replace(/\r\n?/g, '\n').split('\n').forEach(line => {
    const heading = line.match(/^\s*(\d+)\.\s+(.+?)\s*$/);
    if (heading) {
      currentSection = {
        number: Number(heading[1]),
        title: heading[2],
        lines: [],
      };
      sections.push(currentSection);
      return;
    }

    if (currentSection) currentSection.lines.push(line);
    else intro.push(line);
  });

  if (sections.length < 2) return null;

  const trimEmptyEdges = lines => {
    const result = [...lines];
    while (result[0]?.trim() === '') result.shift();
    while (result.at(-1)?.trim() === '') result.pop();
    return result;
  };

  return {
    title: trimEmptyEdges(intro).join('\n'),
    sections: sections.map(section => ({
      ...section,
      content: trimEmptyEdges(section.lines).join('\n'),
    })),
  };
};
