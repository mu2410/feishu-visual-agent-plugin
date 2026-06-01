// AIGC START
import { useCallback, useEffect, useState } from 'react';
import { bitable, type IFieldMeta } from '@lark-base-open/js-sdk';
import { DEFAULT_SETTINGS } from '../constants';
import type {
  RecordFieldMapping,
  RecordGenerateParams,
  VisualAgentState,
} from '../types';
import {
  guessFieldMapping,
  isStandardTableMapping,
  normalizeAspectRatio,
  normalizeImageSize,
  normalizeModel,
  readAllReferenceUrls,
  readAttachmentUrls,
  readSelectCell,
  readTextCell,
  resolveActiveRecordId,
  writeGeneratedImageToField,
  writeSelectCell,
  writeTextCell,
} from '../utils/bitableHelpers';
import { loadFieldMapping } from '../utils/fieldMappingStorage';
import { toChineseError } from '../utils/errorMessage';

const defaultGenerateParams = (): RecordGenerateParams => ({
  aspectRatio: DEFAULT_SETTINGS.aspectRatio,
  imageSize: DEFAULT_SETTINGS.imageSize,
  imageModel: DEFAULT_SETTINGS.imageModel,
  statusLabel: '',
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
  });
  const [tableHint, setTableHint] = useState('正在连接多维表格…');

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

  const initTable = useCallback(async () => {
    const table = await bitable.base.getActiveTable();
    const id = (await table.getMeta()).id;
    setTableId(id);
    const metaList = (await table.getFieldMetaList()) ?? [];
    applyMapping(metaList as IFieldMeta[], id);
  }, [applyMapping]);

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
            error: '请先在表格中选中一行（勾选行首或点进单元格）',
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
          const raw = await readSelectCell(
            table,
            mapping.aspectRatioFieldId,
            recordId,
          );
          generateParams.aspectRatio = normalizeAspectRatio(raw);
        }
        if (mapping.imageSizeFieldId) {
          const raw = await readSelectCell(
            table,
            mapping.imageSizeFieldId,
            recordId,
          );
          generateParams.imageSize = normalizeImageSize(raw);
        }
        if (mapping.modelFieldId) {
          const raw = await readSelectCell(
            table,
            mapping.modelFieldId,
            recordId,
          );
          generateParams.imageModel = normalizeModel(raw);
        }
        if (mapping.statusFieldId) {
          generateParams.statusLabel = await readSelectCell(
            table,
            mapping.statusFieldId,
            recordId,
          );
        }

        const refCount = referenceImageUrls.length;
        setState((s) => ({
          ...s,
          recordId,
          recordTitle,
          prompt,
          resultImageUrl: resultImageUrl ?? s.resultImageUrl,
          referenceImageUrls,
          generateParams,
          loading: false,
          error: null,
          message: refCount
            ? `已从表格读取：Prompt、${refCount} 张参考图、比例/尺寸/模型`
            : '已从表格读取 Prompt 与参数（无参考图）',
        }));
      } catch (e) {
        setState((s) => ({
          ...s,
          loading: false,
          error: opts?.silent ? s.error : toChineseError(e),
        }));
      }
    },
    [mapping],
  );

  const persistPrompt = useCallback(
    async (prompt: string) => {
      const recordId = state.recordId;
      if (!recordId || !mapping.promptFieldId) return;
      const table = await bitable.base.getActiveTable();
      await writeTextCell(table, mapping.promptFieldId, recordId, prompt);
    },
    [mapping.promptFieldId, state.recordId],
  );

  const persistStatus = useCallback(
    async (label: string) => {
      const recordId = state.recordId;
      if (!recordId || !mapping.statusFieldId || !label) return;
      const table = await bitable.base.getActiveTable();
      await writeSelectCell(table, mapping.statusFieldId, recordId, label);
    },
    [mapping.statusFieldId, state.recordId],
  );

  const persistGeneratedImage = useCallback(
    async (imageUrl: string): Promise<string[]> => {
      const recordId = state.recordId;
      if (!recordId || !mapping.resultImageFieldId) {
        throw new Error('未找到「结果图」附件字段');
      }
      const table = await bitable.base.getActiveTable();
      return writeGeneratedImageToField(
        table,
        mapping.resultImageFieldId,
        recordId,
        imageUrl,
      );
    },
    [mapping.resultImageFieldId, state.recordId],
  );

  useEffect(() => {
    void initTable();
  }, [initTable]);

  useEffect(() => {
    if (tableId && mapping.promptFieldId) void loadRecord();
  }, [tableId, mapping.promptFieldId, loadRecord]);

  useEffect(() => {
    const offBase = bitable.base.onSelectionChange(() => {
      void loadRecord();
    });
    return () => offBase();
  }, [loadRecord]);

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
          }, 500);
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
    persistPrompt,
    persistStatus,
    persistGeneratedImage,
  };
}
// AIGC END
