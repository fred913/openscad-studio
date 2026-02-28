/**
 * Individual Parameter Control Components for OpenSCAD Customizer
 */

import { type ChangeEvent, useEffect, useRef, useState } from 'react'
import type { CustomizerParam } from '../../utils/customizer/types'
import { Select } from '../ui'

interface ParameterControlProps {
  param: CustomizerParam;
  onChange: (newValue: string | number | boolean | number[]) => void;
  translatedName?: string;
  onExplain?: () => void;
  explainLabel?: string;
  explainDisabled?: boolean;
}

export function ParameterControl({ param, onChange, onExplain, explainLabel, explainDisabled }: ParameterControlProps) {
  switch (param.type) {
    case 'boolean':
      return <BooleanControl param={param} onChange={onChange} onExplain={onExplain} explainLabel={explainLabel} explainDisabled={explainDisabled} />;
    case 'slider':
      return <SliderControl param={param} onChange={onChange} onExplain={onExplain} explainLabel={explainLabel} explainDisabled={explainDisabled} />;
    case 'dropdown':
      return <DropdownControl param={param} onChange={onChange} onExplain={onExplain} explainLabel={explainLabel} explainDisabled={explainDisabled} />;
    case 'vector':
      return <VectorControl param={param} onChange={onChange} onExplain={onExplain} explainLabel={explainLabel} explainDisabled={explainDisabled} />;
    case 'string':
      return <StringControl param={param} onChange={onChange} onExplain={onExplain} explainLabel={explainLabel} explainDisabled={explainDisabled} />;
    case 'number':
    default:
      return <NumberControl param={param} onChange={onChange} onExplain={onExplain} explainLabel={explainLabel} explainDisabled={explainDisabled} />;
  }
}

function LabelText({ translatedName, originalName }: { translatedName?: string; originalName: string }) {
  const hasTranslation = !!translatedName && translatedName !== originalName;

  return (
    <>
      <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
        {translatedName || originalName}
      </span>
      {hasTranslation && (
        <span className="text-[10px] leading-tight" style={{ color: 'var(--text-tertiary)' }}>
          {originalName}
        </span>
      )}
    </>
  );
}

// Boolean checkbox control
function BooleanControl({ param, onChange, onExplain, explainLabel, explainDisabled }: ParameterControlProps) {
  const checked = Boolean(param.value);

  return (
    <div className="flex items-center gap-2 py-1">
      <input
        type="checkbox"
        id={`param-${param.name}`}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-3.5 h-3.5 rounded cursor-pointer"
        style={{
          accentColor: 'var(--accent-primary)',
        }}
      />
      <div className="flex items-center justify-between w-full gap-2">
        <label
          htmlFor={`param-${param.name}`}
          className="cursor-pointer flex flex-col"
        >
          <LabelText translatedName={param.translatedName} originalName={param.name} />
        </label>
        {onExplain && (
          <button
            type="button"
            onClick={onExplain}
            disabled={explainDisabled}
            className="text-[10px] px-2 py-0.5 rounded border"
            style={{
              borderColor: 'var(--border-primary)',
              color: 'var(--text-secondary)',
              backgroundColor: 'var(--bg-secondary)',
              opacity: explainDisabled ? 0.5 : 1,
              cursor: explainDisabled ? 'not-allowed' : 'pointer',
            }}
          >
            {explainLabel || 'Explain'}
          </button>
        )}
      </div>
    </div>
  );
}

