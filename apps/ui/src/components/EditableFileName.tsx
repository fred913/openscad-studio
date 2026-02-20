import { useCallback, useEffect, useRef, useState } from 'react';

interface EditableFileNameProps {
  name: string;
  isDirty: boolean;
  onRename: (newName: string) => void;
}

export function EditableFileName({ name, isDirty, onRename }: EditableFileNameProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.select();
    }
  }, [editing]);

  useEffect(() => {
    if (!editing) setDraft(name);
  }, [name, editing]);

  const commit = useCallback(() => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== name) {
      onRename(trimmed);
    }
    setEditing(false);
  }, [draft, name, onRename]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') {
            setDraft(name);
            setEditing(false);
          }
        }}
        className="px-3 py-1 text-sm bg-transparent outline-none"
        style={{
          color: 'var(--text-primary)',
          border: '1px solid var(--accent-primary)',
          borderRadius: '4px',
          minWidth: '80px',
          maxWidth: '300px',
        }}
        spellCheck={false}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="px-3 py-1 text-sm truncate rounded transition-colors"
      style={{ color: 'var(--text-secondary)', cursor: 'text' }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
      }}
      title="Click to rename"
    >
      {name}
      {isDirty ? ' •' : ''}
    </button>
  );
}
