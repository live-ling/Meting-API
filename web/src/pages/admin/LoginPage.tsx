import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { ApiError, apiRequest } from '../../lib/http'

const credentialsSchema = z.object({
  username: z.string().min(1, '请输入用户名'),
  password: z.string().min(1, '请输入密码'),
})

type Credentials = z.infer<typeof credentialsSchema>

interface LoginResponse {
  success?: boolean
  require2FA?: boolean
  error?: string
  data?: { username: string; role: string }
}

interface LoginPageProps {
  onSuccess: () => void
}

/**
 * 登录页：账号密码 →（可选）双因素验证码。
 * 接口契约与旧后台一致：POST /admin/login，2FA 时返回 require2FA。
 */
export default function LoginPage({ onSuccess }: LoginPageProps) {
  const [step, setStep] = useState<'credentials' | 'code'>('credentials')
  const [pendingUsername, setPendingUsername] = useState('')
  const [serverError, setServerError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const credentialsForm = useForm<Credentials>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: { username: '', password: '' },
  })

  const codeForm = useForm<{ code: string }>({
    resolver: zodResolver(z.object({ code: z.string().regex(/^\d{6}$/, '请输入 6 位数字验证码') })),
    defaultValues: { code: '' },
  })

  async function submitLogin(body: Record<string, unknown>) {
    setSubmitting(true)
    setServerError('')
    try {
      const result = await apiRequest<LoginResponse>('/admin/login', { method: 'POST', body })
      if (result.success === false) {
        setServerError(result.error ?? '登录失败')
        return
      }
      if (result.require2FA) {
        setStep('code')
        return
      }
      onSuccess()
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : '网络异常，请稍后再试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <p className="login-kicker">METING · ADMIN</p>
        <h1>{step === 'credentials' ? '管理后台' : '双因素验证'}</h1>
        <p className="login-subtitle">
          {step === 'credentials' ? '使用后台账号登录' : `请输入 ${pendingUsername} 的验证器验证码`}
        </p>

        {step === 'credentials' ? (
          <form
            className="login-form"
            onSubmit={credentialsForm.handleSubmit(async (values) => {
              setPendingUsername(values.username)
              await submitLogin(values)
            })}
          >
            <label>
              用户名
              <input type="text" autoComplete="username" {...credentialsForm.register('username')} />
            </label>
            {credentialsForm.formState.errors.username ? (
              <span className="field-error">{credentialsForm.formState.errors.username.message}</span>
            ) : null}

            <label>
              密码
              <input type="password" autoComplete="current-password" {...credentialsForm.register('password')} />
            </label>
            {credentialsForm.formState.errors.password ? (
              <span className="field-error">{credentialsForm.formState.errors.password.message}</span>
            ) : null}

            {serverError ? <p className="form-error">{serverError}</p> : null}

            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? '登录中…' : '登录'}
            </button>
          </form>
        ) : (
          <form
            className="login-form"
            onSubmit={codeForm.handleSubmit(async (values) => {
              await submitLogin({ username: pendingUsername, password: credentialsForm.getValues('password'), code: values.code })
            })}
          >
            <label>
              验证码
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                autoComplete="one-time-code"
                {...codeForm.register('code')}
              />
            </label>
            {codeForm.formState.errors.code ? (
              <span className="field-error">{codeForm.formState.errors.code.message}</span>
            ) : null}

            {serverError ? <p className="form-error">{serverError}</p> : null}

            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? '验证中…' : '验证'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setStep('credentials')}>
              返回登录
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
