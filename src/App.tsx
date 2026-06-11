// AIGC START
/**
 * 插件主界面
 *
 * 流程：选中表格行 → 读取 Prompt/参数 → 生图 → 按「结果图像素」写回「结果图」
 * 支持：单条生图、批量并行、失败自动重试
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ImagePreview } from './components/ReviewCard';
import { TableFieldSummary } from './components/TableFieldSummary';
import { SettingsPanel } from './components/SettingsPanel';
import {
  JOB_AUTO_RETRY_COUNT,
  JOB_RETRY_DELAY_MS,
  PLUGIN_TITLE,
} from './constants';
import { useBitableRecord } from './hooks/useBitableRecord';
import { useTheme } from './hooks/useTheme';
import { generateImage } from './services/nanoBanana';
import type { PluginSettings, RecordJobSnapshot } from './types';
import { isNonRetryableJobError, sleep } from './utils/batchPool';
import { formatResultImagePixels, isFailedStatusLabel } from './utils/bitableHelpers';
import { copyToClipboard } from './utils/clipboard';
import { toChineseError } from './utils/errorMessage';
import { loadSettings, saveSettings } from './utils/settings';

type JobSuccess = {
  ok: true;
  recordId: string;
  previewUrl: string | null;
  message: string;
};

type JobResult = JobSuccess | { ok: false; recordId: string; error: string };

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
    refreshSelectedRecords,
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

  const { aspectRatio, imageSize, imageModel, resultImagePixels } = state.generateParams;

  const isBusy = state.generatingRecordIds.length > 0;
  const isCurrentGenerating = state.recordId
    ? state.generatingRecordIds.includes(state.recordId)
    : false;
  const selectedCount = state.selectedRecordIds.length;

  const tags = useMemo(
    () => [
      state.recordTitle || state.recordId?.slice(0, 10) || '未选记录',
      selectedCount > 1 ? `已选 ${selectedCount} 行` : '',
      imageModel,
      `${aspectRatio} · ${imageSize}`,
      `结果图 ${formatResultImagePixels(resultImagePixels)}`,
      state.generateParams.statusLabel
        ? `状态: ${state.generateParams.statusLabel}`
        : '',
      state.generatingRecordIds.length
        ? `生图中 ${state.generatingRecordIds.length} 条`
        : '',
    ].filter(Boolean),
    [state, aspectRatio, imageSize, imageModel, resultImagePixels, selectedCount],
  );

  /** 调用生图 API，成功则返回图片 URL（仅调用一次，重试写回时不重复调用） */
  const callGenerateApi = useCallback(
    async (job: RecordJobSnapshot): Promise<string> => {
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
        return res.results[0].url;
      }

      if (res.status === 'running') {
        throw new Error(`任务仍在进行中，ID: ${res.id}`);
      }

      throw new Error(res.error || `生图状态: ${res.status}`);
    },
    [settings],
  );

  /** 将已生成的图片写回表格 */
  const writeJobResult = useCallback(
    async (job: RecordJobSnapshot, imageUrl: string): Promise<JobSuccess> => {
      if (mapping.resultImageFieldId) {
        try {
          const { urls } = await persistGeneratedImage(
            imageUrl,
            job.recordId,
            job.resultImagePixels,
          );
          await persistStatus('成功', job.recordId);
          const previewUrl = urls[0] ?? imageUrl;
          const sizeLabel = formatResultImagePixels(job.resultImagePixels);
          return {
            ok: true,
            recordId: job.recordId,
            previewUrl,
            message: `记录 ${job.recordId.slice(0, 8)}… 生图成功，已写入结果图（${sizeLabel}）`,
          };
        } catch (writeErr) {
          throw writeErr;
        }
      }

      await persistStatus('成功', job.recordId);
      return {
        ok: true,
        recordId: job.recordId,
        previewUrl: imageUrl,
        message: `记录 ${job.recordId.slice(0, 8)}… 生图成功（未找到结果图列）`,
      };
    },
    [mapping.resultImageFieldId, persistGeneratedImage, persistStatus],
  );

  /** 带自动重试的单条任务（API 成功后的写回失败只重试写回，不重复调 API） */
  const runGenerateJobWithRetry = useCallback(
    async (job: RecordJobSnapshot): Promise<JobResult> => {
      const maxAttempts = 1 + JOB_AUTO_RETRY_COUNT;
      let lastError: unknown;
      let imageUrl: string | null = null;

      await persistPrompt(job.prompt, job.recordId);
      await persistStatus('生成中', job.recordId);

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          if (attempt > 1) {
            await sleep(JOB_RETRY_DELAY_MS);
            if (!imageUrl) {
              await persistStatus('生成中', job.recordId);
            }
          }

          if (!imageUrl) {
            imageUrl = await callGenerateApi(job);
          }

          return await writeJobResult(job, imageUrl);
        } catch (e) {
          lastError = e;
          if (attempt >= maxAttempts || isNonRetryableJobError(e)) break;
        }
      }

      const error = toChineseError(lastError);
      await persistStatus('失败', job.recordId);
      return { ok: false, recordId: job.recordId, error };
    },
    [callGenerateApi, persistPrompt, persistStatus, writeJobResult],
  );

  const updateBatchMessage = useCallback(
    (done: number, total: number, success: number, failed: number) => {
      setState((s) => ({
        ...s,
        message: `批量生图 ${done}/${total}（成功 ${success}，失败 ${failed}）`,
      }));
    },
    [setState],
  );

  /** 批量/重跑：并行执行多条任务 */
  const executeBatch = useCallback(
    async (
      recordIds: string[],
      opts?: { onlyFailed?: boolean; promptOverrideForCurrent?: string },
    ) => {
      if (!settings.grsaiApiKey) {
        setState((s) => ({ ...s, error: '请先在设置中填写 Grsai API Key' }));
        return;
      }
      if (recordIds.length === 0) {
        setState((s) => ({
          ...s,
          error: '请先在表格中勾选一行或多行（行首复选框）',
        }));
        return;
      }

      const pendingIds = recordIds.filter(
        (id) => !state.generatingRecordIds.includes(id),
      );
      if (pendingIds.length === 0) {
        setState((s) => ({ ...s, error: '所选记录均已在生图中' }));
        return;
      }

      const snapshots: RecordJobSnapshot[] = [];
      let skippedEmpty = 0;
      let skippedNotFailed = 0;

      for (const recordId of pendingIds) {
        try {
          const snapshot = await createJobSnapshot(
            recordId,
            recordId === state.recordId ? opts?.promptOverrideForCurrent : undefined,
          );
          if (!snapshot.prompt.trim()) {
            skippedEmpty += 1;
            continue;
          }
          if (opts?.onlyFailed && !isFailedStatusLabel(snapshot.statusLabel)) {
            skippedNotFailed += 1;
            continue;
          }
          snapshots.push(snapshot);
        } catch (e) {
          setState((s) => ({ ...s, error: toChineseError(e) }));
          return;
        }
      }

      if (snapshots.length === 0) {
        const hint = opts?.onlyFailed
          ? skippedNotFailed > 0
            ? '所选行中没有状态为「失败」的记录'
            : '失败行均无有效 Prompt'
          : '所选行均无有效 Prompt';
        setState((s) => ({ ...s, error: hint }));
        return;
      }

      for (const job of snapshots) {
        addGeneratingRecord(job.recordId);
      }

      setState((s) => ({
        ...s,
        error: null,
        status: 'running',
        message: `批量生图 0/${snapshots.length}（全并行）…`,
      }));

      let done = 0;
      let success = 0;
      let failed = 0;

      await Promise.all(
        snapshots.map(async (job) => {
          const result = await runGenerateJobWithRetry(job);
          done += 1;
          if (result.ok) {
            success += 1;
            setState((s) => {
              const isViewing = s.recordId === result.recordId;
              return {
                ...s,
                resultImageUrl:
                  isViewing && result.previewUrl ? result.previewUrl : s.resultImageUrl,
                generateParams: isViewing
                  ? { ...s.generateParams, statusLabel: '成功' }
                  : s.generateParams,
              };
            });
          } else {
            failed += 1;
            setState((s) => {
              const isViewing = s.recordId === result.recordId;
              return {
                ...s,
                error: isViewing ? result.error : s.error,
                generateParams: isViewing
                  ? { ...s.generateParams, statusLabel: '失败' }
                  : s.generateParams,
              };
            });
          }
          updateBatchMessage(done, snapshots.length, success, failed);
          removeGeneratingRecord(job.recordId);
        }),
      );

      setState((s) => ({
        ...s,
        status: failed === snapshots.length ? 'failed' : 'succeeded',
        progress: 100,
        message: `批量完成：${success} 成功，${failed} 失败${skippedEmpty ? `，${skippedEmpty} 条跳过（无 Prompt）` : ''}${opts?.onlyFailed && skippedNotFailed ? `，${skippedNotFailed} 条非失败状态已跳过` : ''}`,
        error: failed > 0 && success === 0 ? '批量生图全部失败，请查看表格「状态」列' : s.error,
      }));

      void loadRecord({ silent: true });
    },
    [
      addGeneratingRecord,
      createJobSnapshot,
      loadRecord,
      removeGeneratingRecord,
      runGenerateJobWithRetry,
      setState,
      settings.grsaiApiKey,
      state.generatingRecordIds,
      state.recordId,
      updateBatchMessage,
    ],
  );

  const handleGenerateCurrent = async () => {
    const targetRecordId = state.recordId;
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
      job = await createJobSnapshot(targetRecordId, prompt);
    } catch (e) {
      setState((s) => ({ ...s, error: toChineseError(e) }));
      return;
    }

    if (!job.prompt.trim()) {
      setState((s) => ({ ...s, error: '请在 Prompt 列或下方填写提示词' }));
      return;
    }

    addGeneratingRecord(targetRecordId);
    setState((s) => ({ ...s, error: null, message: '已开始为当前记录生图…' }));

    try {
      const result = await runGenerateJobWithRetry(job);
      if (result.ok) {
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
      } else {
        setState((s) => {
          const isViewing = s.recordId === result.recordId;
          return {
            ...s,
            status: 'failed',
            error: isViewing ? result.error : s.error,
            generateParams: isViewing
              ? { ...s.generateParams, statusLabel: '失败' }
              : s.generateParams,
          };
        });
      }
    } finally {
      removeGeneratingRecord(targetRecordId);
    }
  };

  const handleBatchGenerate = async () => {
    const ids = await refreshSelectedRecords();
    await executeBatch(ids, { promptOverrideForCurrent: prompt });
  };

  const handleRetryFailed = async () => {
    const ids = await refreshSelectedRecords();
    await executeBatch(ids, { onlyFailed: true, promptOverrideForCurrent: prompt });
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
            onClick={() => void handleGenerateCurrent()}
          >
            {isCurrentGenerating ? '当前记录生成中…' : '生成当前行'}
          </button>
          <button
            type="button"
            className="va-btn va-btn--primary va-btn--block"
            disabled={state.loading || isBusy || selectedCount === 0}
            onClick={() => void handleBatchGenerate()}
          >
            {isBusy
              ? `批量生图中（${state.generatingRecordIds.length}）…`
              : selectedCount > 1
                ? `批量生成选中行（${selectedCount}）`
                : '批量生成选中行'}
          </button>
          <button
            type="button"
            className="va-btn va-btn--secondary va-btn--block"
            disabled={state.loading || isBusy || selectedCount === 0}
            onClick={() => void handleRetryFailed()}
          >
            重跑选中失败行
          </button>
        </div>
        <p className="va-hint">
          在表格中勾选多行后点「批量生成」；失败行会自动重试最多 {JOB_AUTO_RETRY_COUNT}{' '}
          次（违规/审核错误不重试）。已拿到图片后重试仅写回表格，不会重复调用生图 API。批量任务全并行执行。
        </p>
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
