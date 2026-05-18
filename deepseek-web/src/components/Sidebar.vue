<template>
  <div class="sidebar">
    <div class="sidebar-header">
      <div class="logo">
        <div class="logo-icon">
          <el-icon><ChatLineRound /></el-icon>
        </div>
        <span>DeepSeek</span>
      </div>
      <el-button type="primary" :icon="Plus" :loading="isCreating" @click="handleNewChat" class="new-chat-btn">
        <span class="btn-text">新建对话</span>
      </el-button>
    </div>

    <!-- 标签页切换 -->
    <div class="tabs">
      <div 
        class="tab-item" 
        :class="{ active: activeTab === 'conversations' }"
        @click="activeTab = 'conversations'"
      >
        <el-icon><ChatDotRound /></el-icon>
        <span>对话</span>
      </div>
      <div 
        class="tab-item" 
        :class="{ active: activeTab === 'knowledge' }"
        @click="activeTab = 'knowledge'"
      >
        <el-icon><Document /></el-icon>
        <span>知识库</span>
      </div>
    </div>

    <!-- RAG 开关 -->
    <div class="rag-switch-wrapper">
      <span class="rag-label">启用知识库</span>
      <el-switch v-model="useRAG" @change="handleRAGChange" />
    </div>

    <!-- 对话列表 -->
    <div v-if="activeTab === 'conversations'" class="conversation-list">
      <div
        v-for="conv in conversations"
        :key="conv.id"
        class="conversation-item"
        :class="{ active: conv.id === currentConversationId }"
        @click="handleSelectConversation(conv.id)"
      >
        <div class="conv-icon-wrapper">
          <el-icon class="conv-icon"><ChatDotRound /></el-icon>
        </div>
        <input
          v-if="editingId === conv.id"
          v-model="editingTitle"
          @click.stop
          @blur="saveEditTitle(conv.id)"
          @keyup.enter="saveEditTitle(conv.id)"
          @keyup.escape="cancelEditTitle"
          class="conv-title-input"
          ref="titleInputRef"
        />
        <span v-else class="conv-title">{{ conv.title }}</span>
        <div class="conv-actions">
          <el-icon 
            class="edit-icon" 
            @click.stop="startEditTitle(conv)"
          >
            <Edit />
          </el-icon>
          <el-icon class="delete-icon" @click.stop="handleDeleteConversation(conv.id)">
            <Delete />
          </el-icon>
        </div>
      </div>
    </div>

    <!-- 知识库管理 -->
    <div v-else class="knowledge-wrapper">
      <KnowledgeManager />
    </div>

    <div class="sidebar-footer" v-if="user">
      <div class="user-info">
        <div class="user-avatar">
          <el-icon class="user-icon"><User /></el-icon>
        </div>
        <div class="user-details">
          <span class="user-name">{{ user.username }}</span>
        </div>
      </div>
      <el-button type="danger" size="small" @click="handleLogout" :icon="SwitchButton" class="logout-btn">
        <span>退出</span>
      </el-button>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { ChatLineRound, Plus, ChatDotRound, Delete, User, SwitchButton, Document, Edit } from '@element-plus/icons-vue'
import { useChatStore } from '@/stores/chat'
import { useUserStore } from '@/stores/user'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { conversationApi } from '@/api'
import KnowledgeManager from './KnowledgeManager.vue'

const chatStore = useChatStore()
const userStore = useUserStore()
const router = useRouter()

const isCreating = ref(false)
const activeTab = ref('conversations')
const editingId = ref(null)
const editingTitle = ref('')
const titleInputRef = ref(null)
const { conversations, currentConversationId, useRAG } = storeToRefs(chatStore)
const user = userStore.user

async function handleNewChat() {
  if (isCreating.value) return
  
  isCreating.value = true
  try {
    const conv = await chatStore.createConversation()
    if (conv) {
      await chatStore.selectConversation(conv.id)
      ElMessage.success('新建对话成功')
    }
  } catch (error) {
    console.error('新建对话失败:', error)
    ElMessage.error('新建对话失败，请重试')
  } finally {
    isCreating.value = false
  }
}

function handleSelectConversation(id) {
  chatStore.selectConversation(id)
}

function startEditTitle(conv) {
  editingId.value = conv.id
  editingTitle.value = conv.title
  nextTick(() => {
    titleInputRef.value?.focus()
    titleInputRef.value?.select()
  })
}

async function saveEditTitle(id) {
  if (!editingTitle.value.trim()) {
    cancelEditTitle()
    return
  }
  
  try {
    await conversationApi.update(id, { title: editingTitle.value })
    const conv = conversations.value.find(c => c.id === id)
    if (conv) {
      conv.title = editingTitle.value
    }
    ElMessage.success('更新成功')
  } catch (error) {
    ElMessage.error('更新失败')
  }
  cancelEditTitle()
}

