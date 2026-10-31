"use client";

import { Input } from "../../ui/input";

interface IterativeRepetitionInputProps {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}

/**
 * Number input for the target repetition count.
 * Minimum value: 2.
 */
export const IterativeRepetitionInput = ({ value, onChange, disabled }: IterativeRepetitionInputProps) => {
  return (
    <div className="space-y-2">
      <label htmlFor="num-repetitions" className="text-sm font-medium">
        Number of Repetitions
      </label>
      <Input
        id="num-repetitions"
        type="number"
        min={2}
        step={1}
        value={value}
        onChange={(e) => {
          const v = parseInt(e.target.value, 10);
          if (!isNaN(v)) onChange(v);
        }}
        disabled={disabled}
        className="w-32"
      />
      <p className="text-xs text-muted-foreground">
        Must be at least 2. The resolution will be completed when you reach this count.
      </p>
    </div>
  );
};
