import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { User } from '@/types'

export const useUserStore = defineStore('user', () => {
const user = ref<User | null>(null)
const token = ref<string>('')

function initUser(): void {
const savedToken = localStorage.getItem('token')
const savedUser = localStorage.getItem('user')
if (savedToken) {
token.value = savedToken
}
if (savedUser) {
try {
user.value = JSON.parse(savedUser)
} catch (e) {
console.error('解析用户信息失败:', e)
}
}
}

function setUser(data: { user: User; token: string }): void {
user.value = data.user
token.value = data.token
localStorage.setItem('token', data.token)
localStorage.setItem('user', JSON.stringify(data.user))
}

function logout(): void {
user.value = null
token.value = ''
localStorage.removeItem('token')
localStorage.removeItem('user')
}

return {
user,
token,
initUser,
setUser,
logout
}
})
