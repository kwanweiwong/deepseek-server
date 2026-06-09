<template>
  <div class="chat-message" :class="{ 'user-message': message.role === 'user' }">
    <div class="message-avatar">
      <div v-if="message.role === 'user'" class="avatar-wrapper user-avatar-wrapper">
        <el-icon class="avatar-icon"><User /></el-icon>
      </div>
      <div v-else class="avatar-wrapper ai-avatar-wrapper">
        <el-icon class="avatar-icon"><ChatDotRound /></el-icon>
      </div>
    </div>
    <div class="message-content">
      <div class="message-text markdown-body" v-html="formattedContent"></div>
      <div v-if="message.isStreaming" class="typing-indicator">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { User, ChatDotRound } from '@element-plus/icons-vue'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js'
import 'highlight.js/styles/github.css'

const md = new MarkdownIt({
  highlight: function (str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<pre class="hljs"><code>${hljs.highlight(str, { language: lang }).value}</code></pre>`
      } catch (__) {}
    }
    return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`
  },
  breaks: true,
  linkify: true
})

const props = defineProps({
  message: {
    type: Object,
    required: true
  }
})

const formattedContent = computed(() => {
  try {
    return md.render(props.message.content)
  } catch (e) {
    return md.utils.escapeHtml(props.message.content)
  }
})
</script>

<style scoped>
.chat-message {
  display: flex;
  gap: 16px;
  padding: 24px 0;
  max-width: 100%;
  animation: messageIn 0.3s ease;
}

@keyframes messageIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.user-message {
  flex-direction: row-reverse;
}

.message-avatar {
  flex-shrink: 0;
}

.avatar-wrapper {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.user-avatar-wrapper {
  background: linear-gradient(135deg, #e07b5b 0%, #d66848 100%);
}

.ai-avatar-wrapper {
  background: linear-gradient(135deg, #e07b5b 0%, #d66848 100%);
}

.avatar-icon {
  font-size: 22px;
  color: white;
}

.message-content {
  flex: 1;
  max-width: calc(100% - 58px);
}

.user-message .message-content {
  text-align: right;
}

.message-text {
  display: inline-block;
  padding: 16px 20px;
  border-radius: 16px;
  line-height: 1.7;
  text-align: left;
  max-width: 100%;
  word-wrap: break-word;
  font-size: 15px;
  color: #1a1a1a;
  background: #ffffff;
  border: 1px solid #e8e6e3;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
  transition: box-shadow 0.2s ease;
}

.message-text:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
}

.user-message .message-text {
  background: #f2f1ef;
  color: #1a1a1a;
  border: 1px solid #e8e6e3;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
}

.user-message .message-text:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
}

.typing-indicator {
  display: inline-flex;
  gap: 6px;
  padding: 12px 0;
}

.typing-indicator span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: linear-gradient(135deg, #e07b5b 0%, #d66848 100%);
  animation: typing 1.4s infinite;
}

.typing-indicator span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-indicator span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing {
  0%, 60%, 100% {
    opacity: 0.3;
    transform: translateY(0);
  }
  30% {
    opacity: 1;
    transform: translateY(-6px);
  }
}
</style>

<style>
/* Markdown 样式 */
.markdown-body {
  color: #1a1a1a;
  line-height: 1.7;
}

.markdown-body h1,
.markdown-body h2,
.markdown-body h3,
.markdown-body h4,
.markdown-body h5,
.markdown-body h6 {
  margin-top: 1.5em;
  margin-bottom: 0.5em;
  font-weight: 600;
  line-height: 1.4;
}

.markdown-body h1 {
  font-size: 1.8em;
  border-bottom: 1px solid #e8e6e3;
  padding-bottom: 0.3em;
}

.markdown-body h2 {
  font-size: 1.5em;
  border-bottom: 1px solid #e8e6e3;
  padding-bottom: 0.3em;
}

.markdown-body h3 {
  font-size: 1.25em;
}

.markdown-body p {
  margin-top: 0;
  margin-bottom: 1em;
}

.markdown-body ul,
.markdown-body ol {
  margin-top: 0;
  margin-bottom: 1em;
  padding-left: 2em;
}

.markdown-body li {
  margin-bottom: 0.25em;
}

.markdown-body code {
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 0.9em;
  background-color: #f2f1ef;
  padding: 0.2em 0.4em;
  border-radius: 4px;
}

.markdown-body pre {
  margin-top: 0;
  margin-bottom: 1em;
  padding: 1em;
  overflow: auto;
  font-size: 0.9em;
  line-height: 1.6;
  background-color: #2d2d2d !important;
  border-radius: 8px;
}

.markdown-body pre code {
  display: block;
  padding: 0;
  background-color: transparent !important;
  border: 0;
  color: #e8e6e3;
}

.markdown-body blockquote {
  margin: 0;
  padding: 0 1em;
  color: #6b6b6b;
  border-left: 4px solid #e07b5b;
  background-color: #fdfcfb;
  margin-bottom: 1em;
}

.markdown-body a {
  color: #e07b5b;
  text-decoration: none;
}

.markdown-body a:hover {
  text-decoration: underline;
}

.markdown-body table {
  border-spacing: 0;
  border-collapse: collapse;
  margin-bottom: 1em;
  width: 100%;
}

.markdown-body th,
.markdown-body td {
  padding: 0.5em 1em;
  border: 1px solid #e8e6e3;
}

.markdown-body th {
  background-color: #f2f1ef;
  font-weight: 600;
}

.markdown-body hr {
  border: 0;
  height: 1px;
  background: #e8e6e3;
  margin: 2em 0;
}

.markdown-body img {
  max-width: 100%;
  height: auto;
  border-radius: 8px;
}

/* 代码高亮样式覆盖 */
.markdown-body .hljs {
  padding: 0;
}

.markdown-body .hljs-keyword {
  color: #cc99cd;
}

.markdown-body .hljs-string {
  color: #7ec699;
}

.markdown-body .hljs-number {
  color: #f08d49;
}

.markdown-body .hljs-function {
  color: #67cdcc;
}

.markdown-body .hljs-comment {
  color: #6b6b6b;
}
</style>