// Number slider with input
function SliderControl({ param, onChange, onExplain, explainLabel, explainDisabled }: ParameterControlProps) {
  const min = param.min ?? 0;
  const max = param.max ?? 100;
  const step = param.step ?? 1;

  // Local state for immediate UI updates
  const [localValue, setLocalValue] = useState(Number(param.value));
  const debounceTimerRef = useRef<number | null>(null);

  // Sync local value when param value changes externally
  useEffect(() => {
    setLocalValue(Number(param.value));
  }, [param.value]);

  const handleSliderChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newValue = Number(e.target.value);
    setLocalValue(newValue);

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce: update code after 150ms of no dragging
    debounceTimerRef.current = window.setTimeout(() => {
      onChange(newValue);
    }, 150);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    // Only update local state, don't commit yet
    setLocalValue(Number(e.target.value));
  };

  const handleInputCommit = () => {
    const newValue = Number(localValue);
    if (!isNaN(newValue)) {
      const clampedValue = Math.max(min, Math.min(max, newValue));
      if (clampedValue !== param.value) {
        setLocalValue(clampedValue);
        onChange(clampedValue);
      }
    } else {
      // Reset to current value if invalid
      setLocalValue(Number(param.value));
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleInputCommit();
      e.currentTarget.blur();
    }
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="py-1.5">
      <div className="flex items-start justify-between mb-1 gap-2">
        <label
          htmlFor={`param-${param.name}`}
          className="flex flex-col"
        >
          <LabelText translatedName={param.translatedName} originalName={param.name} />
        </label>
        <div className="flex items-center gap-1.5">
          {onExplain && (
            <button
              type="button"
              onClick={onExplain}
              disabled={explainDisabled}
              className="text-[10px] px-2 py-0.5 rounded border"
              style={{
                borderColor: 'var(--border-primary)',
                color: 'var(--text-secondary)',
                backgroundColor: 'var(--bg-secondary)',
                opacity: explainDisabled ? 0.5 : 1,
                cursor: explainDisabled ? 'not-allowed' : 'pointer',
              }}
            >
              {explainLabel || 'Explain'}
            </button>
          )}
          <input
            type="number"
            value={localValue}
            onChange={handleInputChange}
            onBlur={handleInputCommit}
            onKeyDown={handleInputKeyDown}
            min={min}
            max={max}
            step={step}
            className="w-16 px-1.5 py-0.5 text-xs rounded border"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-primary)',
              color: 'var(--text-primary)',
            }}
          />
        </div>
      </div>
      <input
        type="range"
        id={`param-${param.name}`}
        value={localValue}
        onChange={handleSliderChange}
        min={min}
        max={max}
        step={step}
        className="w-full h-1.5 rounded-lg appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, var(--accent-primary) 0%, var(--accent-primary) ${((localValue - min) / (max - min)) * 100}%, var(--bg-tertiary) ${((localValue - min) / (max - min)) * 100}%, var(--bg-tertiary) 100%)`,
        }}
      />
      <div
        className="flex justify-between mt-0.5"
        style={{ color: 'var(--text-secondary)', fontSize: '10px' }}
      >
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

// Dropdown select
function DropdownControl({ param, onChange, onExplain, explainLabel, explainDisabled }: ParameterControlProps) {
  const value = String(param.value);

  return (
    <div className="py-1.5">
      <div className="mb-1 flex items-start justify-between gap-2">
        <label
          htmlFor={`param-${param.name}`}
          className="block flex flex-col"
        >
          <LabelText translatedName={param.translatedName} originalName={param.name} />
        </label>
        {onExplain && (
          <button
            type="button"
            onClick={onExplain}
            disabled={explainDisabled}
            className="text-[10px] px-2 py-0.5 rounded border"
            style={{
              borderColor: 'var(--border-primary)',
              color: 'var(--text-secondary)',
              backgroundColor: 'var(--bg-secondary)',
              opacity: explainDisabled ? 0.5 : 1,
              cursor: explainDisabled ? 'not-allowed' : 'pointer',
            }}
          >
            {explainLabel || 'Explain'}
          </button>
        )}
      </div>
      <Select
        id={`param-${param.name}`}
        value={value}
        onChange={(e) => {
          const option = param.options?.find((opt) => String(opt.value) === e.target.value);
          if (option) {
            onChange(option.value);
          }
        }}
        size="sm"
      >
        {param.options?.map((option) => (
          <option key={String(option.value)} value={String(option.value)}>
            {option.label}
          </option>
        ))}
      </Select>
    </div>
  );
}

// Simple number input (spinbox)
function NumberControl({ param, onChange, onExplain, explainLabel, explainDisabled }: ParameterControlProps) {
  const [localValue, setLocalValue] = useState(String(param.value));

  // Sync local value when param value changes externally
  useEffect(() => {
    setLocalValue(String(param.value));
  }, [param.value]);

  const handleCommit = () => {
    const newValue = Number(localValue);
    if (!isNaN(newValue) && newValue !== param.value) {
      onChange(newValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleCommit();
      e.currentTarget.blur();
    }
  };

  return (
    <div className="py-1.5">
      <div className="mb-1 flex items-start justify-between gap-2">
        <label
          htmlFor={`param-${param.name}`}
          className="block flex flex-col"
        >
          <LabelText translatedName={param.translatedName} originalName={param.name} />
        </label>
        {onExplain && (
          <button
            type="button"
            onClick={onExplain}
            disabled={explainDisabled}
            className="text-[10px] px-2 py-0.5 rounded border"
            style={{
              borderColor: 'var(--border-primary)',
              color: 'var(--text-secondary)',
              backgroundColor: 'var(--bg-secondary)',
              opacity: explainDisabled ? 0.5 : 1,
              cursor: explainDisabled ? 'not-allowed' : 'pointer',
            }}
          >
            {explainLabel || 'Explain'}
          </button>
        )}
      </div>
      <input
        type="number"
        id={`param-${param.name}`}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleCommit}
        onKeyDown={handleKeyDown}
        className="w-full px-2 py-1 text-xs rounded border"
        style={{
          backgroundColor: 'var(--bg-elevated)',
          borderColor: 'var(--border-primary)',
          color: 'var(--text-primary)',
        }}
      />
    </div>
  );
}

