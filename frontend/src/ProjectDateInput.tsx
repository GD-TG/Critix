import { TextInput } from "@mantine/core";
import { fromDateInput, hasOffset, toDateInput } from "./dateInput";

export function ProjectDateInput({
  label,
  value,
  zone,
  onChange,
  required = false,
}: {
  label: string;
  value: string | null;
  zone: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <TextInput
      label={label}
      description={zone}
      type="datetime-local"
      required={required}
      value={toDateInput(value || "", zone)}
      error={
        value && !hasOffset(value)
          ? "Это местное время отсутствует или неоднозначно. Выберите другое время."
          : undefined
      }
      onChange={(event) => {
        const local = event.target.value;
        try {
          onChange(fromDateInput(local, zone));
        } catch {
          // Preserve invalid input visibly; the API rejects dates without offsets.
          onChange(local);
        }
      }}
    />
  );
}
