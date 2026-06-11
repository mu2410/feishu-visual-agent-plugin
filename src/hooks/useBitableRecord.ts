// AIGC START
/**
 * 表格数据 Hook
 *
 * 负责：
 * - 初始化字段映射、监听选中行变化
 * - 读取当前行 Prompt / 参考图 / 比例 / 结果图像素等
 * - 提供写回 Prompt、状态、结果图的 persist 方法
 */
import { useCallback, useEffect, useState } from 'react';
import { bitable, type IFieldMeta } from '@lark-base-open/js-sdk';
import { DEFAULT_SETTINGS, DEFAULT_RESULT_IMAGE_PIXELS } from '../constants';
import type {
  RecordFieldMapping,
  RecordGenerateParams,
  RecordJobSnapshot,
  ResultImagePixels,
  VisualAgentState,
} from '../types';
import {
  guessFieldMapping,
  isStandardTableMapping,
  normalizeAspectRatio,
  normalizeImageSize,
  normalizeModel,
  parseResultImagePixels,
  readAllReferenceUrls,
  readAttachmentUrls,
  readPixelCell,
  readRecordSnapshot,
  readSelectCell,
  readTextCell,
  resolveActiveRecordId,
  resolveSelectedRecordIds,
  writeGeneratedImageResults,
  writeSelectCell,
  writeTextCell,
} from '../utils/bitableHelpers';
import { loadFieldMapping } from '../utils/fieldMappingStorage';
import { toChineseError } from '../utils/errorMessage';

/** 生图参数的默认初值（表格未填时使用） */
const defaultGenerateParams = (): RecordGenerateParams => ({
  aspectRatio: DEFAULT_SETTINGS.aspectRatio,
  imageSize: DEFAULT_SETTINGS.imageSize,
  imageModel: DEFAULT_SETTINGS.imageModel,
  statusLabel: '',
  resultImagePixels: DEFAULT_RESULT_IMAGE_PIXELS,
});

