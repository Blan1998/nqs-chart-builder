import { useState } from 'react';
import { CHART_SPECS } from './specs/index.js';
import OptionsForm from './components/OptionsForm.jsx';
import PresentationForm, { DEFAULT_SETTINGS } from './components/PresentationForm.jsx';
import DataStep from './components/DataStep.jsx';
import Home from './components/Home.jsx';
import logoImg from './assets/logo.svg';
import SvgStep from './components/SvgStep.jsx';
import { validateRows } from './lib/dataUtils.js';
import { blankSeries, wideSpecFor } from './lib/wide.js';

const STEPS = [
  { id: 1, label: 'Chọn loại biểu đồ' },
  { id: 2, label: 'Tùy chọn theo loại' },
  { id: 3, label: 'Thiết lập trình bày' },
  { id: 4, label: 'Nhập dữ liệu' },
  { id: 5, label: 'Tạo và xuất SVG' },
];

function defaultsFor(spec) {
  return Object.fromEntries(spec.options.map((o) => [o.key, o.default ?? null]));
}

export default function App() {
  const [step, setStep] = useState(1);
  const [chartId, setChartId] = useState(null);
  const [optionsByChart, setOptionsByChart] = useState({});
  const [dataByChart, setDataByChart] = useState({});
  const [colorsByChart, setColorsByChart] = useState({});
  const [seriesByChart, setSeriesByChart] = useState({});
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [message, setMessage] = useState('');
  const [sideW, setSideW] = useState(280);
  const [resetKey, setResetKey] = useState(0);

  // Kéo mép phải của menu để đổi độ rộng; khi menu hẹp, phần nội dung rộng ra
  function startResize(e) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = sideW;
    const move = (ev) => setSideW(Math.min(360, Math.max(84, startW + ev.clientX - startX)));
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }


  const spec = chartId ? CHART_SPECS[chartId] : null;
  const options = spec ? optionsByChart[chartId] ?? defaultsFor(spec) : {};
  const rows = spec ? dataByChart[chartId] ?? [{}] : [];
  const series = spec && (spec.id === 'groupedBar' || spec.id === 'combo' || spec.id === 'stackedBar' || spec.id === 'stackedArea' || spec.id === 'barRace' || spec.id === 'lineRank') ? seriesByChart[chartId] ?? blankSeries(spec) : null;
  const gridSpec = spec ? (series ? wideSpecFor(spec, series) : spec) : null;
  const errors = gridSpec ? validateRows(gridSpec, rows) : [];
  const colors = spec ? colorsByChart[chartId] ?? {} : {};

  function chooseChart(id) {
    setChartId(id);
    setStep(2);
  }

  function updateOption(key, value) {
    setOptionsByChart((prev) => ({ ...prev, [chartId]: { ...options, [key]: value } }));
  }

  function updateSeries(nextSeries, nextRows) {
    setSeriesByChart((prev) => ({ ...prev, [chartId]: nextSeries }));
    setDataByChart((prev) => ({ ...prev, [chartId]: nextRows }));
  }

  function updateColors(newColors) {
    setColorsByChart((prev) => ({ ...prev, [chartId]: newColors }));
  }

  function updateRows(newRows) {
    setDataByChart((prev) => ({ ...prev, [chartId]: newRows }));
  }

  // Làm lại từ đầu: xóa toàn bộ lựa chọn, dữ liệu, màu và thiết lập, quay về bước 1
  function resetAll() {
    if (!window.confirm('Làm lại từ đầu? Toàn bộ lựa chọn, dữ liệu và thiết lập hiện tại sẽ bị xóa (file đã lưu không bị ảnh hưởng).')) return;
    setChartId(null);
    setOptionsByChart({});
    setDataByChart({});
    setColorsByChart({});
    setSeriesByChart({});
    setSettings(DEFAULT_SETTINGS);
    setStep(1);
    setResetKey((k) => k + 1);
    setMessage('Đã đặt lại, bắt đầu từ đầu.');
  }

  // Vị trí các mục menu căn theo ảnh nền (5 bước, rơi vào các số 1–5 đã có sẵn trên ảnh)
  return (
    <div className="layout" style={{ gridTemplateColumns: `${sideW}px 6px minmax(0, 1fr)` }}>
      <aside className={sideW < 150 ? 'sidebar compact' : 'sidebar'}>
        <nav className="sidebar-nav">
          {STEPS.map((s) => (
            <button
              key={s.id}
              className={step === s.id ? 'step-btn active' : 'step-btn'}
              onClick={() => setStep(s.id)}
              disabled={s.id > 1 && !chartId}
              title={s.label}
            >
              <span className="step-num">{s.id}</span>
              <span className="step-label">{s.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-tools">
          <button className="reset-btn" onClick={resetAll}>Reset</button>
          {message && <p className="status">{message}</p>}
        </div>

        <div className="sidebar-brand">
          <img className="sidebar-logo" src={logoImg} alt="NQS Chart Builder" />
          <div className="sidebar-version">version {__APP_VERSION__}</div>
        </div>
      </aside>

      <div className="resizer" onMouseDown={startResize} title="Kéo để đổi độ rộng menu" />

      <main className="main" key={resetKey}>
        {step === 1 && (
          <Home
            charts={Object.values(CHART_SPECS)}
            selectedId={chartId}
            onSelect={setChartId}
            onCreate={() => setStep(2)}
          />
        )}

        {step === 2 && spec && (
          <div className="card">
            <h2>Tùy chọn: {spec.label}</h2>
            <OptionsForm spec={spec} values={options} onChange={updateOption} />
            <details className="debug">
              <summary>Cấu hình hiện tại (để kiểm tra)</summary>
              <pre>{JSON.stringify(options, null, 2)}</pre>
            </details>
            <div className="actions">
              <button onClick={() => setStep(3)}>Tiếp tục</button>
            </div>
          </div>
        )}

        {step === 3 && spec && (
          <div className="card">
            <h2>Thiết lập trình bày: {spec.label}</h2>
            <PresentationForm spec={spec} settings={settings} onChange={setSettings} />
            <details className="debug">
              <summary>Thiết lập hiện tại (để kiểm tra)</summary>
              <pre>{JSON.stringify(settings, null, 2)}</pre>
            </details>
            <div className="actions">
              <button onClick={() => setStep(4)}>Tiếp tục</button>
            </div>
          </div>
        )}

        {step === 4 && spec && (
          <div className="card">
            <h2>Nhập dữ liệu: {spec.label}</h2>
            <DataStep
              spec={gridSpec}
              rows={rows}
              onRowsChange={updateRows}
              series={series ?? undefined}
              onSeriesChange={updateSeries}
              settings={settings}
              onSettingsChange={setSettings}
            />
            <div className="actions">
              <button onClick={() => setStep(5)} disabled={errors.some((e) => e.level === 'error')}>Tiếp tục</button>
              {errors.some((e) => e.level === 'error') && <span className="hint-inline">Cần nhập dữ liệu để tiếp tục.</span>}
            </div>
          </div>
        )}

        {step >= 2 && step <= 5 && !spec && (
          <div className="card">
            <p>Chọn loại biểu đồ ở bước 1 trước.</p>
          </div>
        )}

        {step === 5 && spec && (
          <div className="card">
            <h2>Tạo và xuất SVG: {spec.label}</h2>
            <SvgStep
              spec={gridSpec}
              settings={settings}
              options={options}
              rows={rows}
              errors={errors}
              colors={colors}
              onColorsChange={updateColors}
              onSettingsChange={setSettings}
              onOptionChange={updateOption}
            />
          </div>
        )}
      </main>
    </div>
  );
}
