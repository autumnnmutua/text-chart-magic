interface SuffixState {
  length: number;
  link: number;
  next: Map<string, number>;
}

const buildSuffixAutomaton = (text: string): SuffixState[] => {
  const states: SuffixState[] = [{ length: 0, link: -1, next: new Map() }];
  let last = 0;
  for (const character of text) {
    const current = states.length;
    states.push({ length: states[last].length + 1, link: 0, next: new Map() });
    let parent = last;
    while (parent >= 0 && !states[parent].next.has(character)) {
      states[parent].next.set(character, current);
      parent = states[parent].link;
    }
    if (parent >= 0) {
      const next = states[parent].next.get(character) as number;
      if (states[parent].length + 1 === states[next].length) {
        states[current].link = next;
      } else {
        const clone = states.length;
        states.push({
          length: states[parent].length + 1,
          link: states[next].link,
          next: new Map(states[next].next)
        });
        while (parent >= 0 && states[parent].next.get(character) === next) {
          states[parent].next.set(character, clone);
          parent = states[parent].link;
        }
        states[next].link = clone;
        states[current].link = clone;
      }
    }
    last = current;
  }
  return states;
};

const longestCommonSubstringLength = (line: string, states: SuffixState[]): number => {
  let current = 0;
  let length = 0;
  let longest = 0;
  for (const character of line) {
    while (current > 0 && !states[current].next.has(character)) {
      current = states[current].link;
      length = Math.min(length, states[current].length);
    }
    const next = states[current].next.get(character);
    if (next === undefined) {
      current = 0;
      length = 0;
      continue;
    }
    current = next;
    length += 1;
    longest = Math.max(longest, length);
  }
  return longest;
};

// Finds the source line sharing the longest contiguous text with the parser excerpt.
export function findMostRelevantLineNumber(errorLineText: string, code: string): number {
  if (!errorLineText) return -1;
  const codeLines = code.split('\n');
  const states = buildSuffixAutomaton(errorLineText);
  let mostRelevantLineNumber = -1;
  let maxCommonLength = 0;

  for (const [i, line] of codeLines.entries()) {
    const commonLength = longestCommonSubstringLength(line, states);
    if (commonLength > maxCommonLength) {
      maxCommonLength = commonLength;
      mostRelevantLineNumber = i + 1; // Line numbers start from 1
    }
  }
  return mostRelevantLineNumber;
}

// Function to replace the incorrect line number in the error message
export function replaceLineNumberInErrorMessage(
  errorMessage: string,
  realLineNumber: number
): string {
  const regexParseError = /Parse error on line (\d+):/;
  const regexLexError = /Lexical error on line (\d+)/;
  return errorMessage
    .replace(regexParseError, `Parse error on line ${realLineNumber}:`)
    .replace(regexLexError, `Lexical error on line ${realLineNumber}:`);
}

export function extractErrorLineText(errorMessage: string): string {
  const regex = /Error: Parse error on line \d+:\n(.+)\n+/;
  const match = errorMessage.match(regex);
  if (match) {
    return match[1].slice(3);
  }

  const regexLex = /Error: Lexical error on line \d+. Unrecognized text.\n(.+)\n-+/;
  const matchLex = errorMessage.match(regexLex);
  return matchLex ? matchLex[1].slice(3) : '';
}