export function useBitableRecord() {
  const [tableId, setTableId] = useState('');
  const [mapping, setMapping] = useState<RecordFieldMapping>({
    referenceImageFieldIds: [],
  });
  const [state, setState] = useState<VisualAgentState>({
    recordId: null,
    recordTitle: '',
    prompt: '',
    resultImageUrl: null,
    referenceImageUrls: [],
    generateParams: defaultGenerateParams(),
    status: 'idle',
    progress: 0,
    error: null,
    loading: false,
    message: '',
    generatingRecordIds: [],
    selectedRecordIds: [],
  });
  const [tableHint, setTableHint] = useState('正在连接多维表格…');

  const refreshSelectedRecords = useCallback(async () => {
    const ids = await resolveSelectedRecordIds();
    setState((s) => ({ ...s, selectedRecordIds: ids }));
    return ids;
  }, []);

  /** 合并自动推断 + localStorage 保存的字段映射，并更新 tableHint */
  const applyMapping = useCallback((metaList: IFieldMeta[], id: string) => {
    const guessed = guessFieldMapping(metaList);
    const saved = loadFieldMapping(id);
    const next: RecordFieldMapping = {
      ...guessed,
      ...saved,
      referenceImageFieldIds:
        saved?.referenceImageFieldIds?.length
          ? saved.referenceImageFieldIds
          : guessed.referenceImageFieldIds,
    };
    setMapping(next);

    if (!next.promptFieldId) {
      setTableHint('未找到 Prompt 字段，请确认表结构或字段名');
    } else if (isStandardTableMapping(next)) {
      setTableHint('');
    } else {
      setTableHint('已部分匹配字段，请检查 Prompt / 结果图 等列名');
    }
    return next;
  }, []);

  /** 插件加载时：获取 tableId 与字段元数据 */
  const initTable = useCallback(async () => {
    const table = await bitable.base.getActiveTable();
    const id = (await table.getMeta()).id;
    setTableId(id);
    const metaList = (await table.getFieldMetaList()) ?? [];
    applyMapping(metaList as IFieldMeta[], id);
  }, [applyMapping]);

  /**
   * 读取当前选中行的全部字段到 state
   * @param silent 为 true 时不显示 loading、不覆盖已有 error（用于后台刷新）
   */
  const loadRecord = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) {
        setState((s) => ({ ...s, loading: true, error: null }));
      }
      try {
        const recordId = await resolveActiveRecordId();
        if (!recordId) {
          setState((s) => ({
            ...s,
            recordId: null,
            loading: false,
            error: s.generatingRecordIds.length
              ? null
              : '请先在表格中选中一行（勾选行首或点进单元格）',
          }));
          return;
        }

        const table = await bitable.base.getActiveTable();

        let recordTitle = recordId;
        if (mapping.promptFieldId) {
          const t = await readTextCell(table, mapping.promptFieldId, recordId);
          if (t) recordTitle = t.slice(0, 40);
        }

        let prompt = '';
        let resultImageUrl: string | null = null;
        let referenceImageUrls: string[] = [];
        const generateParams = defaultGenerateParams();

        if (mapping.promptFieldId) {
          prompt = await readTextCell(table, mapping.promptFieldId, recordId);
        }
        if (mapping.resultImageFieldId) {
          try {
            const urls = await readAttachmentUrls(
              table,
              mapping.resultImageFieldId,
              recordId,
            );
            resultImageUrl = urls[0] ?? null;
          } catch {
            /* 保留当前预览 */
          }
        }
        if (mapping.referenceImageFieldIds.length) {
          referenceImageUrls = await readAllReferenceUrls(
            table,
            mapping.referenceImageFieldIds,
            recordId,
          );
        }
        if (mapping.aspectRatioFieldId) {
          generateParams.aspectRatio = normalizeAspectRatio(
            await readSelectCell(table, mapping.aspectRatioFieldId, recordId),
          );
        }
        if (mapping.imageSizeFieldId) {
          generateParams.imageSize = normalizeImageSize(
            await readSelectCell(table, mapping.imageSizeFieldId, recordId),
          );
        }
        if (mapping.modelFieldId) {
          generateParams.imageModel = normalizeModel(
            await readSelectCell(table, mapping.modelFieldId, recordId),
          );
        }
        if (mapping.statusFieldId) {
          generateParams.statusLabel = await readSelectCell(
            table,
            mapping.statusFieldId,
            recordId,
          );
        }
        if (mapping.resultImagePixelFieldId) {
          generateParams.resultImagePixels = parseResultImagePixels(
            await readPixelCell(table, mapping.resultImagePixelFieldId, recordId),
          );
        }

        const refCount = referenceImageUrls.length;
        setState((s) => {
          const isGeneratingRow = s.generatingRecordIds.includes(recordId);
          return {
            ...s,
            recordId,
            recordTitle,
            prompt,
            resultImageUrl: resultImageUrl ?? s.resultImageUrl,
            referenceImageUrls,
            generateParams,
            loading: false,
            error: null,
            ...(isGeneratingRow
              ? {}
              : {
                  message: refCount
                    ? `已从表格读取：Prompt、${refCount} 张参考图、比例/尺寸/模型`
                    : '已从表格读取 Prompt 与参数（无参考图）',
                }),
          };
        });
        await refreshSelectedRecords();
      } catch (e) {
        setState((s) => ({
          ...s,
          loading: false,
          error: opts?.silent ? s.error : toChineseError(e),
        }));
      }
    },
    [mapping, refreshSelectedRecords],
  );

  /** 标记某 recordId 正在生图（防重复点击） */
  const addGeneratingRecord = useCallback((recordId: string) => {
    setState((s) => ({
      ...s,
      generatingRecordIds: s.generatingRecordIds.includes(recordId)
        ? s.generatingRecordIds
        : [...s.generatingRecordIds, recordId],
    }));
  }, []);

  /** 生图结束，移除 recordId 标记 */
  const removeGeneratingRecord = useCallback((recordId: string) => {
    setState((s) => ({
      ...s,
      generatingRecordIds: s.generatingRecordIds.filter((id) => id !== recordId),
    }));
  }, []);

  /**
   * 创建生图任务快照
   * promptOverride：用户在边栏 textarea 中修改但未写回表格时使用
   */
  const createJobSnapshot = useCallback(
    async (recordId: string, promptOverride?: string): Promise<RecordJobSnapshot> => {
      const snapshot = await readRecordSnapshot(recordId, mapping);
      const override = promptOverride?.trim();
      if (override) {
        snapshot.prompt = override;
      }
      return snapshot;
    },
    [mapping],
  );

  /** 将 Prompt 写回表格对应行 */
  const persistPrompt = useCallback(
    async (text: string, recordId: string) => {
      if (!recordId || !mapping.promptFieldId) return;
      const table = await bitable.base.getActiveTable();
      await writeTextCell(table, mapping.promptFieldId, recordId, text);
    },
    [mapping.promptFieldId],
  );

  /** 更新表格「状态」列：生成中 / 成功 / 失败 */
  const persistStatus = useCallback(
    async (label: string, recordId: string) => {
      if (!recordId || !mapping.statusFieldId || !label) return;
      const table = await bitable.base.getActiveTable();
      await writeSelectCell(table, mapping.statusFieldId, recordId, label);
    },
    [mapping.statusFieldId],
  );

  /** 下载 API 结果图，按 outputPixels 缩放后写入「结果图」列 */
  const persistGeneratedImage = useCallback(
    async (imageUrl: string, recordId: string, outputPixels: ResultImagePixels) => {
      if (!recordId || !mapping.resultImageFieldId) {
        throw new Error('未找到「结果图」附件字段');
      }
      const table = await bitable.base.getActiveTable();
      return writeGeneratedImageResults(
        table,
        recordId,
        imageUrl,
        mapping.resultImageFieldId,
        outputPixels,
      );
    },
    [mapping.resultImageFieldId],
  );

  // 挂载时初始化表格
  useEffect(() => {
    void initTable();
  }, [initTable]);

  // 字段映射就绪后加载当前行
  useEffect(() => {
    if (tableId && mapping.promptFieldId) void loadRecord();
  }, [tableId, mapping.promptFieldId, loadRecord]);

  // 用户切换选中行时静默刷新
  useEffect(() => {
    const offBase = bitable.base.onSelectionChange(() => {
      void loadRecord({ silent: true });
      void refreshSelectedRecords();
    });
    return () => offBase();
  }, [loadRecord, refreshSelectedRecords]);

  // 表格数据被修改时防抖刷新（避免频繁读表）
  useEffect(() => {
    let offRecord: (() => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      try {
        const table = await bitable.base.getActiveTable();
        offRecord = table.onRecordModify(() => {
          clearTimeout(timer);
          timer = setTimeout(() => {
            void loadRecord({ silent: true });
          }, 800);
        });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      clearTimeout(timer);
      offRecord?.();
    };
  }, [loadRecord]);

  return {
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
  };
}
// AIGC END
