<template>
  <div class="chat-view">
    <Sidebar />
    <div class="chat-main">
      <div class="chat-messages" ref="messagesContainer">
        <div v-if="messages.length === 0" class="welcome">
          <div class="welcome-icon-wrapper">
            <el-icon class="welcome-icon"><ChatLineRound /></el-icon>
          </div>
          <h2>今天有什么可以帮到你？</h2>
          <p>开始一段对话，探索无限可能</p>
        </div>
        <ChatMessage
          v-for="message in messages"
          :key="message.id"
          :message="message"
        />
      </div>
      <ChatInput
        @send="handleSendMessage"
        :disabled="!currentConversationId || isTyping"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { useChatStore } from '@/stores/chat'
import { useUserStore } from '@/stores/user'
import Sidebar from '@/components/Sidebar.vue'
import ChatMessage from '@/components/ChatMessage.vue'
import ChatInput from '@/components/ChatInput.vue'
import { ChatLineRound } from '@element-plus/icons-vue'

const chatStore = useChatStore()
const userStore = useUserStore()

const { messages, currentConversationId, isTyping, conversations } = storeToRefs(chatStore)
const messagesContainer = ref<HTMLElement | null>(null)

function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

watch(messages, () => {
  scrollToBottom()
}, { deep: true })

async function handleSendMessage(message: string) {
  if (!currentConversationId.value) {
    const conv = await chatStore.createConversation()
    if (conv) {
      await chatStore.selectConversation(conv.id)
    }
  }
  chatStore.sendMessage(message)
}

onMounted(async () => {
  chatStore.initSocket(userStore.token)
  await chatStore.loadConversations()
  
  if (conversations.value.length > 0) {
    await chatStore.selectConversation(conversations.value[0].id)
  }
})
</script>

<style scoped>
.chat-view {
  display: flex;
  width: 100%;
  height: 100%;
  background: #fdfcfb;
}

.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  background: #fdfcfb;
  padding: 0 50px;
}

.chat-messages::-webkit-scrollbar {
  width: 8px;
}

.chat-messages::-webkit-scrollbar-track {
  background: transparent;
}

.chat-messages::-webkit-scrollbar-thumb {
  background: #d1cfca;
  border-radius: 4px;
}

.chat-messages::-webkit-scrollbar-thumb:hover {
  background: #b8b6b0;
}

.welcome {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 400px;
  color: #8a8985;
  padding: 40px 20px;
}

.welcome-icon-wrapper {
  width: 100px;
  height: 100px;
  background: linear-gradient(135deg, #e07b5b 0%, #d66848 100%);
  border-radius: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 28px;
  box-shadow: 0 20px 40px rgba(224, 123, 91, 0.25);
  animation: float 3s ease-in-out infinite;
}

@keyframes float {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

.welcome-icon {
  font-size: 52px;
  color: white;
}

.welcome h2 {
  font-size: 28px;
  font-weight: 600;
  margin: 0 0 12px;
  color: #1a1a1a;
}

.welcome p {
  font-size: 16px;
  margin: 0;
  color: #8a8985;
}
</style>
