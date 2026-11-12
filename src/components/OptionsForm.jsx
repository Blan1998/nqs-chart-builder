import { useState } from 'react';

const CHOICE_LABELS = {
  circle: 'Tròn',
  square: 'Vuông',
  diamond: 'Thoi',
  triangle: 'Tam giác',
  star: 'Ngôi sao',
  pie: 'Tròn',
  donut: 'Vành khuyên',
  percent: 'Phần trăm',
  value: 'Giá trị',
  vertical: 'Dọc',
  horizontal: 'Ngang',
  none: 'Không sắp xếp',
  asc: 'Tăng dần',
  desc: 'Giảm dần',
  solid: 'Liền',
  dashed: 'Gạch đứt',
  dotted: 'Chấm',
  linear: 'Thẳng',
  monotone: 'Mượt',
  step: 'Bậc thang',
};

// Form tùy chọn sinh tự động từ trường "options" của file đặc tả
export default function OptionsForm({ spec, values, onChange }) {
  return (
    <div className="options-grid">
      {spec.options.map((opt) => (
        <Field
          key={opt.key}
          opt={opt}
          value={values[opt.key]}
          onChange={(v) => onChange(opt.key, v)}
        />
      ))}
    </div>
  );
}

function Field({ opt, value, onChange }) {
  const id = `opt-${opt.key}`;
  const [error, setError] = useState('');

  let input;
  switch (opt.type) {
    case 'select':
      input = (
        <select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
          {opt.choices.map((c) => (
            <option key={c} value={c}>
              {CHOICE_LABELS[c] ?? c}
            </option>
          ))}
        </select>
      );
      break;

    case 'boolean':
      input = (
        <input
          id={id}
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
        />
      );
      break;

    case 'number':
      input = (
        <input
          id={id}
          type="number"
          value={value ?? ''}
          onChange={(e) => {
            if (e.target.value === '') {
              setError('');
              onChange(null);
              return;
            }
            let n = Number(e.target.value);
            if (opt.min !== undefined && n < opt.min) {
              setError(`Tối thiểu là ${opt.min}`);
              n = opt.min;
            } else if (opt.max !== undefined && n > opt.max) {
              setError(`Tối đa là ${opt.max}`);
              n = opt.max;
            } else {
              setError('');
            }
            onChange(n);
          }}
        />
      );
      break;

    case 'text':
      input = (
        <input
          id={id}
          type="text"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
      break;

    case 'category-ref':
      input = (
        <input
          id={id}
          type="text"
          placeholder="Để trống nếu không nhấn mạnh"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
        />
      );
      break;

    default:
      input = <span>Chưa hỗ trợ kiểu "{opt.type}"</span>;
  }

  return (
    <div className="field">
      <label htmlFor={id}>{opt.label}</label>
      {input}
      {error && <small className="field-error">{error}</small>}
    </div>
  );
}
