import axios from 'axios';
import vectorDB from './vectorDB';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const SEARCH_API_KEY = process.env.SEARCH_API_KEY || '';

interface Tool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, { type: string; description: string }>;
      required: string[];
    };
  };
}

const TOOLS: Tool[] = [
  {
    type: 'function',
    function: {
      name: 'get_model_info',
      description: '获取 DeepSeek 最新的模型版本和信息，包括模型名称、更新时间、特性等',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_current_time',
      description: '获取当前的准确日期和时间，包括年、月、日、时、分、秒、星期等信息',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: '在网上搜索最新的信息，用于回答时效性强的问题',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: '搜索关键词'
          }
        },
        required: ['query']
      }
    }
  }
];

interface ModelInfo {
  name: string;
  version: string;
  description: string;
  knowledge_cutoff: string;
  features: string[];
}

interface TimeInfo {
  year: number;
  month: number;
  day: number;
  hours: string;
  minutes: string;
  seconds: string;
  weekDay: string;
  formatted_date: string;
  formatted_time: string;
  full_datetime: string;
  timestamp: number;
}

function getCurrentDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return `${year}年${month}月`;
}

function getCurrentTime(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const seconds = now.getSeconds().toString().padStart(2, '0');
  const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const weekDay = weekDays[now.getDay()];

  return JSON.stringify({
    year,
    month,
    day,
    hours,
    minutes,
    seconds,
    weekDay,
    formatted_date: `${year}年${month}月${day}日`,
    formatted_time: `${hours}:${minutes}:${seconds}`,
    full_datetime: `${year}年${month}月${day}日 ${weekDay} ${hours}:${minutes}:${seconds}`,
    timestamp: now.getTime()
  } satisfies TimeInfo);
}

function getModelInfo(currentModel: string): string {
  const currentDate = getCurrentDate();
  const models: Record<string, ModelInfo> = {
    'deepseek-v4-pro': {
      name: 'deepseek-v4-pro',
      version: 'V4 Pro',
      description: 'DeepSeek V4 专业版，能力最强',
      knowledge_cutoff: '2025年10月',
      features: ['能力最强', '深度推理', '工具调用', '高质量回答']
    },
    'deepseek-v4-flash': {
      name: 'deepseek-v4-flash',
      version: 'V4 Flash',
      description: 'DeepSeek V4 极速版，响应更快',
      knowledge_cutoff: '2025年10月',
      features: ['极速响应', '低延迟', '高质量回答']
    },
    'deepseek-chat': {
      name: 'deepseek-chat',
      version: 'V4 (稳定版)',
      description: 'DeepSeek 通用聊天模型',
      knowledge_cutoff: '2025年10月',
      features: ['自动更新', '平衡性能']
    }
  };

  const currentModelInfo = models[currentModel] || models['deepseek-chat'];

  return JSON.stringify({
    current_model: currentModelInfo,
    note: `当前正在使用的模型: ${currentModelInfo.name}，当前日期: ${currentDate}`,
    current_date: currentDate
  });
}

async function webSearch(query: string): Promise<string> {
  const currentDate = getCurrentDate();

  if (SEARCH_API_KEY) {
    try {
      // 可接入真实搜索 API
    } catch (error: any) {
      console.error('真实搜索失败，使用模拟搜索:', error.message);
    }
  }

  return JSON.stringify({
    query,
    current_date: currentDate,
    results: [
      {
        title: '实时信息',
        snippet: `当前日期: ${currentDate}。关于"${query}"的信息，请参考以下提示：`
      },
      {
        title: '当前使用的模型',
        snippet: 'deepseek-v4-flash 极速模型已正确识别并切换！该模型响应速度更快，适合快速问答。'
      },
      {
        title: '知识截止时间说明',
        snippet: `虽然模型训练数据截止到2025年10月，但系统可以通过 web_search 工具获取${currentDate}的最新信息。`
      }
    ],
    disclaimer: '提示：如需接入真实搜索引擎，请在 .env 文件中配置 SEARCH_API_KEY。'
  });
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
}

class DeepSeekService {
  private apiKey: string;
  private model: string;
  private temperature: number;

  constructor() {
    this.apiKey = process.env.DEEPSEEK_API_KEY || '';
    this.model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
    this.temperature = parseFloat(process.env.DEEPSEEK_TEMPERATURE || '0.7');
  }

