export const uid = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

const speakerPattern = /^([^\s:：][^:：\n]{0,35})\s*[:：]\s*(.*)$/;
const headingPattern = /^\s*(?:#{1,6}\s*|#{1,6}(?=\d)|\[장면\]|\[씬\]|\[SCENE\])/i;

function getSpeaker(line) {
  const match = line.match(speakerPattern);
  if (!match) return null;

  const name = match[1].trim();
  if (name.length > 24 || /[.!?。？！]/.test(name) || /^https?$/i.test(name)) return null;

  return {speaker: name, text: match[2] || ''};
}

export function parseLog(raw, mode = 'extended') {
  const lines = raw.replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  const emptyLimit = mode === 'simple' ? 1 : 2;

  let buffer = null;
  let currentSpeaker = '';
  let emptyLines = 0;

  const flush = () => {
    if (buffer && buffer.text.trim()) blocks.push({...buffer, id: uid()});
    buffer = null;
  };

  for (const line of lines) {
    if (!line.trim()) {
      emptyLines++;
      continue;
    }

    const speaker = getSpeaker(line);

    if (speaker) {
      flush();
      currentSpeaker = speaker.speaker;
      buffer = {type: 'speaker', speaker: currentSpeaker, text: speaker.text};
      emptyLines = 0;
      continue;
    }

    if (headingPattern.test(line)) {
      flush();
      currentSpeaker = '';
      buffer = {type: 'heading', speaker: '', text: line};
      emptyLines = 0;
      continue;
    }

    if (emptyLines >= emptyLimit && buffer?.type === 'speaker') {
      flush();
      currentSpeaker = '';
    }

    if (!buffer) {
      const isQuote = /^["“「『]/.test(line.trim());
      const type = isQuote && currentSpeaker ? 'speaker' : 'narration';
      buffer = {type, speaker: type === 'speaker' ? currentSpeaker : '', text: line};
    } else {
      buffer.text += `${'\n'.repeat(emptyLines + 1)}${line}`;
    }

    emptyLines = 0;
  }

  flush();
  return blocks;
}

export function speakersOf(blocks) {
  return [...new Set(blocks.filter(b => b.type === 'speaker' && b.speaker.trim()).map(b => b.speaker.trim()))];
}