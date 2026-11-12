// Cấu hình trình bày chung cho mọi loại biểu đồ (bước 3)

export const DEFAULT_DESCRIPTION = 'Dữ liệu: Người Quan Sát';

export const DEFAULT_SETTINGS = {
  title: '',
  subtitle: '',
  description: DEFAULT_DESCRIPTION,
  theme: 'light',
  language: 'vi',
  sizePreset: '16:9',
  width: 1200,
  height: 675,
  showAxes: true,
  showGrid: true,
  interactions: { tooltip: true, highlight: true, legendToggle: true, zoomPan: false },
  titleColor: null,
  textColor: null,
  insideColor: null,
  titleSize: 26,
  labelSize: 14,
  dataSize: 15,
  lineLabelColor: null,
  useLogo: false,
  logoAliases: {},
};

const SIZE_PRESETS = {
  '16:9': { label: '16:9 (1200 × 675)', width: 1200, height: 675 },
  '4:3': { label: '4:3 (1200 × 900)', width: 1200, height: 900 },
  '1:1': { label: '1:1 (1000 × 1000)', width: 1000, height: 1000 },
};

const INTERACTION_LABELS = [
  { key: 'tooltip', label: 'Tooltip khi rê chuột' },
  { key: 'highlight', label: 'Highlight phần tử khi rê chuột' },
  { key: 'legendToggle', label: 'Bật/tắt chuỗi qua chú giải' },
  { key: 'zoomPan', label: 'Zoom và pan' },
];

const SIZE_MIN = 300;
const SIZE_MAX = 3000;

export default function PresentationForm({ spec, settings, onChange }) {
  const set = (key, value) => onChange({ ...settings, [key]: value });

  const setInteraction = (key, value) =>
    onChange({ ...settings, interactions: { ...settings.interactions, [key]: value } });

  const setPreset = (preset) => {
    const p = SIZE_PRESETS[preset];
    if (!p) return;
    onChange({ ...settings, sizePreset: preset, width: p.width, height: p.height });
  };

  const setSize = (key, raw) => {
    if (raw === '') {
      onChange({ ...settings, [key]: null, sizePreset: 'custom' });
      return;
    }
    const n = Math.min(SIZE_MAX, Math.max(SIZE_MIN, Number(raw)));
    onChange({ ...settings, [key]: n, sizePreset: 'custom' });
  };

  const availableInteractions = INTERACTION_LABELS.filter((i) =>
    spec.interactions.includes(i.key)
  );
  const hasAxes = spec.id !== 'pie';

  return (
    <div>
      <section>
        <h3>Nội dung</h3>
        <div className="options-grid">
          <Field label="Tiêu đề">
            <input type="text" value={settings.title} onChange={(e) => set('title', e.target.value)} />
          </Field>
          <Field label="Phụ đề">
            <input type="text" value={settings.subtitle} onChange={(e) => set('subtitle', e.target.value)} />
          </Field>
          <Field label="Mô tả / nguồn">
            <input type="text" value={settings.description ?? ''} placeholder={DEFAULT_DESCRIPTION} onChange={(e) => set('description', e.target.value)} />
          </Field>
        </div>
      </section>

      <section>
        <h3>Xem trước tiêu đề</h3>
        <div className="head-preview">
          <div className="hp-title">{settings.title || 'Tiêu đề biểu đồ'}</div>
          {settings.subtitle && <div className="hp-sub">{settings.subtitle}</div>}
          <div className="hp-desc">{settings.description ?? DEFAULT_DESCRIPTION}</div>
        </div>
      </section>

      <section>
        <h3>Kích thước</h3>
        <div className="options-grid">
          <Field label="Tỷ lệ khung hình">
            <select
              value={settings.sizePreset}
              onChange={(e) => setPreset(e.target.value)}
            >
              {Object.entries(SIZE_PRESETS).map(([key, p]) => (
                <option key={key} value={key}>{p.label}</option>
              ))}
              <option value="custom" disabled>Tùy chỉnh</option>
            </select>
          </Field>
          <Field label={`Chiều rộng (px, ${SIZE_MIN}–${SIZE_MAX})`}>
            <input type="number" min={SIZE_MIN} max={SIZE_MAX} value={settings.width ?? ''}
              onChange={(e) => setSize('width', e.target.value)} />
          </Field>
          <Field label={`Chiều cao (px, ${SIZE_MIN}–${SIZE_MAX})`}>
            <input type="number" min={SIZE_MIN} max={SIZE_MAX} value={settings.height ?? ''}
              onChange={(e) => setSize('height', e.target.value)} />
          </Field>
        </div>
      </section>

      {hasAxes && (
        <section>
          <h3>Hiển thị</h3>
          <div className="options-grid">
            <CheckField label="Hiện trục tọa độ" checked={settings.showAxes}
              onChange={(v) => set('showAxes', v)} />
            <CheckField label="Hiện đường lưới" checked={settings.showGrid}
              onChange={(v) => set('showGrid', v)} />
          </div>
        </section>
      )}

      {availableInteractions.length > 0 && (
        <section>
          <h3>Tương tác</h3>
          <div className="options-grid">
            {availableInteractions.map((i) => (
              <CheckField
                key={i.key}
                label={i.label}
                checked={!!settings.interactions[i.key]}
                onChange={(v) => setInteraction(i.key, v)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}

function CheckField({ label, checked, onChange }) {
  return (
    <label className="check-field">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

