const axios = require('axios');
const vectorDB = require('./vectorDB');
require('dotenv').config();

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const SEARCH_API_KEY = process.env.SEARCH_API_KEY || '';

// 定义可用工具
const TOOLS = [
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

// 获取当前日期（简化版）
function getCurrentDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return `${year}年${month}月`;
}

// 获取当前完整时间
function getCurrentTime() {
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
    year: year,
    month: month,
    day: day,
    hours: hours,
    minutes: minutes,
    seconds: seconds,
    weekDay: weekDay,
    formatted_date: `${year}年${month}月${day}日`,
    formatted_time: `${hours}:${minutes}:${seconds}`,
    full_datetime: `${year}年${month}月${day}日 ${weekDay} ${hours}:${minutes}:${seconds}`,
    timestamp: now.getTime()
  });
}

// 获取模型信息的函数
function getModelInfo(currentModel) {
  const currentDate = getCurrentDate();
  const models = {
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

// 网络搜索函数 - 支持真实 API 和模拟搜索
async function webSearch(query) {
  const currentDate = getCurrentDate();
  
  // 如果配置了搜索 API，使用真实搜索
  if (SEARCH_API_KEY) {
    try {
      // 这里可以接入真实的搜索 API，如 SerpAPI、Google Custom Search 等
      // 暂时使用模拟搜索，实际项目中可以取消下面的注释并配置真实 API
      /*
      const searchResponse = await axios.get('https://serpapi.com/search', {
        params: {
          q: query,
          api_key: SEARCH_API_KEY,
          hl: 'zh-CN',
          gl: 'cn'
        }
      });
      
      const organicResults = searchResponse.data.organic_results || [];
      const results = organicResults.slice(0, 3).map(result => ({
        title: result.title,
        snippet: result.snippet
      }));
      
      return JSON.stringify({
        query: query,
        current_date: currentDate,
        results: results,
        disclaimer: '搜索结果来自网络，请自行验证信息的准确性。'
      });
      */
    } catch (error) {
      console.error('真实搜索失败，使用模拟搜索:', error.message);
    }
  }
  
  // 模拟搜索
  return JSON.stringify({
    query: query,
    current_date: currentDate,
    results: [
      {
        title: '实时信息',
        snippet: `当前日期: ${currentDate}。关于"${query}"的信息，请参考以下提示：`
      },
      {
        title: '当前使用的模型',
        snippet: `deepseek-v4-flash 极速模型已正确识别并切换！该模型响应速度更快，适合快速问答。`
      },
      {
        title: '知识截止时间说明',
        snippet: `虽然模型训练数据截止到2025年10月，但系统可以通过 web_search 工具获取${currentDate}的最新信息。`
      }
    ],
    disclaimer: '提示：如需接入真实搜索引擎，请在 .env 文件中配置 SEARCH_API_KEY。'
  });
}

class DeepSeekService {
  constructor() {
    this.apiKey = process.env.DEEPSEEK_API_KEY;
    this.model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
    this.temperature = parseFloat(process.env.DEEPSEEK_TEMPERATURE) || 0.7;
  }

  async *chatStream(messages, modelParam, userId, useRAG = false) {
    const modelToUse = modelParam || this.model;
    const currentTimeInfo = JSON.parse(getCurrentTime());
    
    let ragPromptContent = '';
    
    // 如果启用 RAG 且有用户 ID，检索知识库
    if (useRAG && userId && messages.length > 0) {
      const lastUserMessage = messages.filter(m => m.role === 'user').pop();
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
          );
        }
      }
    }
    
    // 添加系统提示
    let systemContent = `当前使用的模型是: ${modelToUse}。当前完整时间是: ${currentTimeInfo.full_datetime}。请根据这些信息回答用户问题。如果用户询问模型信息、当前日期或时间，请准确告知。如果用户需要更精确的时间，可以使用 get_current_time 工具获取。如果用户需要最新实时信息，请使用 web_search 工具进行搜索。`;
    
    if (ragPromptContent) {
      systemContent += `\n\n${ragPromptContent}`;
    }
    
    const systemPrompt = {
      role: 'system',
      content: systemContent
    };
    
    let currentMessages = [systemPrompt, ...messages];
    let hasToolCall = false;

    // 第一次请求：检查是否需要工具调用
    const firstResponse = await axios.post(
      DEEPSEEK_API_URL,
      {
        model: modelToUse,
        messages: currentMessages,
        temperature: this.temperature,
        tools: TOOLS,
        tool_choice: 'auto',
        stream: false
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        }
      }
    );

    const firstChoice = firstResponse.data.choices[0];
    
    // 如果有工具调用
    if (firstChoice.message.tool_calls) {
      hasToolCall = true;
      
      // 添加工具调用消息到对话历史
      currentMessages.push(firstChoice.message);

      // 执行所有工具调用
      for (const toolCall of firstChoice.message.tool_calls) {
        let toolResult;
        
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
        } catch (e) {
          toolResult = JSON.stringify({ error: '工具执行失败', details: e.message });
        }

        // 添加工具返回结果到对话历史
        currentMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: toolResult
        });
      }
    }

    // 流式输出最终回答
    const response = await axios.post(
      DEEPSEEK_API_URL,
      {
        model: modelToUse,
        messages: currentMessages,
        temperature: this.temperature,
        stream: true
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        responseType: 'stream'
      }
    );

    for await (const chunk of response.data) {
      const lines = chunk.toString().split('\n').filter(line => line.trim() !== '');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') break;
          
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              yield content;
            }
          } catch (e) {
            continue;
          }
        }
      }
    }
  }
}

module.exports = new DeepSeekService();
