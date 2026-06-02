// AIGC START
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ImagePreview } from './components/ReviewCard';
import { TableFieldSummary } from './components/TableFieldSummary';
import { SettingsPanel } from './components/SettingsPanel';
import { PLUGIN_TITLE } from './constants';
import { useBitableRecord } from './hooks/useBitableRecord';
import { useTheme } from './hooks/useTheme';
import { generateImage } from './services/nanoBanana';
import type { PluginSettings, RecordJobSnapshot } from './types';
import { copyToClipboard } from './utils/clipboard';
import { toChineseError } from './utils/errorMessage';
import { loadSettings, saveSettings } from './utils/settings';

function App() {
  useTheme();
  const [settings, setSettings] = useState<PluginSettings>(loadSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const {
    state,
    setState,
    mapping,
    tableHint,
    loadRecord,
    createJobSnapshot,
    addGeneratingRecord,
    removeGeneratingRecord,
    persistPrompt,
    persistStatus,
    persistGeneratedImage,
  } = useBitableRecord();

  useEffect(() => {
    setPrompt(state.prompt);
  }, [state.recordId, state.prompt]);

  const updateSettings = useCallback((s: PluginSettings) => {
    setSettings(s);
    saveSettings(s);
  }, []);

  const { aspectRatio, imageSize, imageModel } = state.generateParams;

  const isCurrentGenerating = state.recordId
    ? state.generatingRecordIds.includes(state.recordId)
    : false;

  const tags = useMemo(
    () => [
      state.recordTitle || state.recordId?.slice(0, 10) || '未选记录',
      imageModel,
      `${aspectRatio} · ${imageSize}`,
      state.generateParams.statusLabel
        ? `状态: ${state.generateParams.statusLabel}`
        : '',
      state.generatingRecordIds.length
        ? `后台生图中 ${state.generatingRecordIds.length} 条`
        : '',
    ].filter(Boolean),
    [state, aspectRatio, imageSize, imageModel],
  );

  const runGenerateJob = async (job: RecordJobSnapshot) => {
    await persistPrompt(job.prompt, job.recordId);
    await persistStatus('生成中', job.recordId);

    const res = await generateImage(
      {
        ...settings,
        imageModel: job.imageModel,
        aspectRatio: job.aspectRatio,
        imageSize: job.imageSize,
      },
      {
        prompt: job.prompt,
        images: job.referenceImageUrls,
        aspectRatio: job.aspectRatio,
        imageSize: job.imageSize,
      },
    );

    if (res.status === 'succeeded' && res.results?.[0]?.url) {
      const url = res.results[0].url;
      if (mapping.resultImageFieldId) {
        try {
          const urls = await persistGeneratedImage(url, job.recordId);
          await persistStatus('成功', job.recordId);
          return {
            ok: true as const,
            recordId: job.recordId,
            previewUrl: urls[0] ?? url,
            message: `记录 ${job.recordId.slice(0, 8)}… 生图成功，已写入结果图`,
          };
        } catch (writeErr) {
          await persistStatus('成功', job.recordId);
          return {
            ok: true as const,
            recordId: job.recordId,
            previewUrl: url,
            message: `记录 ${job.recordId.slice(0, 8)}… 生图成功，写回结果图失败：${toChineseError(writeErr)}`,
          };
        }
      }
      return {
        ok: true as const,
        recordId: job.recordId,
        previewUrl: url,
        message: `记录 ${job.recordId.slice(0, 8)}… 生图成功（未找到结果图列）`,
      };
    }

    if (res.status === 'running') {
      await persistStatus('生成中', job.recordId);
      return {
        ok: true as const,
        recordId: job.recordId,
        previewUrl: null,
        message: `记录 ${job.recordId.slice(0, 8)}… 任务进行中，ID: ${res.id}`,
      };
    }

    throw new Error(res.error || `生图状态: ${res.status}`);
  };

  const handleGenerate = async () => {
    const targetRecordId = state.recordId;
    if (!settings.grsaiApiKey) {
      setState((s) => ({ ...s, error: '请先在设置中填写 Grsai API Key' }));
      return;
    }
    if (!targetRecordId) {
      setState((s) => ({
        ...s,
        error: '请先在表格中选中一行（勾选行首或点进单元格）',
      }));
      return;
    }
    if (state.generatingRecordIds.includes(targetRecordId)) {
      setState((s) => ({ ...s, error: '当前记录正在生图中，请稍候' }));
      return;
    }

    let job: RecordJobSnapshot;
    try {
      job = await createJobSnapshot(
        targetRecordId,
        targetRecordId === state.recordId ? prompt : undefined,
      );
    } catch (e) {
      setState((s) => ({ ...s, error: toChineseError(e) }));
      return;
    }

    if (!job.prompt.trim()) {
      setState((s) => ({ ...s, error: '请在 Prompt 列或下方填写提示词' }));
      return;
    }

    addGeneratingRecord(targetRecordId);
    setState((s) => ({ ...s, error: null, message: `已开始为当前记录生图…` }));

    try {
      const result = await runGenerateJob(job);
      setState((s) => {
        const isViewing = s.recordId === result.recordId;
        return {
          ...s,
          status: 'succeeded',
          progress: 100,
          message: result.message,
          resultImageUrl: isViewing && result.previewUrl ? result.previewUrl : s.resultImageUrl,
          generateParams: isViewing
            ? { ...s.generateParams, statusLabel: '成功' }
            : s.generateParams,
        };
      });
    } catch (e) {
      await persistStatus('失败', job.recordId);
      setState((s) => {
        const isViewing = s.recordId === job.recordId;
        return {
          ...s,
          status: 'failed',
          error: isViewing ? toChineseError(e) : s.error,
          message: isViewing
            ? s.message
            : `记录 ${job.recordId.slice(0, 8)}… 生图失败：${toChineseError(e)}`,
          generateParams: isViewing
            ? { ...s.generateParams, statusLabel: '失败' }
            : s.generateParams,
        };
      });
    } finally {
      removeGeneratingRecord(targetRecordId);
    }
  };

  const copyPrompt = async () => {
    const text = prompt.trim();
    if (!text) {
      setState((s) => ({ ...s, error: 'Prompt 为空，无法复制', message: '' }));
      return;
    }
    try {
      await copyToClipboard(text);
      setState((s) => ({ ...s, message: '已复制 Prompt', error: null }));
    } catch (e) {
      setState((s) => ({
        ...s,
        error: toChineseError(e),
        message: '',
      }));
    }
  };

  return (
    <div className="va-app">
      <header className="va-header">
        <div className="va-header__row">
          <h1 className="va-title">{PLUGIN_TITLE}</h1>
          <button
            type="button"
            className="va-btn va-btn--text"
            onClick={() => setSettingsOpen((v) => !v)}
          >
            设置
          </button>
        </div>
        <div className="va-tags">
          {tags.map((t) => (
            <span key={t} className="va-tag">
              {t}
            </span>
          ))}
        </div>
      </header>

      <SettingsPanel
        open={settingsOpen}
        settings={settings}
        onChange={updateSettings}
        onClose={() => setSettingsOpen(false)}
      />

      <TableFieldSummary
        mapping={mapping}
        generateParams={state.generateParams}
        referenceCount={state.referenceImageUrls.length}
      />

      {tableHint && <p className="va-notice">{tableHint}</p>}
      {state.error && <p className="va-error">{state.error}</p>}
      {state.message && !state.error && (
        <p className="va-notice va-notice--ok">{state.message}</p>
      )}

      <section className="va-card">
        <h3 className="va-card__title">Prompt</h3>
        <textarea
          className="va-textarea"
          placeholder="与表格 Prompt 列同步…"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={5}
        />
        <div className="va-actions">
          <button
            type="button"
            className="va-btn va-btn--success va-btn--block"
            disabled={isCurrentGenerating || state.loading}
            onClick={() => void handleGenerate()}
          >
            {isCurrentGenerating ? '当前记录生成中…' : '生成图片'}
          </button>
        </div>
      </section>

      <ImagePreview
        imageUrl={state.resultImageUrl}
        onView={() => {
          if (state.resultImageUrl) window.open(state.resultImageUrl, '_blank');
        }}
      />

      <footer className="va-footer">
        <button
          type="button"
          className="va-btn va-btn--secondary"
          disabled={state.loading}
          onClick={() => void loadRecord()}
        >
          刷新
        </button>
        <button
          type="button"
          className="va-btn va-btn--secondary"
          onClick={() => void copyPrompt()}
        >
          复制 Prompt
        </button>
      </footer>
    </div>
  );
}

export default App;
// AIGC END