// String text input
function StringControl({ param, onChange, onExplain, explainLabel, explainDisabled }: ParameterControlProps) {
  const [localValue, setLocalValue] = useState(String(param.value));

  // Sync local value when param value changes externally
  useEffect(() => {
    setLocalValue(String(param.value));
  }, [param.value]);

  const handleCommit = () => {
    if (localValue !== param.value) {
      onChange(localValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleCommit();
      e.currentTarget.blur();
    }
  };

  return (
    <div className="py-1.5">
      <div className="mb-1 flex items-start justify-between gap-2">
        <label
          htmlFor={`param-${param.name}`}
          className="block flex flex-col"
        >
          <LabelText translatedName={param.translatedName} originalName={param.name} />
        </label>
        {onExplain && (
          <button
            type="button"
            onClick={onExplain}
            disabled={explainDisabled}
            className="text-[10px] px-2 py-0.5 rounded border"
            style={{
              borderColor: 'var(--border-primary)',
              color: 'var(--text-secondary)',
              backgroundColor: 'var(--bg-secondary)',
              opacity: explainDisabled ? 0.5 : 1,
              cursor: explainDisabled ? 'not-allowed' : 'pointer',
            }}
          >
            {explainLabel || 'Explain'}
          </button>
        )}
      </div>
      <input
        type="text"
        id={`param-${param.name}`}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleCommit}
        onKeyDown={handleKeyDown}
        className="w-full px-2 py-1 text-xs rounded border"
        style={{
          backgroundColor: 'var(--bg-elevated)',
          borderColor: 'var(--border-primary)',
          color: 'var(--text-primary)',
        }}
      />
    </div>
  );
}

// Vector input (array of numbers)
function VectorControl({ param, onChange, onExplain, explainLabel, explainDisabled }: ParameterControlProps) {
  const values = Array.isArray(param.value) ? param.value : [];
  const [localValues, setLocalValues] = useState(values.map(String));

  // Sync local values when param value changes externally
  useEffect(() => {
    setLocalValues(values.map(String));
  }, [param.value]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCommit = (index: number) => {
    const num = Number(localValues[index]);
    if (!isNaN(num) && num !== values[index]) {
      const newValues = [...values];
      newValues[index] = num;
      onChange(newValues);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleCommit(index);
      e.currentTarget.blur();
    }
  };

  const handleLocalChange = (index: number, newValue: string) => {
    const newLocalValues = [...localValues];
    newLocalValues[index] = newValue;
    setLocalValues(newLocalValues);
  };

  return (
    <div className="py-1.5">
      <div className="mb-0.5 flex items-start justify-between gap-2">
        <label className="block flex flex-col">
          <LabelText translatedName={param.translatedName} originalName={param.name} />
        </label>
        {onExplain && (
          <button
            type="button"
            onClick={onExplain}
            disabled={explainDisabled}
            className="text-[10px] px-2 py-0.5 rounded border"
            style={{
              borderColor: 'var(--border-primary)',
              color: 'var(--text-secondary)',
              backgroundColor: 'var(--bg-secondary)',
              opacity: explainDisabled ? 0.5 : 1,
              cursor: explainDisabled ? 'not-allowed' : 'pointer',
            }}
          >
            {explainLabel || 'Explain'}
          </button>
        )}
      </div>
      <div className="flex gap-1">
        {values.map((_val, idx) => (
          <input
            key={idx}
            type="number"
            value={localValues[idx]}
            onChange={(e) => handleLocalChange(idx, e.target.value)}
            onBlur={() => handleCommit(idx)}
            onKeyDown={(e) => handleKeyDown(idx, e)}
            className="flex-1 px-1.5 py-0.5 text-xs rounded border"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-primary)',
              color: 'var(--text-primary)',
            }}
            placeholder={`[${idx}]`}
          />
        ))}
      </div>
    </div>
  );
}
