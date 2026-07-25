/**
 * SMTP 邮件通知模块
 * 用于 Cookie 监测告警，与 Webhook 并行通知
 */
import nodemailer from 'nodemailer'
import store from './store.js'

let transporter = null

const createTransporter = () => {
    const config = store.getSmtpConfig()
    if (!config.host || !config.user || !config.pass) return null
    return nodemailer.createTransport({
        host: config.host,
        port: config.port || 465,
        secure: config.secure !== false,
        auth: {
            user: config.user,
            pass: config.pass
        }
    })
}

/**
 * 发送邮件通知
 * @param {{ event: string, title: string, message: string, priority: number }} data
 * @returns {Promise<{sent: boolean, reason?: string, error?: string}>}
 */
export async function sendEmailNotification(data) {
    const config = store.getSmtpConfig()

    if (!config.enabled) {
        return { sent: false, reason: 'smtp_not_enabled' }
    }
    if (!config.host || !config.user || !config.pass || !config.to) {
        return { sent: false, reason: 'smtp_not_configured' }
    }

    try {
        const t = createTransporter()
        if (!t) return { sent: false, reason: 'transporter_create_failed' }

        const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#f8f9fa;border-radius:12px;">
  <div style="background:#50A8D0;color:#fff;padding:16px 20px;border-radius:8px;margin-bottom:20px;">
    <h2 style="margin:0;font-size:18px;">${data.title}</h2>
    <p style="margin:4px 0 0;font-size:13px;opacity:0.85;">优先级: ${'★'.repeat(data.priority)}</p>
  </div>
  <pre style="background:#fff;padding:16px;border-radius:8px;font-size:14px;line-height:1.6;white-space:pre-wrap;color:#333;margin:0;">${data.message}</pre>
  <p style="color:#868e96;font-size:12px;margin-top:16px;">发送时间: ${new Date().toLocaleString('zh-CN')} | Meting-API Cookie 监测</p>
</div>`

        const info = await t.sendMail({
            from: config.from || config.user,
            to: config.to,
            subject: `[Meting-API] ${data.title}`,
            text: data.message,
            html: html
        })

        console.log(`[EmailNotifier] 邮件发送成功: ${info.messageId}`)

        await store.addMonitorLog({
            type: 'email_sent',
            success: true,
            to: config.to,
            messageId: info.messageId,
            eventData: { title: data.title, event: data.event }
        })

        return { sent: true, messageId: info.messageId }
    } catch (error) {
        console.error('[EmailNotifier] 邮件发送失败:', error.message)

        await store.addMonitorLog({
            type: 'email_error',
            error: error.message,
            to: config.to
        })

        return { sent: false, error: error.message }
    }
}

/**
 * 发送测试邮件
 */
export async function testEmail() {
    const config = store.getSmtpConfig()

    if (!config.host || !config.user || !config.pass || !config.to) {
        return { success: false, error: 'SMTP 未完整配置' }
    }

    return await sendEmailNotification({
        event: 'test',
        title: 'Meting-API 测试邮件',
        message: `🎉 SMTP 邮件通知测试成功！\n\n发送时间: ${new Date().toLocaleString('zh-CN')}\n\n如果您收到此邮件，说明 SMTP 配置正确，邮件通知功能可正常使用。`,
        priority: 3
    })
}
