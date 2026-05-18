import { defineStore } from 'pinia'
import { ref } from 'vue'
import { io } from 'socket.io-client'
import { conversationApi } from '@/api'

export const useChatStore = defineStore('chat', () => {
  const conversations = ref([])
  const currentConversationId = ref(null)
  const messages = ref([])
  const isTyping = ref(false)
  const socket = ref(null)
  
  // 模型配置
  const availableModels = ref([
    { value: 'deepseek-v4-pro', label: 'deepseek-v4', description: '能力最强' },
    { value: 'deepseek-v4-flash', label: 'deepseek-v4', description: '响应更快' }
  ])
  const currentModel = ref('deepseek-v4-pro')
  
  // RAG 配置
  const useRAG = ref(false)

  function initSocket() {
    if (socket.value) {
      socket.value.disconnect()
    }
    socket.value = io('http://localhost:3000', {
      transports: ['websocket', 'polling']
    })
    
    socket.value.on('chat-chunk', (data) => {
      if (data.conversationId === currentConversationId.value) {
        const lastMessage = messages.value[messages.value.length - 1]
        if (lastMessage && lastMessage.role === 'assistant' && lastMessage.isStreaming) {
          lastMessage.content += data.chunk
        }
      }
    })

    socket.value.on('chat-complete', (data) => {
      if (data.conversationId === currentConversationId.value) {
        const lastMessage = messages.value[messages.value.length - 1]
        if (lastMessage) {
          lastMessage.isStreaming = false
        }
        isTyping.value = false
      }
      loadConversations()
    })

    socket.value.on('chat-error', (data) => {
      isTyping.value = false
      console.error('聊天错误:', data.message)
    })
  }

  async function loadConversations() {
    try {
      const res = await conversationApi.getAll()
      conversations.value = res.conversations
    } catch (error) {
      console.error('加载对话列表失败:', error)
    }
  }

  async function createConversation(title = '新对话') {
    try {
      const res = await conversationApi.create({ title })
      conversations.value.unshift(res.conversation)
      return res.conversation
    } catch (error) {
      console.error('创建对话失败:', error)
    }
  }

  async function selectConversation(id) {
    try {
      currentConversationId.value = id
      const res = await conversationApi.getById(id)
      messages.value = res.messages || []
      socket.value?.emit('join-conversation', id)
    } catch (error) {
      console.error('加载对话失败:', error)
      messages.value = []
    }
  }

  async function deleteConversation(id) {
    try {
      await conversationApi.delete(id)
      conversations.value = conversations.value.filter(c => c.id !== id)
      if (currentConversationId.value === id) {
        currentConversationId.value = null
        messages.value = []
      }
    } catch (error) {
      console.error('删除对话失败:', error)
    }
  }

  function setModel(modelValue) {
    currentModel.value = modelValue
  }

  function sendMessage(userId, message) {
    if (!socket.value || !currentConversationId.value) return
    
    messages.value.push({
      role: 'user',
      content: message
    })
    
    messages.value.push({
      role: 'assistant',
      content: '',
      isStreaming: true
    })
    
    isTyping.value = true
    
    socket.value.emit('chat-message', {
      conversationId: currentConversationId.value,
      userId,
      message,
      model: currentModel.value,
      useRAG: useRAG.value
    })
  }
  
  function setUseRAG(value) {
    useRAG.value = value
  }

  return {
    conversations,
    currentConversationId,
    messages,
    isTyping,
    socket,
    availableModels,
    currentModel,
    useRAG,
    initSocket,
    loadConversations,
    createConversation,
    selectConversation,
    deleteConversation,
    sendMessage,
    setModel,
    setUseRAG
  }
})
