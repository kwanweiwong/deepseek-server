<template>
  <div class="knowledge-manager">
    <div class="knowledge-header">
      <h3>知识库管理</h3>
      <el-button type="primary" size="small" @click="openAddDialog">
        <el-icon><Plus /></el-icon>
        添加文档
      </el-button>
    </div>

    <div class="knowledge-list">
      <div v-if="documents.length === 0" class="empty-state">
        <el-icon><Document /></el-icon>
        <p>暂无知识库文档</p>
      </div>
      
      <div v-else class="document-list">
        <div v-for="doc in documents" :key="doc.id" class="document-item">
          <div class="doc-header">
            <span class="doc-title">{{ doc.title }}</span>
            <div class="doc-actions">
              <el-button 
                type="primary" 
                size="small" 
                circle 
                @click="openEditDialog(doc)"
              >
                <el-icon><Edit /></el-icon>
              </el-button>
              <el-button 
                type="danger" 
                size="small" 
                circle 
                @click="deleteDocument(doc.id)"
              >
                <el-icon><Delete /></el-icon>
              </el-button>
            </div>
          </div>
          <div class="doc-meta">
            <span class="doc-type">{{ doc.doc_type }}</span>
            <span class="doc-chunks">{{ doc.chunk_count }} 块</span>
            <span class="doc-date">{{ formatDate(doc.created_at) }}</span>
          </div>
          <div class="doc-preview">{{ doc.content.slice(0, 100) }}...</div>
        </div>
      </div>
    </div>

    <!-- 添加/编辑文档对话框 -->
    <el-dialog
      v-model="showDialog"
      :title="isEdit ? '编辑知识库文档' : '添加知识库文档'"
      width="500px"
    >
      <el-form :model="formData" label-width="80px">
        <el-form-item label="标题">
          <el-input v-model="formData.title" placeholder="请输入文档标题" />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="formData.docType" placeholder="请选择类型">
            <el-option label="纯文本" value="text" />
            <el-option label="文档" value="doc" />
          </el-select>
        </el-form-item>
        <el-form-item label="内容">
          <el-input
            v-model="formData.content"
            type="textarea"
            :rows="10"
            placeholder="请输入文档内容"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDialog = false">取消</el-button>
        <el-button type="primary" @click="saveDocument" :loading="saving">
          {{ isEdit ? '更新' : '添加' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Document, Delete, Edit } from '@element-plus/icons-vue'
import { knowledgeApi } from '@/api'

const documents = ref([])
const showDialog = ref(false)
const isEdit = ref(false)
const saving = ref(false)
const editingId = ref(null)
const formData = ref({
  title: '',
  docType: 'text',
  content: ''
})

async function loadDocuments() {
  try {
    const res = await knowledgeApi.getAll()
    documents.value = res.documents
  } catch (error) {
    console.error('加载知识库失败:', error)
  }
}

function openAddDialog() {
  isEdit.value = false
  editingId.value = null
  formData.value = { title: '', docType: 'text', content: '' }
  showDialog.value = true
}

function openEditDialog(doc) {
  isEdit.value = true
  editingId.value = doc.id
  formData.value = {
    title: doc.title,
    docType: doc.doc_type || 'text',
    content: doc.content
  }
  showDialog.value = true
}

async function saveDocument() {
  if (!formData.value.title || !formData.value.content) {
    ElMessage.warning('请填写标题和内容')
    return
  }

  saving.value = true
  try {
    if (isEdit.value) {
      await knowledgeApi.update(editingId.value, formData.value)
      ElMessage.success('文档更新成功')
    } else {
      await knowledgeApi.add(formData.value)
      ElMessage.success('文档添加成功')
    }
    showDialog.value = false
    await loadDocuments()
  } catch (error) {
    ElMessage.error(isEdit.value ? '更新失败' : '添加失败')
  } finally {
    saving.value = false
  }
}

async function deleteDocument(id) {
  try {
    await ElMessageBox.confirm('确定要删除这个文档吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    await knowledgeApi.delete(id)
    ElMessage.success('删除成功')
    await loadDocuments()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

function formatDate(dateStr) {
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN')
}

onMounted(() => {
  loadDocuments()
})
</script>

<style scoped>
.knowledge-manager {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.knowledge-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #eee;
}

.knowledge-header h3 {
  margin: 0;
  font-size: 16px;
}

.knowledge-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #999;
}

.empty-state .el-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.document-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.document-item {
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 12px;
  background: #fff;
}

.doc-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.doc-actions {
  display: flex;
  gap: 8px;
}

.doc-title {
  font-weight: 600;
  color: #333;
}

.doc-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #999;
  margin-bottom: 8px;
}

.doc-preview {
  font-size: 13px;
  color: #666;
  line-height: 1.5;
}
</style>
