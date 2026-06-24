// Input monetário com formatação em Real (R$) enquanto digita.
// Trabalha em "centavos": cada dígito digitado entra pela direita.
// value é o número em reais (ou '' quando vazio); onChange devolve number | ''.

export const formatBRLFromNumber = (v?: number | ''): string =>
  typeof v === 'number' && v > 0
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(v)
    : '';

export function CurrencyInput({
  value, onChange, className, placeholder = 'R$ 0,00', required, disabled,
}: {
  value: number | '';
  onChange: (v: number | '') => void;
  className?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <input
      type="text"
      inputMode="numeric"
      required={required}
      disabled={disabled}
      className={className}
      placeholder={placeholder}
      value={formatBRLFromNumber(value)}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, '');
        if (!digits) { onChange(''); return; }
        onChange(Number(digits) / 100);
      }}
    />
  );
}
