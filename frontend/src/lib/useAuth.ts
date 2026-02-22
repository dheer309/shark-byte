import { useState } from 'react'
import type { User } from '../types'

const SUPERUSER_EMAIL = 'dheer@kcl.ac.uk'

export function useAuth() {
  const [user] = useState<User | null>(() => {
    const raw = localStorage.getItem('unitap_user')
    return raw ? JSON.parse(raw) : null
  })

  const logout = () => {
    localStorage.removeItem('unitap_token')
    localStorage.removeItem('unitap_user')
    window.location.href = '/auth'
  }

  const isSuperuser = () => user?.email === SUPERUSER_EMAIL

  const isClassAdmin = () =>
    user?.role === 'class_admin' || isSuperuser()

  const isSocietyAdmin = (admins: string[]) =>
    user ? admins.includes(user._id) || isSuperuser() : false

  return { user, logout, isSuperuser, isClassAdmin, isSocietyAdmin }
}
