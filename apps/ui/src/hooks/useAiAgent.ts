import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { streamText, type ModelMessage, type ToolSet, stepCountIs } from 'ai';
import { invoke } from '@tauri-apps/api/core';
import type { AiMode } from '../components/AiPromptPanel';
import {
  createModel,
  SYSTEM_PROMPT,
  buildTools,
  type AiToolCallbacks,
} from '../services/aiService';
import {
  getApiKey,
  getAvailableProviders,
  getProviderFromModel,
  getStoredModel,
  setStoredModel,
} from '../stores/apiKeyStore';

export interface ToolCall {
  name: string;
  args?: Record<string, unknown>;
  result?: unknown;
}

export interface BaseMessage {
  id: string;
  timestamp: number;
}

export interface UserMessage extends BaseMessage {
  type: 'user';
  content: string;
  checkpointId?: string;
}

export interface AssistantMessage extends BaseMessage {
  type: 'assistant';
  content: string;
}

export interface ToolCallMessage extends BaseMessage {
  type: 'tool-call';
  toolName: string;
  args?: Record<string, unknown>;
  completed?: boolean;
  result?: unknown;
}

export interface ToolResultMessage extends BaseMessage {
  type: 'tool-result';
  toolName: string;
  result: unknown;
}

export type Message = UserMessage | AssistantMessage | ToolCallMessage | ToolResultMessage;

export interface Conversation {
  id: string;
  title: string;
  timestamp: number;
  messages: Message[];
}

export interface AiAgentState {
  isStreaming: boolean;
  streamingResponse: string | null;
  proposedDiff: {
    diff: string;
    rationale: string;
  } | null;
  error: string | null;
  isApplyingDiff: boolean;
  messages: Message[];
  conversations: Conversation[];
  currentConversationId: string | null;
  currentToolCalls: ToolCall[];
  currentModel: string;
  availableProviders: string[];
}

function messagesToModelMessages(messages: Message[]): ModelMessage[] {
  const modelMessages: ModelMessage[] = [];
  let pendingToolCalls: Array<{
    toolCallId: string;
    toolName: string;
    input: unknown;
  }> = [];
  let pendingToolResults: Array<{ toolCallId: string; toolName: string; result: unknown }> = [];

  for (const msg of messages) {
    if (msg.type === 'user') {
      if (pendingToolCalls.length > 0) {
        modelMessages.push({
          role: 'assistant' as const,
          content: pendingToolCalls.map((tc) => ({
            type: 'tool-call' as const,
            toolCallId: tc.toolCallId,
            toolName: tc.toolName,
            input: tc.input,
          })),
        });
        modelMessages.push({
          role: 'tool' as const,
          content: pendingToolResults.map((tr) => ({
            type: 'tool-result' as const,
            toolCallId: tr.toolCallId,
            toolName: tr.toolName,
            output: {
              type: 'text' as const,
              value: typeof tr.result === 'string' ? tr.result : JSON.stringify(tr.result),
            },
          })),
        });
        pendingToolCalls = [];
        pendingToolResults = [];
      }
      modelMessages.push({
        role: 'user' as const,
        content: [{ type: 'text' as const, text: msg.content }],
      });
    } else if (msg.type === 'assistant') {
      modelMessages.push({
        role: 'assistant' as const,
        content: [{ type: 'text' as const, text: msg.content }],
      });
    } else if (msg.type === 'tool-call' && msg.completed) {
      pendingToolCalls.push({
        toolCallId: msg.id,
        toolName: msg.toolName,
        input: msg.args || {},
      });
      pendingToolResults.push({
        toolCallId: msg.id,
        toolName: msg.toolName,
        result: msg.result,
      });
    }
  }

  if (pendingToolCalls.length > 0) {
    modelMessages.push({
      role: 'assistant' as const,
      content: pendingToolCalls.map((tc) => ({
        type: 'tool-call' as const,
        toolCallId: tc.toolCallId,
        toolName: tc.toolName,
        input: tc.input,
      })),
    });
    modelMessages.push({
      role: 'tool' as const,
      content: pendingToolResults.map((tr) => ({
        type: 'tool-result' as const,
        toolCallId: tr.toolCallId,
        toolName: tr.toolName,
        output: {
          type: 'text' as const,
          value: typeof tr.result === 'string' ? tr.result : JSON.stringify(tr.result),
        },
      })),
    });
  }

  return modelMessages;
}

