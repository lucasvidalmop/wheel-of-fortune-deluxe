import { useEffect, useRef, useState, type CSSProperties } from 'react';

interface MoneyInputProps {
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  className?: string;
  style?: CSSProperties;
  ariaLabel?: string;
  name?: string;
}

const fmtBRL = (n: number) =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const parseBRL = (raw: string): number => {
  if (!raw) return 0;
  // Keep digits, comma and dot only
  let s = raw.replace(/[^0-9.,]/g, '');
  // If both '.' and ',' present, assume '.' is thousands separator
  if (s.includes('.') && s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Free-typing money input. While focused, the user can type any number
 * (e.g. "50" -> R$ 50,00; "50,75" -> R$ 50,75). On blur, the value is
 * normalized and formatted as BRL.
 */
export default function MoneyInput({
  value,
  onChange,
  placeholder = '0,00',
  className,
  style,
  ariaLabel,
  name,
}: MoneyInputProps) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState<string>('');
  const lastExternalValue = useRef(value);

  // When external value changes while not focused, keep local draft in sync
  useEffect(() => {
    if (!focused) {
      lastExternalValue.current = value;
    }
  }, [value, focused]);

  const displayed = focused
    ? draft
    : value
    ? fmtBRL(value)
    : '';

  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      name={name}
      value={displayed}
      placeholder={placeholder}
      onFocus={(e) => {
        setFocused(true);
        setDraft(value ? String(value).replace('.', ',') : '');
        // Select all so user can immediately overwrite
        requestAnimationFrame(() => {
          try { e.target.select(); } catch { /* ignore */ }
        });
      }}
      onChange={(e) => {
        const raw = e.target.value;
        // Allow only digits, comma and dot
        const cleaned = raw.replace(/[^0-9.,]/g, '');
        setDraft(cleaned);
        onChange(parseBRL(cleaned));
      }}
      onBlur={() => {
        const n = parseBRL(draft);
        onChange(n);
        setFocused(false);
        setDraft('');
      }}
      className={className}
      style={style}
      aria-label={ariaLabel}
    />
  );
}