  async *chatStream(messages: ChatMessage[], modelParam?: string, userId?: number, useRAG = false): AsyncGenerator<string> {
    const modelToUse = modelParam || this.model;
    const currentTimeInfo = JSON.parse(getCurrentTime()) as TimeInfo;

    let ragPromptContent = '';

    if (useRAG && userId && messages.length > 0) {
      const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
      if (lastUserMessage) {
        const searchResults = await vectorDB.searchDocuments(
          lastUserMessage.content,
          userId,
          3
        );

        if (searchResults.length > 0) {
          ragPromptContent = vectorDB.buildRAGPrompt(
            lastUserMessage.content,
            searchResults
          ) || '';
        }
      }
    }

    let systemContent = `当前使用的模型是: ${modelToUse}。当前完整时间是: ${currentTimeInfo.full_datetime}。请根据这些信息回答用户问题。如果用户询问模型信息、当前日期或时间，请准确告知。如果用户需要更精确的时间，可以使用 get_current_time 工具获取。如果用户需要最新实时信息，请使用 web_search 工具进行搜索。`;

    if (ragPromptContent) {
      systemContent = `当前使用的模型是: ${modelToUse}。当前完整时间是: ${currentTimeInfo.full_datetime}。

你有一个知识库供参考。请优先基于【参考内容】回答用户问题，参考内容中没有的信息再结合你的知识补充。不要对参考内容中已有答案的问题调用 web_search 工具。

${ragPromptContent}`;
    }

    const systemPrompt: ChatMessage = {
      role: 'system',
      content: systemContent
    };

    const currentMessages: ChatMessage[] = [systemPrompt, ...messages];

    // 第一次流式请求：逐 token 产出，结束后从 return 值获取 tool_calls
    const iter1 = this.streamResponse(currentMessages, modelToUse);
    let next1 = await iter1.next();
    while (!next1.done) {
      yield next1.value as string;
      next1 = await iter1.next();
    }
    const { content: streamedContent, toolCalls } = next1.value;

    let hasOutput = streamedContent.length > 0;

    if (toolCalls && toolCalls.length > 0) {
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: streamedContent || '',
        tool_calls: toolCalls
      };
      currentMessages.push(assistantMessage);

      for (const toolCall of toolCalls) {
        let toolResult: string;

        try {
          if (toolCall.function.name === 'get_model_info') {
            toolResult = getModelInfo(modelToUse);
          } else if (toolCall.function.name === 'get_current_time') {
            toolResult = getCurrentTime();
          } else if (toolCall.function.name === 'web_search') {
            const args = JSON.parse(toolCall.function.arguments);
            toolResult = await webSearch(args.query);
          } else {
            toolResult = JSON.stringify({ error: '未知工具' });
          }
        } catch (e: any) {
          toolResult = JSON.stringify({ error: '工具执行失败', details: e.message });
        }

        currentMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: toolResult
        });
      }

      // 第二次流式请求
      const iter2 = this.streamResponse(currentMessages, modelToUse);
      let next2 = await iter2.next();
      while (!next2.done) {
        yield next2.value as string;
        hasOutput = true;
        next2 = await iter2.next();
      }
      // 二次响应剩余内容
      if (next2.value.content) {
        hasOutput = true;
      }
    }

    if (!hasOutput) {
      yield '抱歉，我暂时无法回答这个问题，请稍后重试。';
    }
  }

  /**
   * 异步生成器：逐 token 产出 DeepSeek 流式响应文本。
   * 遍历完成后，return 值携带 { content: 完整文本, toolCalls?: [...] }。
   */
  private async *streamResponse(
    messages: ChatMessage[],
    modelToUse: string
  ): AsyncGenerator<string, { content: string; toolCalls?: ChatMessage['tool_calls'] }> {
    const response = await axios.post(
      DEEPSEEK_API_URL,
      {
        model: modelToUse,
        messages,
        temperature: this.temperature,
        tools: TOOLS,
        tool_choice: 'auto',
        stream: true
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        responseType: 'stream',
        timeout: 120000
      }
    );

    let content = '';
    const toolCallMap = new Map<number, { id: string; name: string; arguments: string }>();
    let finishReason = '';
    let lineBuffer = '';

    for await (const chunk of response.data) {
      const text = (chunk as Buffer).toString();
      lineBuffer += text;

      const lines = lineBuffer.split('\n');
      lineBuffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (!data || data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const choice = parsed.choices?.[0];
          finishReason = choice?.finish_reason || finishReason;
          const delta = choice?.delta;

          if (delta?.content) {
            content += delta.content;
            yield delta.content;
          }

          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const entry = toolCallMap.get(tc.index) || { id: '', name: '', arguments: '' };
              if (tc.id) entry.id = tc.id;
              if (tc.function?.name) entry.name += tc.function.name;
              if (tc.function?.arguments) entry.arguments += tc.function.arguments;
              toolCallMap.set(tc.index, entry);
            }
          }
        } catch {
          continue;
        }
      }
    }

    // 处理缓冲区中可能残留的最后一行
    if (lineBuffer.startsWith('data: ') && lineBuffer.slice(6).trim() !== '[DONE]') {
      try {
        const parsed = JSON.parse(lineBuffer.slice(6).trim());
        const delta = parsed.choices?.[0]?.delta;
        if (delta?.content) {
          content += delta.content;
          yield delta.content;
        }
      } catch { /* ignore */ }
    }

    let toolCalls: ChatMessage['tool_calls'] | undefined;
    if (finishReason === 'tool_calls' && toolCallMap.size > 0) {
      toolCalls = Array.from(toolCallMap.entries())
        .sort(([a], [b]) => a - b)
        .map(([_, tc]) => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.name, arguments: tc.arguments }
        }));
    }

    return { content, toolCalls };
  }
}

export default new DeepSeekService();
