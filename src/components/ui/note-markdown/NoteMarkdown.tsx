import { type ReactNode } from 'react';
import styles from './NoteMarkdown.module.css';

interface NoteMarkdownProps {
  plaintext: string;
}

type InlineNode = string | ReactNode;

/** Check whether plaintext contains markdown-like patterns worth rendering */
export function hasMarkdownPatterns(text: string): boolean {
  // Fenced code blocks
  if (/^```/m.test(text)) return true;
  // Headers
  if (/^#{1,3}\s+\S/m.test(text)) return true;
  // Bold
  if (/\*\*[^*]+\*\*/.test(text)) return true;
  // Toggle / checkbox items
  if (/^[-*]\s+\[[ xX]\]\s+\S/m.test(text)) return true;
  // Bullet lists
  if (/^[-*]\s+\S/m.test(text)) return true;
  // Numbered lists
  if (/^\d+\.\s+\S/m.test(text)) return true;
  // Blockquotes
  if (/^>\s+\S/m.test(text)) return true;
  // Underline
  if (/__[^_]+__/.test(text)) return true;
  // Links
  if (/\[[^\]]+\]\([^)]+\)/.test(text)) return true;
  return false;
}

/** Parse inline formatting: bold, italic, inline code, links */
function parseInline(text: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  // Pattern matches inline code, underline, bold, italic, or links
  const pattern = /`([^`]+)`|__([^_]+)__|\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    // Push text before this match
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    if (match[1] !== undefined) {
      // Inline code
      nodes.push(
        <code key={match.index} className={styles.inlineCode}>
          {match[1]}
        </code>,
      );
    } else if (match[2] !== undefined) {
      // Underline
      nodes.push(
        <span key={match.index} className={styles.underline}>
          {match[2]}
        </span>,
      );
    } else if (match[3] !== undefined) {
      // Bold
      nodes.push(
        <strong key={match.index} className={styles.bold}>
          {match[3]}
        </strong>,
      );
    } else if (match[4] !== undefined) {
      // Italic
      nodes.push(
        <em key={match.index} className={styles.italic}>
          {match[4]}
        </em>,
      );
    } else if (match[5] !== undefined && match[6] !== undefined) {
      // Link — block javascript: URIs, allow http/https/mailto
      const raw = match[6];
      const href = /^https?:\/\/|^mailto:/i.test(raw)
        ? raw
        : /^[a-z]+:/i.test(raw)
          ? null // unknown scheme (javascript:, data:, etc.) — block
          : `https://${raw}`; // bare domain — prepend https
      if (href !== null) {
        nodes.push(
          <a
            key={match.index}
            className={styles.link}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
          >
            {match[5]}
          </a>,
        );
      } else {
        nodes.push(match[0]);
      }
    }

    lastIndex = match.index + match[0].length;
  }

  // Push remaining text
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

interface Block {
  type: 'code' | 'prose';
  content: string;
  lang?: string;
}

/** Split text into code blocks and prose blocks */
function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  const lines = text.split('\n');
  let inCode = false;
  let codeLang = '';
  let codeLines: string[] = [];
  let proseLines: string[] = [];

  for (const line of lines) {
    if (!inCode && /^```(\w*)/.test(line)) {
      // Entering code block — flush prose
      if (proseLines.length > 0) {
        blocks.push({ type: 'prose', content: proseLines.join('\n') });
        proseLines = [];
      }
      const langMatch = /^```(\w*)/.exec(line);
      codeLang = langMatch?.[1] ?? '';
      codeLines = [];
      inCode = true;
    } else if (inCode && /^```\s*$/.test(line)) {
      // Closing code block
      blocks.push({
        type: 'code',
        content: codeLines.join('\n'),
        lang: codeLang || undefined,
      });
      codeLines = [];
      codeLang = '';
      inCode = false;
    } else if (inCode) {
      codeLines.push(line);
    } else {
      proseLines.push(line);
    }
  }

  // Flush remaining
  if (inCode) {
    // Unclosed code block — treat opening fence + content as prose
    proseLines.push('```' + codeLang);
    proseLines.push(...codeLines);
    if (proseLines.length > 0) {
      blocks.push({ type: 'prose', content: proseLines.join('\n') });
    }
  } else if (proseLines.length > 0) {
    blocks.push({ type: 'prose', content: proseLines.join('\n') });
  }

  return blocks;
}

/** Render a prose block as React elements with headers and inline formatting */
function renderProse(content: string, blockIndex: number): ReactNode {
  const lines = content.split('\n');
  const elements: ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const key = `${blockIndex}-${i}`;

    // Headers
    const headerMatch = /^(#{1,3})\s+(.+)$/.exec(line);
    if (headerMatch) {
      const level = (headerMatch[1] ?? '#').length;
      const text = headerMatch[2] ?? '';
      const className =
        level === 1
          ? styles.heading1
          : level === 2
            ? styles.heading2
            : styles.heading3;
      elements.push(
        <div key={key} className={className}>
          {parseInline(text)}
        </div>,
      );
      continue;
    }

    // Toggle / checkbox items (- [ ] or - [x])
    const toggleMatch = /^[-*]\s+\[([ xX])\]\s+(.+)$/.exec(line);
    if (toggleMatch) {
      const checked = toggleMatch[1] !== ' ';
      const text = toggleMatch[2] ?? '';
      elements.push(
        <div key={key} className={styles.toggleItem}>
          <span className={checked ? styles.toggleChecked : styles.toggleUnchecked} />
          <span className={checked ? styles.toggleTextChecked : ''}>{parseInline(text)}</span>
        </div>,
      );
      continue;
    }

    // Bullet list items (- or *)
    const bulletMatch = /^[-*]\s+(.+)$/.exec(line);
    if (bulletMatch) {
      const text = bulletMatch[1] ?? '';
      elements.push(
        <div key={key} className={styles.listItem}>
          <span className={styles.bullet} />
          <span>{parseInline(text)}</span>
        </div>,
      );
      continue;
    }

    // Numbered list items (1. 2. etc.)
    const numberedMatch = /^(\d+)\.\s+(.+)$/.exec(line);
    if (numberedMatch) {
      const num = numberedMatch[1] ?? '1';
      const text = numberedMatch[2] ?? '';
      elements.push(
        <div key={key} className={styles.listItem}>
          <span className={styles.listNumber}>{num}.</span>
          <span>{parseInline(text)}</span>
        </div>,
      );
      continue;
    }

    // Horizontal rule
    if (/^-{3,}\s*$/.test(line)) {
      elements.push(<hr key={key} className={styles.divider} />);
      continue;
    }

    // Blockquote
    const quoteMatch = /^>\s+(.+)$/.exec(line);
    if (quoteMatch) {
      const text = quoteMatch[1] ?? '';
      elements.push(
        <div key={key} className={styles.blockquote}>
          {parseInline(text)}
        </div>,
      );
      continue;
    }

    // Empty line → spacing
    if (line.trim() === '') {
      elements.push(<div key={key} className={styles.blankLine} />);
      continue;
    }

    // Regular line with inline formatting
    elements.push(
      <div key={key} className={styles.proseLine}>
        {parseInline(line)}
      </div>,
    );
  }

  return <div key={blockIndex}>{elements}</div>;
}

/** Render a code block */
function renderCodeBlock(
  content: string,
  lang: string | undefined,
  blockIndex: number,
): ReactNode {
  return (
    <div key={blockIndex} className={styles.codeBlock}>
      {lang && <span className={styles.codeLang}>{lang}</span>}
      <pre className={styles.codeContent}>
        <code>{content}</code>
      </pre>
    </div>
  );
}

export function NoteMarkdown({ plaintext }: NoteMarkdownProps) {
  const blocks = parseBlocks(plaintext);

  return (
    <div className={styles.markdownRoot}>
      {blocks.map((block, i) =>
        block.type === 'code'
          ? renderCodeBlock(block.content, block.lang, i)
          : renderProse(block.content, i),
      )}
    </div>
  );
}
