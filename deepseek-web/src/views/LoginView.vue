<template>
  <div class="login-container">
    <div class="login-box">
      <div class="login-header">
        <div class="logo-wrapper">
          <el-icon class="logo-icon"><ChatLineRound /></el-icon>
        </div>
        <h1>DeepSeek</h1>
        <p>智能对话助手</p>
      </div>

      <el-tabs v-model="activeTab" class="login-tabs">
        <el-tab-pane label="登录" name="login">
          <el-form :model="loginForm" label-position="top" class="login-form">
            <el-form-item label="邮箱">
              <el-input
                v-model="loginForm.email"
                type="email"
                placeholder="请输入邮箱"
                size="large"
                class="form-input"
              />
            </el-form-item>
            <el-form-item label="密码">
              <el-input
                v-model="loginForm.password"
                type="password"
                placeholder="请输入密码"
                size="large"
                show-password
                @keyup.enter="handleLogin"
                class="form-input"
              />
            </el-form-item>
            <el-form-item>
              <el-button
                type="primary"
                size="large"
                :loading="loading"
                @click="handleLogin"
                class="submit-btn"
              >
                <span class="btn-text">登录</span>
              </el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="注册" name="register">
          <el-form :model="registerForm" label-position="top" class="login-form">
            <el-form-item label="用户名">
              <el-input
                v-model="registerForm.username"
                placeholder="请输入用户名"
                size="large"
                class="form-input"
              />
            </el-form-item>
            <el-form-item label="邮箱">
              <el-input
                v-model="registerForm.email"
                type="email"
                placeholder="请输入邮箱"
                size="large"
                class="form-input"
              />
            </el-form-item>
            <el-form-item label="密码">
              <el-input
                v-model="registerForm.password"
                type="password"
                placeholder="请输入密码（至少6位）"
                size="large"
                show-password
                class="form-input"
              />
            </el-form-item>
            <el-form-item label="确认密码">
              <el-input
                v-model="registerForm.confirmPassword"
                type="password"
                placeholder="请再次输入密码"
                size="large"
                show-password
                @keyup.enter="handleRegister"
                class="form-input"
              />
            </el-form-item>
            <el-form-item>
              <el-button
                type="primary"
                size="large"
                :loading="loading"
                @click="handleRegister"
                class="submit-btn"
              >
                <span class="btn-text">注册</span>
              </el-button>
            </el-form-item>
          </el-form>
        </el-tab-pane>
      </el-tabs>
    </div>
    <div class="bg-decoration"></div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ChatLineRound } from '@element-plus/icons-vue'
import { authApi } from '@/api'
import { useUserStore } from '@/stores/user'

const router = useRouter()
const userStore = useUserStore()

const activeTab = ref('login')
const loading = ref(false)

const loginForm = ref({
  email: '',
  password: ''
})

const registerForm = ref({
  username: '',
  email: '',
  password: '',
  confirmPassword: ''
})

async function handleLogin() {
  if (!loginForm.value.email || !loginForm.value.password) {
    ElMessage.warning('请填写邮箱和密码')
    return
  }

  loading.value = true
  try {
    const res = await authApi.login(loginForm.value)
    userStore.setUser(res)
    ElMessage.success('登录成功')
    router.push('/')
  } catch (error) {
    console.error(error)
  } finally {
    loading.value = false
  }
}

async function handleRegister() {
  if (!registerForm.value.username || !registerForm.value.email || !registerForm.value.password) {
    ElMessage.warning('请填写所有必填字段')
    return
  }

  if (registerForm.value.password.length < 6) {
    ElMessage.warning('密码至少6位')
    return
  }

  if (registerForm.value.password !== registerForm.value.confirmPassword) {
    ElMessage.warning('两次输入的密码不一致')
    return
  }

  loading.value = true
  try {
    const res = await authApi.register({
      username: registerForm.value.username,
      email: registerForm.value.email,
      password: registerForm.value.password
    })
    userStore.setUser(res)
    ElMessage.success('注册成功')
    router.push('/')
  } catch (error) {
    console.error(error)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-container {
  width: 100%;
  height: 100%;
  background: #fdfcfb;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.bg-decoration {
  position: absolute;
  width: 150%;
  height: 150%;
  background: 
    radial-gradient(circle at 20% 80%, rgba(224, 123, 91, 0.1) 0%, transparent 50%),
    radial-gradient(circle at 80% 20%, rgba(224, 123, 91, 0.1) 0%, transparent 50%),
    radial-gradient(circle at 40% 40%, rgba(224, 123, 91, 0.08) 0%, transparent 40%);
  animation: rotate 30s linear infinite;
  pointer-events: none;
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.login-box {
  width: 440px;
  background: #ffffff;
  border: 1px solid #e8e6e3;
  border-radius: 24px;
  padding: 48px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.06);
  position: relative;
  z-index: 10;
  animation: slideUp 0.6s ease;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.login-header {
  text-align: center;
  margin-bottom: 36px;
}

.logo-wrapper {
  width: 72px;
  height: 72px;
  background: linear-gradient(135deg, #e07b5b 0%, #d66848 100%);
  border-radius: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
  box-shadow: 0 12px 30px rgba(224, 123, 91, 0.3);
}

.logo-icon {
  font-size: 38px;
  color: white;
}

.login-header h1 {
  font-size: 32px;
  font-weight: 700;
  margin: 0 0 10px;
  color: #1a1a1a;
}

.login-header p {
  margin: 0;
  color: #8a8985;
  font-size: 15px;
}

.login-tabs {
  margin-top: 8px;
}

.login-tabs :deep(.el-tabs__header) {
  margin-bottom: 28px;
}

.login-tabs :deep(.el-tabs__nav-wrap::after) {
  display: none;
}

.login-tabs :deep(.el-tabs__item) {
  font-size: 15px;
  font-weight: 600;
  color: #8a8985;
  padding: 0 24px;
}

.login-tabs :deep(.el-tabs__item.is-active) {
  color: #e07b5b;
}

.login-tabs :deep(.el-tabs__active-bar) {
  background: linear-gradient(90deg, #e07b5b 0%, #d66848 100%);
  height: 3px;
  border-radius: 2px;
}

.login-form {
  margin-top: 8px;
}

.login-form :deep(.el-form-item__label) {
  font-size: 14px;
  font-weight: 600;
  color: #4a4a4a;
  margin-bottom: 8px;
}

.form-input {
  margin-top: 4px;
}

.form-input :deep(.el-input__wrapper) {
  border-radius: 12px;
  padding: 8px 16px;
  box-shadow: 0 0 0 2px #e8e6e3;
  transition: all 0.3s ease;
}

.form-input :deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 2px #d1cfca;
}

.form-input :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 2px #e07b5b, 0 0 0 8px rgba(224, 123, 91, 0.1);
}

.form-input :deep(.el-input__inner) {
  font-size: 15px;
  color: #1a1a1a;
}

.form-input :deep(.el-input__inner::placeholder) {
  color: #a8a7a2;
}

.submit-btn {
  width: 100%;
  height: 50px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  background: linear-gradient(135deg, #e07b5b 0%, #d66848 100%);
  border: none;
  margin-top: 8px;
  transition: all 0.3s ease;
  box-shadow: 0 4px 14px rgba(224, 123, 91, 0.3);
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(224, 123, 91, 0.4);
}

.submit-btn:active:not(:disabled) {
  transform: translateY(0);
}

.btn-text {
  letter-spacing: 0.5px;
}
</style>