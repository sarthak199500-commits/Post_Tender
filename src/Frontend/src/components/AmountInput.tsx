import React, { useLayoutEffect, useRef, useState } from 'react';
import { groupIndianDigits, stripGrouping } from '../utils/currency';

/**
 * Money input that shows Indian digit grouping as you type: 12000000 -> 1,20,00,000.
 *
 * type="text" rather than type="number" — a number input rejects commas outright, which
 * is why these fields used to show an unreadable run of digits. inputMode="decimal" still
 * brings up the numeric keypad on mobile.
 *
 * `value` is the canonical unformatted string the parent stores and submits; only the
 * display carries separators, so nothing has to be un-formatted before the API call.
 *
 * Use this for currency only. Years, months, counts and percentages must NOT be grouped
 * ("2,010" is not a year), so those stay plain number inputs.
 */
// Digits and the decimal point are the characters the caret is positioned against;
// separators are cosmetic. No /g flag — .test() would then be stateful across calls.
const SIGNIFICANT = /[\d.]/;

interface AmountInputProps {
    value: string | number;
    onValueChange: (value: string) => void;
    id?: string;
    placeholder?: string;
    className?: string;
    required?: boolean;
    disabled?: boolean;
    onBlur?: () => void;
    'aria-label'?: string;
}

export const AmountInput: React.FC<AmountInputProps> = ({
    value,
    onValueChange,
    id,
    placeholder,
    className,
    required,
    disabled,
    onBlur,
    'aria-label': ariaLabel,
}) => {
    const ref = useRef<HTMLInputElement>(null);
    // Where the caret should land after re-render, counted in significant characters
    // rather than raw index — inserting a comma shifts every index after it, so a raw
    // index would drift and the caret would jump to the end on every keystroke.
    //
    // "Significant" must include the decimal point, not just digits: counting digits
    // alone parks the caret before a trailing ".", so typing 1234.56 sent the 5 and 6
    // into the integer part and produced 1,23,456.
    const [sigBeforeCaret, setSigBeforeCaret] = useState<number | null>(null);

    const display = groupIndianDigits(String(value ?? ''));

    useLayoutEffect(() => {
        if (sigBeforeCaret === null || !ref.current) return;
        const el = ref.current;
        let pos = 0;
        let seen = 0;
        while (pos < el.value.length && seen < sigBeforeCaret) {
            if (SIGNIFICANT.test(el.value[pos])) seen++;
            pos++;
        }
        el.setSelectionRange(pos, pos);
        setSigBeforeCaret(null);
    }, [sigBeforeCaret, display]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const el = e.target;
        const caret = el.selectionStart ?? el.value.length;
        setSigBeforeCaret(el.value.slice(0, caret).replace(/[^\d.]/g, '').length);
        onValueChange(stripGrouping(el.value));
    };

    return (
        <input
            ref={ref}
            id={id}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={display}
            onChange={handleChange}
            onBlur={onBlur}
            placeholder={placeholder}
            className={className}
            required={required}
            disabled={disabled}
            aria-label={ariaLabel}
        />
    );
};