function cancelEditTitle() {
  editingId.value = null
  editingTitle.value = ''
}

function handleDeleteConversation(id) {
  chatStore.deleteConversation(id)
}

function handleRAGChange(value) {
  chatStore.setUseRAG(value)
}

function handleLogout() {
  userStore.logout()
  chatStore.socket?.disconnect()
  router.push('/login')
}
</script>

<style scoped>
.sidebar {
  width: 280px;
  height: 100%;
  background: #fdfcfb;
  display: flex;
  flex-direction: column;
  color: #1a1a1a;
  border-right: 1px solid #e8e6e3;
}

.sidebar-header {
  padding: 20px;
  border-bottom: 1px solid #e8e6e3;
}

.logo {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 22px;
  font-weight: 700;
  margin-bottom: 20px;
  color: #1a1a1a;
}

.logo-icon {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, #e07b5b 0%, #d66848 100%);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo-icon .el-icon {
  font-size: 22px;
  color: white;
}

.new-chat-btn {
  width: 100%;
  height: 42px;
  border-radius: 10px;
  font-weight: 600;
  background: linear-gradient(135deg, #e07b5b 0%, #d66848 100%);
  border: none;
  transition: all 0.3s ease;
}

.new-chat-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(224, 123, 91, 0.35);
}

.btn-text {
  font-size: 14px;
}

.tabs {
  display: flex;
  padding: 12px;
  gap: 8px;
  border-bottom: 1px solid #e8e6e3;
}

.tab-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  color: #666;
  transition: all 0.2s ease;
}

.tab-item:hover {
  background: #f2f1ef;
}

.tab-item.active {
  background: #e07b5b;
  color: white;
}

.rag-switch-wrapper {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #e8e6e3;
  background: #f7f6f4;
}

.rag-label {
  font-size: 14px;
  color: #333;
}

.conversation-list {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.conversation-list::-webkit-scrollbar {
  width: 6px;
}

.conversation-list::-webkit-scrollbar-track {
  background: transparent;
}

.conversation-list::-webkit-scrollbar-thumb {
  background: #d1cfca;
  border-radius: 3px;
}

.conversation-list::-webkit-scrollbar-thumb:hover {
  background: #b8b6b0;
}

.conversation-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-bottom: 6px;
  position: relative;
}

.conversation-item:hover {
  background: #f2f1ef;
}

.conversation-item.active {
  background: #f2f1ef;
  border: 1px solid #e8e6e3;
}

.conv-icon-wrapper {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: #f2f1ef;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.conv-icon {
  color: #8a8985;
  font-size: 18px;
}

.conv-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  color: #4a4a4a;
  font-weight: 500;
}

.conv-title-input {
  flex: 1;
  font-size: 14px;
  color: #4a4a4a;
  font-weight: 500;
  border: 1px solid #e07b5b;
  border-radius: 4px;
  padding: 2px 6px;
  outline: none;
  background: #fff;
}

.conv-actions {
  display: flex;
  gap: 4px;
}

.edit-icon,
.delete-icon {
  opacity: 0;
  transition: all 0.2s ease;
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  font-size: 18px;
}

.edit-icon {
  color: #666;
}

.edit-icon:hover {
  background: rgba(0, 0, 0, 0.05);
  color: #333;
}

.delete-icon {
  color: #dc3545;
}

.delete-icon:hover {
  background: rgba(220, 53, 69, 0.1);
}

.conversation-item:hover .edit-icon,
.conversation-item:hover .delete-icon {
  opacity: 1;
}

.knowledge-wrapper {
  flex: 1;
  overflow: hidden;
}

.sidebar-footer {
  padding: 16px 20px;
  border-top: 1px solid #e8e6e3;
  background: #f7f6f4;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.user-avatar {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: linear-gradient(135deg, #e07b5b 0%, #d66848 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.user-icon {
  color: white;
  font-size: 20px;
}

.user-name {
  font-size: 14px;
  font-weight: 600;
  color: #1a1a1a;
}

.logout-btn {
  width: 100%;
  border-radius: 10px;
  font-weight: 600;
  background: rgba(220, 53, 69, 0.08);
  border: 1px solid rgba(220, 53, 69, 0.2);
  color: #dc3545;
  transition: all 0.3s ease;
}

.logout-btn:hover {
  background: rgba(220, 53, 69, 0.15);
  border-color: rgba(220, 53, 69, 0.3);
  color: #c82333;
}
</style>
