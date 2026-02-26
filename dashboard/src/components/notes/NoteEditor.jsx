import { useMemo, useCallback } from 'react';
import { BlockNoteView } from '@blocknote/mantine';
import { useCreateBlockNote } from '@blocknote/react';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';

/**
 * Parse stored note body into BlockNote blocks.
 * Handles both legacy plain-text and new JSON block format.
 */
function parseNoteContent(body) {
  if (!body) return undefined; // let BlockNote use default empty doc
  try {
    const parsed = JSON.parse(body);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {
    // Legacy plain text — convert each line to a paragraph block
  }
  const lines = body.split('\n');
  return lines.map((line) => ({
    type: 'paragraph',
    content: line ? [{ type: 'text', text: line }] : [],
  }));
}

/**
 * Extract a plain-text preview from BlockNote JSON content.
 * Used for note cards in the grid view.
 */
export function getPlainTextPreview(body, maxLength = 200) {
  if (!body) return '';
  try {
    const parsed = JSON.parse(body);
    if (Array.isArray(parsed)) {
      const extractText = (content) => {
        if (!content) return '';
        if (typeof content === 'string') return content;
        if (Array.isArray(content)) return content.map(extractText).join('');
        if (content.text) return content.text;
        if (content.content) return extractText(content.content);
        return '';
      };
      const text = parsed.map((block) => extractText(block.content)).join('\n');
      return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
    }
  } catch {
    // Plain text fallback
  }
  return body.length > maxLength ? body.slice(0, maxLength) + '...' : body;
}

export default function NoteEditor({ content, onChange, theme }) {
  const initialContent = useMemo(() => parseNoteContent(content), []);

  const editor = useCreateBlockNote({ initialContent });

  const handleChange = useCallback(() => {
    if (onChange) {
      onChange(JSON.stringify(editor.document));
    }
  }, [editor, onChange]);

  return (
    <div className="note-editor-wrapper">
      <BlockNoteView
        editor={editor}
        theme={theme === 'dark' ? 'dark' : 'light'}
        onChange={handleChange}
      />
    </div>
  );
}
