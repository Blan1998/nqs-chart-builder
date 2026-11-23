// Cấu hình trình bày chung cho mọi loại biểu đồ (bước 3)

export const TITLE_MAX = 60;

export const DEFAULT_DESCRIPTION = 'Dữ liệu: Người Quan Sát';

export const DEFAULT_SETTINGS = {
  title: '',
  subtitle: '',
  description: DEFAULT_DESCRIPTION,
  theme: 'light',
  language: 'vi',
  width: 1000,
  height: null, // để trống = tự dãn theo nội dung
  pad: 2, // lề phải của biểu đồ (px); lề trái = lề phải + 6
  showAxes: true,
  showGrid: true,
  showBrandLogo: true,
  changeCol: { on: false, curId: null, baseId: null, title: 'Tăng/giảm' },
  interactions: { tooltip: true, highlight: true, legendToggle: true, zoomPan: false },
  titleColor: null,
  textColor: null,
  insideColor: null,
  bgColor: null,
  titleSize: 35,
  labelSize: 16,
  dataSize: 18,
  lineLabelColor: null,
  useLogo: false,
  logoAliases: {},
};

const INTERACTION_LABELS = [
  { key: 'tooltip', label: 'Tooltip khi rê chuột' },
  { key: 'highlight', label: 'Highlight phần tử khi rê chuột' },
  { key: 'legendToggle', label: 'Bật/tắt chuỗi qua chú giải' },
  { key: 'zoomPan', label: 'Zoom và pan' },
];

export default function PresentationForm({ spec, settings, onChange }) {
  const set = (key, value) => onChange({ ...settings, [key]: value });

  const setInteraction = (key, value) =>
    onChange({ ...settings, interactions: { ...settings.interactions, [key]: value } });

  const availableInteractions = INTERACTION_LABELS.filter((i) =>
    spec.interactions.includes(i.key)
  );
  const hasAxes = spec.id !== 'pie';

  return (
    <div>
      <section>
        <h3>Nội dung</h3>
        <div className="options-grid content-grid">
          <Field label="Tiêu đề">
            <input type="text" maxLength={TITLE_MAX} value={settings.title} onChange={(e) => set('title', e.target.value.slice(0, TITLE_MAX))} />
            {(settings.title || '').length > TITLE_MAX && (
              <span className="field-error">Tiêu đề dài {(settings.title || '').length} ký tự, nên giữ tối đa {TITLE_MAX} ký tự.</span>
            )}
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
        <h3>Hiển thị và tương tác</h3>
        <div className="check-row">
          {hasAxes && (
            <>
              <CheckField label="Hiện trục tọa độ" checked={settings.showAxes}
                onChange={(v) => set('showAxes', v)} />
              <CheckField label="Hiện đường lưới" checked={settings.showGrid}
                onChange={(v) => set('showGrid', v)} />
            </>
          )}
          <CheckField label="Hiện logo NQS DATA" checked={settings.showBrandLogo !== false}
            onChange={(v) => set('showBrandLogo', v)} />
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

