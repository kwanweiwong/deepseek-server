import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useUserStore } from '@/stores/user'

const routes: RouteRecordRaw[] = [
{
path: '/login',
name: 'Login',
component: () => import('@/views/LoginView.vue')
},
{
path: '/',
name: 'Chat',
component: () => import('@/views/ChatView.vue'),
meta: { requiresAuth: true }
}
]

const router = createRouter({
history: createWebHistory(),
routes
})

router.beforeEach((to, _from, next) => {
const userStore = useUserStore()
userStore.initUser()

if (to.meta.requiresAuth && !userStore.token) {
next('/login')
} else if (to.path === '/login' && userStore.token) {
next('/')
} else {
next()
}
})

export default router
