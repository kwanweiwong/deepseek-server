<template>
  <div class="chat-input-wrapper">
    <div class="chat-input-container">
      <div class="model-selector">
        <el-select
          v-model="currentModel"
          placeholder="选择模型"
          @change="handleModelChange"
          class="model-select"
        >
          <el-option
            v-for="model in availableModels"
            :key="model.value"
            :label="model.label"
            :value="model.value"
          >
            <div class="model-option">
              <div class="model-label">{{ model.label }}</div>
              <div class="model-desc">{{ model.description }}</div>
            </div>
          </el-option>
        </el-select>
      </div>
      <div class="input-box">
        <el-input
          v-model="inputValue"
          type="textarea"
          :rows="1"
          :autosize="{ minRows: 1, maxRows: 6 }"
          placeholder="输入消息..."
          @keydown="handleKeyDown"
          :disabled="disabled"
          resize="none"
          class="chat-input"
        />
      </div>
      <el-button
        type="primary"
        :icon="Promotion"
        @click="handleSend"
        :disabled="!inputValue.trim() || disabled"
        class="send-button"
        circle
      />
    </div>
    <div class="input-tip">按 <kbd>Enter</kbd> 发送，<kbd>Shift</kbd> + <kbd>Enter</kbd> 换行</div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useChatStore } from '@/stores/chat'
import { Promotion } from '@element-plus/icons-vue'

const chatStore = useChatStore()
const { availableModels, currentModel } = storeToRefs(chatStore)

const emit = defineEmits(['send'])

const props = defineProps({
  disabled: {
    type: Boolean,
    default: false
  }
})

const inputValue = ref('')

function handleModelChange(modelValue) {
  chatStore.setModel(modelValue)
}

function handleSend() {
  if (!inputValue.value.trim() || props.disabled) return
  
  emit('send', inputValue.value)
  inputValue.value = ''
}

function handleKeyDown(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    handleSend()
  }
}
</script>

<style scoped>
.chat-input-wrapper {
  padding: 20px 24px;
  border-top: 1px solid #e8e6e3;
  background: #fdfcfb;
}

.chat-input-container {
  display: flex;
  gap: 12px;
  align-items: center;
  max-width: 960px;
  margin: 0 auto;
}

.model-selector {
  flex-shrink: 0;
}

.model-select {
  width: 170px;
}

.model-select :deep(.el-select__wrapper) {
  height: 52px;
  border-radius: 16px;
  background: #ffffff;
  border: 2px solid #e8e6e3;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
  transition: all 0.3s ease;
}

.model-select :deep(.el-select__wrapper:hover) {
  border-color: #e07b5b;
}

.model-select :deep(.el-select__wrapper.is-focused) {
  border-color: #e07b5b;
  box-shadow: 0 0 0 4px rgba(224, 123, 91, 0.1);
}

.input-box {
  flex: 1;
  background: #ffffff;
  border-radius: 20px;
  border: 2px solid #e8e6e3;
  padding: 4px;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
}

.input-box:focus-within {
  border-color: #e07b5b;
  box-shadow: 0 0 0 4px rgba(224, 123, 91, 0.1), 0 4px 12px rgba(0, 0, 0, 0.06);
}

.chat-input {
  flex: 1;
}

.chat-input :deep(.el-textarea__inner) {
  border: none;
  border-radius: 16px;
  padding: 14px 18px;
  font-size: 15px;
  line-height: 1.6;
  resize: none;
  box-shadow: none;
  transition: none;
}

.chat-input :deep(.el-textarea__inner:focus) {
  outline: none;
  box-shadow: none;
}

.chat-input :deep(.el-textarea__inner::placeholder) {
  color: #a8a7a2;
}

.send-button {
  width: 52px;
  height: 52px;
  font-size: 20px;
  flex-shrink: 0;
  border-radius: 16px;
  background: linear-gradient(135deg, #e07b5b 0%, #d66848 100%);
  border: none;
  box-shadow: 0 4px 12px rgba(224, 123, 91, 0.25);
  transition: all 0.3s ease;
}

.send-button:hover:not(:disabled) {
  transform: translateY(-2px) scale(1.05);
  box-shadow: 0 8px 20px rgba(224, 123, 91, 0.35);
}

.send-button:active:not(:disabled) {
  transform: translateY(0) scale(0.98);
}

.send-button:disabled {
  background: #e8e6e3;
  box-shadow: none;
  cursor: not-allowed;
}

.input-tip {
  text-align: center;
  font-size: 12px;
  color: #a8a7a2;
  margin-top: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.input-tip kbd {
  display: inline-block;
  padding: 2px 8px;
  background: #f2f1ef;
  border: 1px solid #e8e6e3;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  color: #4a4a4a;
  font-family: system-ui, -apple-system, sans-serif;
}

.model-option {
  display: flex;
  flex-direction: column;
}

.model-label {
  font-weight: 600;
  font-size: 14px;
  color: #1a1a1a;
}

.model-desc {
  font-size: 12px;
  color: #8a8985;
  margin-top: 4px;
}
</style>