export function useAiAgent() {
  const [state, setState] = useState<AiAgentState>({
    isStreaming: false,
    streamingResponse: null,
    proposedDiff: null,
    error: null,
    isApplyingDiff: false,
    messages: [],
    conversations: [],
    currentConversationId: null,
    currentToolCalls: [],
    currentModel: getStoredModel(),
    availableProviders: getAvailableProviders(),
  });

  const sourceRef = useRef<string>('');
  const capturePreviewRef = useRef<(() => Promise<string | null>) | null>(null);
  const stlBlobUrlRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const streamBufferRef = useRef<string>('');
  const currentToolCallsRef = useRef<ToolCall[]>([]);
  const lastModeRef = useRef<'text' | 'tool' | null>(null);
  const pendingCheckpointIdRef = useRef<string | null>(null);

  const callbacks: AiToolCallbacks = useMemo(
    () => ({
      getCurrentCode: () => sourceRef.current,
      captureCurrentView: async () => {
        if (capturePreviewRef.current) {
          return capturePreviewRef.current();
        }
        return null;
      },
      getStlBlobUrl: () => stlBlobUrlRef.current,
    }),
    []
  );

  const tools: ToolSet = useMemo(() => buildTools(callbacks), [callbacks]);

  const updateSourceRef = useCallback((code: string) => {
    sourceRef.current = code;
  }, []);

  const updateCapturePreview = useCallback((fn: (() => Promise<string | null>) | null) => {
    capturePreviewRef.current = fn;
  }, []);

  const updateStlBlobUrl = useCallback((url: string | null) => {
    stlBlobUrlRef.current = url;
  }, []);

  const loadModelAndProviders = useCallback(() => {
    const model = getStoredModel();
    const providers = getAvailableProviders();
    setState((prev) => ({
      ...prev,
      currentModel: model,
      availableProviders: providers,
    }));
    if (import.meta.env.DEV)
      console.log('[useAiAgent] Loaded model:', model, 'Available providers:', providers);
  }, []);

  useEffect(() => {
    loadModelAndProviders();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const submitPrompt = useCallback(
    async (prompt: string, _mode: AiMode) => {
      if (import.meta.env.DEV) console.log('[useAiAgent] submitPrompt called', { prompt });

      const provider = getProviderFromModel(state.currentModel);
      const apiKey = getApiKey(provider);

      if (!apiKey) {
        setState((prev) => ({
          ...prev,
          error: 'Please set your API key in Settings first',
        }));
        return;
      }

      const userMessage: UserMessage = {
        type: 'user',
        id: crypto.randomUUID(),
        content: prompt,
        timestamp: Date.now(),
      };

      const updatedMessages = [...state.messages, userMessage];

      setState((prev) => ({
        ...prev,
        isStreaming: true,
        streamingResponse: '',
        error: null,
        messages: updatedMessages,
        currentToolCalls: [],
      }));
      streamBufferRef.current = '';
      currentToolCallsRef.current = [];
      lastModeRef.current = null;
      pendingCheckpointIdRef.current = null;

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const model = createModel(provider, apiKey, state.currentModel);
        const modelMessages = messagesToModelMessages(updatedMessages);

        const result = streamText({
          model,
          system: SYSTEM_PROMPT,
          messages: modelMessages,
          tools,
          stopWhen: stepCountIs(10),
          abortSignal: abortController.signal,
        });

        for await (const chunk of result.fullStream) {
          if (abortController.signal.aborted) break;

          if (chunk.type === 'text-delta') {
            if (lastModeRef.current === 'tool' && currentToolCallsRef.current.length > 0) {
              const toolMessages: ToolCallMessage[] = currentToolCallsRef.current.map((tc) => ({
                type: 'tool-call' as const,
                id: crypto.randomUUID(),
                timestamp: Date.now(),
                toolName: tc.name,
                args: tc.args,
                completed: !!tc.result,
                result: tc.result,
              }));
              setState((prev) => ({
                ...prev,
                messages: [...prev.messages, ...toolMessages],
                currentToolCalls: [],
              }));
              currentToolCallsRef.current = [];
            }

            lastModeRef.current = 'text';
            streamBufferRef.current += chunk.text;
            setState((prev) => ({
              ...prev,
              streamingResponse: streamBufferRef.current,
            }));
          } else if (chunk.type === 'tool-call') {
            if (lastModeRef.current === 'text' && streamBufferRef.current.trim()) {
              const assistantMessage: AssistantMessage = {
                type: 'assistant',
                id: crypto.randomUUID(),
                content: streamBufferRef.current,
                timestamp: Date.now(),
              };
              setState((prev) => ({
                ...prev,
                messages: [...prev.messages, assistantMessage],
                streamingResponse: null,
              }));
              streamBufferRef.current = '';
            }

            lastModeRef.current = 'tool';
            const newToolCall: ToolCall = {
              name: chunk.toolName,
              args: (chunk as { input?: unknown }).input as Record<string, unknown>,
            };
            currentToolCallsRef.current.push(newToolCall);
            setState((prev) => ({
              ...prev,
              currentToolCalls: [...currentToolCallsRef.current],
            }));
          } else if (chunk.type === 'tool-result') {
            const output = (chunk as { output?: unknown }).output;
            const resultStr = typeof output === 'string' ? output : JSON.stringify(output);
            const checkpointMatch = resultStr?.match(/\[CHECKPOINT:([\w-]+)\]/);
            if (checkpointMatch) {
              pendingCheckpointIdRef.current = checkpointMatch[1];
            }

            const tc = currentToolCallsRef.current.find(
              (t) => t.name === chunk.toolName && !t.result
            );
            if (tc) {
              tc.result = output;
              setState((prev) => ({
                ...prev,
                currentToolCalls: [...currentToolCallsRef.current],
              }));
            }
          } else if (chunk.type === 'error') {
            console.error('[useAiAgent] Stream error:', chunk.error);
          }
        }

        const finalStreamBuffer = streamBufferRef.current;
        const finalToolCalls = [...currentToolCallsRef.current];

        setState((prev) => {
          const newMessages = [...prev.messages];

          if (finalToolCalls.length > 0) {
            const toolMessages: ToolCallMessage[] = finalToolCalls.map((tc) => ({
              type: 'tool-call' as const,
              id: crypto.randomUUID(),
              timestamp: Date.now(),
              toolName: tc.name,
              args: tc.args,
              completed: !!tc.result,
              result: tc.result,
            }));
            newMessages.push(...toolMessages);
          }

          if (finalStreamBuffer && finalStreamBuffer.trim()) {
            newMessages.push({
              type: 'assistant',
              id: crypto.randomUUID(),
              content: finalStreamBuffer,
              timestamp: Date.now(),
            });
          }

          if (pendingCheckpointIdRef.current) {
            for (let i = newMessages.length - 1; i >= 0; i--) {
              if (newMessages[i].type === 'user') {
                (newMessages[i] as UserMessage).checkpointId = pendingCheckpointIdRef.current;
                break;
              }
            }
            pendingCheckpointIdRef.current = null;
          }

          return {
            ...prev,
            isStreaming: false,
            streamingResponse: null,
            messages: newMessages,
            currentToolCalls: [],
          };
        });

        streamBufferRef.current = '';
        currentToolCallsRef.current = [];
        lastModeRef.current = null;
      } catch (err) {
        if (abortController.signal.aborted) {
          if (import.meta.env.DEV) console.log('[useAiAgent] Stream was cancelled');
          return;
        }
        console.error('[useAiAgent] Error submitting prompt:', err);
        setState((prev) => ({
          ...prev,
          error: `Failed: ${err instanceof Error ? err.message : String(err)}`,
          isStreaming: false,
          streamingResponse: null,
          currentToolCalls: [],
        }));
        streamBufferRef.current = '';
        currentToolCallsRef.current = [];
        lastModeRef.current = null;
      } finally {
        abortControllerRef.current = null;
      }
    },
    [state.currentModel, state.messages, tools]
  );

  const cancelStream = useCallback(() => {
    if (import.meta.env.DEV) console.log('[useAiAgent] Cancelling stream...');
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setState((prev) => ({
      ...prev,
      isStreaming: false,
      streamingResponse: null,
      currentToolCalls: [],
    }));
    streamBufferRef.current = '';
    currentToolCallsRef.current = [];
    lastModeRef.current = null;
    pendingCheckpointIdRef.current = null;
  }, []);

  const acceptDiff = useCallback(() => {}, []);
  const rejectDiff = useCallback(() => {}, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const setCurrentModel = useCallback((model: string) => {
    if (import.meta.env.DEV) console.log('[useAiAgent] Setting current model to:', model);
    setState((prev) => ({ ...prev, currentModel: model }));
    setStoredModel(model);
  }, []);

  const newConversation = useCallback(() => {
    setState((prev) => ({
      ...prev,
      messages: [],
      streamingResponse: null,
      error: null,
      currentToolCalls: [],
    }));
  }, []);

  const handleRestoreCheckpoint = useCallback(
    async (checkpointId: string, truncatedMessages: Message[]) => {
      if (import.meta.env.DEV) console.log('[useAiAgent] Restoring checkpoint:', checkpointId);

      try {
        await invoke('restore_to_checkpoint', { checkpointId });
      } catch (err) {
        console.error('[useAiAgent] Failed to restore checkpoint via invoke:', err);
      }

      setState((prev) => ({
        ...prev,
        messages: truncatedMessages,
      }));
    },
    []
  );

  return {
    ...state,
    submitPrompt,
    cancelStream,
    acceptDiff,
    rejectDiff,
    clearError,
    newConversation,
    loadConversation: (_id: string) => {},
    saveConversation: async () => {},
    setCurrentModel,
    loadModelAndProviders,
    handleRestoreCheckpoint,
    updateSourceRef,
    updateCapturePreview,
    updateStlBlobUrl,
  };
}
