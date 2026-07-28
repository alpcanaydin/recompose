import { Radio } from '@base-ui/react/radio';
import { RadioGroup } from '@base-ui/react/radio-group';

type SegmentedControlOption<Value extends string> = {
  /** Value committed when this segment wins. */
  value: Value;
  /** Text the segment shows and answers to. */
  label: string;
};

type SegmentedControlProps<Value extends string> = {
  /** Accessible name of the whole choice. */
  label: string;
  /** Controlled selection. */
  value: Value;
  /** The mutually exclusive choices, in reading order. */
  options: readonly SegmentedControlOption<Value>[];
  /** Receives the choice the person landed on. */
  onChangeValue: (value: Value) => void;
  /** Marks a choice whose machinery is missing, keeping it reachable but unmovable. */
  inert?: boolean;
};

/**
 * One of a few mutually exclusive choices, laid out side by side.
 *
 * @summary Reach for it over a select when the options are few and worth reading at a glance.
 */
export function SegmentedControl<Value extends string>({
  label,
  value,
  options,
  onChangeValue,
  inert = false,
}: SegmentedControlProps<Value>) {
  return (
    <RadioGroup
      aria-disabled={inert || undefined}
      aria-label={label}
      className="inline-flex h-[24px] items-center gap-[2px] rounded-control border border-line-subtle bg-surface-content p-[2px] aria-disabled:cursor-not-allowed aria-disabled:bg-surface-inert"
      onValueChange={(next) => {
        if (inert) {
          return;
        }

        onChangeValue(next);
      }}
      value={value}
    >
      {options.map((option) => (
        <Radio.Root
          className="flex h-[18px] cursor-default items-center rounded-chip px-2 text-control text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent data-checked:bg-surface-raised data-checked:font-medium data-checked:shadow-sm"
          key={option.value}
          value={option.value}
        >
          {option.label}
        </Radio.Root>
      ))}
    </RadioGroup>
  );
}
