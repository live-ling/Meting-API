import { icon } from '../icons.js'
import { logoDataUri } from '../pages/shared/logo.js'
import { platformIcons } from '../pages/shared/platform-icons.js'
import { neteaseQrLoginEnabled } from './features.js'
import store from './store.js'
const getAdminHtml = (options = {}) => {
    const loginBgEnabled = options.loginBg?.enabled !== false
    const loginBgClass = loginBgEnabled ? ' has-login-bg' : ''
    const loginBgStyle = loginBgEnabled ? ' style="background-image:url(\'/admin/login-bg\')"' : ''
    const loginBgPreload = loginBgEnabled ? '<link rel="preload" as="image" href="/admin/login-bg">' : ''
    const loginBgPreviewSrc = loginBgEnabled ? ' src="/admin/login-bg" loading="lazy"' : ''
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Meting-API 管理后台</title>
    <link rel="icon" type="image/png" href="${logoDataUri}">
    ${loginBgPreload}
    <style>
        :root {
            --primary: #50A8D0;
            --primary-light: #B7E7FF;
            --primary-dark: #3D93B8;
            --primary-bg: rgba(183,231,255,0.15);
            --primary-border: rgba(183,231,255,0.3);
            --success: #10b981;
            --success-bg: rgba(16,185,129,0.07);
            --warning: #f59e0b;
            --warning-bg: rgba(245,158,11,0.07);
            --danger: #ef4444;
            --danger-bg: rgba(239,68,68,0.07);
            --info: #3b82f6;
            --info-bg: rgba(59,130,246,0.07);
            --bg: #f1f5f9;
            --bg-card: #ffffff;
            --bg-sidebar: #0f172a;
            --bg-sidebar-hover: rgba(255,255,255,0.06);
            --bg-sidebar-active: rgba(99,102,241,0.15);
            --text: #1e293b;
            --text-secondary: #64748b;
            --text-muted: #94a3b8;
            --text-sidebar: #94a3b8;
            --text-sidebar-active: #ffffff;
            --border: #e2e8f0;
            --border-light: #f1f5f9;
            --shadow-xs: 0 1px 2px rgba(0,0,0,0.03);
            --shadow-sm: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03);
            --shadow: 0 2px 8px rgba(0,0,0,0.06);
            --shadow-md: 0 4px 12px rgba(0,0,0,0.07);
            --shadow-lg: 0 12px 24px rgba(0,0,0,0.1);
            --radius: 10px;
            --radius-sm: 6px;
            --radius-lg: 14px;
            --transition: 0.2s cubic-bezier(0.4,0,0.2,1);
            --transition-slow: 0.35s cubic-bezier(0.4,0,0.2,1);
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }
        .icon { width: 1em; height: 1em; display: inline-block; vertical-align: -0.125em; flex-shrink: 0; }

        html { scroll-behavior: smooth; }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
            background: var(--bg);
            min-height: 100vh;
            color: var(--text);
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }

        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

        .login-container {
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%);
            padding: 20px;
            position: relative;
            overflow: hidden;
        }
        .login-container::after {
            content: '';
            position: absolute;
            inset: 0;
            background: rgba(0,0,0,0.45);
            z-index: 0;
        }

        .login-box {
            background: rgba(255,255,255,0.95);
            backdrop-filter: blur(20px);
            padding: 48px 40px;
            border-radius: var(--radius-lg);
            box-shadow: 0 20px 60px rgba(0,0,0,0.15);
            width: 100%;
            max-width: 420px;
            animation: fadeUp 0.6s cubic-bezier(0.16,1,0.3,1);
            position: relative;
            z-index: 1;
        }
        .login-box h1 {
            text-align: center;
            margin-bottom: 6px;
            color: var(--text);
            font-size: 26px;
            font-weight: 800;
            letter-spacing: -0.5px;
        }
        .login-box .login-subtitle {
            text-align: center;
            color: var(--text-secondary);
            font-size: 14px;
            margin-bottom: 36px;
        }

        .form-group { margin-bottom: 20px; }
        .form-group label {
            display: block;
            margin-bottom: 6px;
            color: var(--text);
            font-size: 13px;
            font-weight: 600;
            letter-spacing: 0.01em;
        }
        .form-group input,
        .form-group select,
        .form-group textarea {
            width: 100%;
            padding: 10px 14px;
            border: 1.5px solid var(--border);
            border-radius: var(--radius-sm);
            font-size: 14px;
            color: var(--text);
            background: var(--bg-card);
            transition: var(--transition);
            font-family: inherit;
        }
        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
            outline: none;
            border-color: var(--primary);
            box-shadow: 0 0 0 3px var(--primary-bg);
        }
        .form-group input:disabled {
            background: #f1f5f9;
            color: var(--text-muted);
            cursor: not-allowed;
        }
        .form-group input::placeholder,
        .form-group textarea::placeholder { color: var(--text-muted); }
        .form-group small { color: var(--text-muted); display: block; margin-top: 4px; font-size: 12px; }
        .form-group select {
            appearance: none;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2364748b' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: right 12px center;
            padding-right: 36px;
        }
        .form-group textarea { resize: vertical; min-height: 80px; line-height: 1.5; }

        .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 9px 18px;
            border: none;
            border-radius: var(--radius-sm);
            cursor: pointer;
            font-size: 13px;
            font-weight: 600;
            transition: var(--transition);
            white-space: nowrap;
            font-family: inherit;
            position: relative;
            overflow: hidden;
        }
        .btn:active { transform: scale(0.97); }
        .btn-primary { background: var(--primary); color: white; }
        .btn-primary:hover { background: var(--primary-dark); box-shadow: 0 4px 12px rgba(99,102,241,0.35); }
        .btn-danger { background: var(--danger); color: white; }
        .btn-danger:hover { background: #dc2626; box-shadow: 0 4px 12px rgba(239,68,68,0.35); }
        .btn-default { background: var(--bg-card); border: 1.5px solid var(--border); color: var(--text); }
        .btn-default:hover { border-color: var(--primary); color: var(--primary); background: var(--primary-bg); }
        .btn-success { background: var(--success); color: white; }
        .btn-success:hover { background: #059669; box-shadow: 0 4px 12px rgba(16,185,129,0.35); }
        .btn-warning { background: var(--warning); color: white; }
        .btn-warning:hover { background: #d97706; box-shadow: 0 4px 12px rgba(245,158,11,0.35); }
        .btn-sm { padding: 6px 12px; font-size: 12px; border-radius: 5px; }
        .btn-lg { padding: 12px 28px; font-size: 15px; }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }
        .btn-full { width: 100%; }

        .error-msg { color: var(--danger); font-size: 13px; margin-top: 12px; text-align: center; min-height: 20px; }

        .admin-container { display: none; }
        /* 刷新时先隐藏登录页，等 /admin/check 返回后再决定显示登录还是后台 */
        .auth-loading {
            display: none;
            min-height: 100vh;
            align-items: center;
            justify-content: center;
            gap: 12px;
            color: var(--text-muted);
            font-size: 13px;
        }
        .auth-loading img { width: 32px; height: 32px; border-radius: 8px; }
        body.auth-pending .auth-loading { display: flex; }
        body.auth-pending #loginContainer,
        body.auth-pending #adminContainer { display: none !important; }

        .sidebar {
            position: fixed;
            left: 0;
            top: 0;
            width: 230px;
            height: 100vh;
            background: var(--bg-sidebar);
            color: var(--text-sidebar);
            z-index: 100;
            display: flex;
            flex-direction: column;
            transition: width var(--transition-slow);
        }
        .sidebar-brand {
            padding: 24px 20px 20px;
            border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .sidebar-brand h2 {
            font-size: 18px;
            font-weight: 800;
            color: #fff;
            display: flex;
            align-items: center;
            gap: 10px;
            letter-spacing: -0.3px;
        }
        .sidebar-brand .brand-sub {
            font-size: 11px;
            color: var(--text-muted);
            margin-top: 4px;
            display: block;
            padding-left: 30px;
        }
        .sidebar-menu {
            list-style: none;
            padding: 12px 10px;
            flex: 1;
            overflow-y: auto;
        }
        .sidebar-menu li {
            padding: 10px 14px;
            cursor: pointer;
            border-radius: 8px;
            transition: var(--transition);
            font-size: 14px;
            color: var(--text-sidebar);
            margin-bottom: 2px;
            display: flex;
            align-items: center;
            gap: 10px;
            position: relative;
        }
        .sidebar-menu li:hover {
            background: var(--bg-sidebar-hover);
            color: #e2e8f0;
        }
        .sidebar-menu li.active {
            background: var(--bg-sidebar-active);
            color: var(--text-sidebar-active);
            font-weight: 600;
        }
        .sidebar-menu li.active::before {
            content: '';
            position: absolute;
            left: -10px;
            top: 50%;
            transform: translateY(-50%);
            width: 3px;
            height: 20px;
            background: var(--primary-light);
            border-radius: 0 3px 3px 0;
        }
        .sidebar-menu li .menu-icon { font-size: 16px; width: 22px; text-align: center; flex-shrink: 0; }
        .sidebar-menu li .menu-text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        .main-content {
            margin-left: 230px;
            min-height: 100vh;
            transition: margin-left var(--transition-slow);
        }
        .header {
            background: var(--bg-card);
            padding: 16px 0;
            border-bottom: 1px solid var(--border);
            position: sticky;
            top: 0;
            z-index: 50;
        }
        .header-inner { width: 100%; max-width: 1400px; margin: 0 auto; padding: 0 32px; display: flex; justify-content: space-between; align-items: center; }
        .header h3 { font-size: 18px; font-weight: 700; letter-spacing: -0.3px; }
        .user-info { display: flex; align-items: center; gap: 16px; }
        .user-info .user-name { font-size: 13px; color: var(--text-secondary); font-weight: 500; }

        .page-content { padding: 28px 32px; max-width: 1400px; margin: 0 auto; }
        .content-section { display: none; animation: fadeUp 0.35s cubic-bezier(0.16,1,0.3,1); }
        .content-section.active { display: block; }

        .card {
            background: var(--bg-card);
            border-radius: var(--radius);
            box-shadow: var(--shadow-sm);
            border: 1px solid var(--border);
            padding: 24px;
            margin-bottom: 20px;
            transition: box-shadow var(--transition), transform var(--transition);
        }
        .card:hover { box-shadow: var(--shadow); }
        .card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }
        .card-title { font-size: 16px; font-weight: 700; color: var(--text); letter-spacing: -0.2px; }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 18px;
            margin-bottom: 24px;
        }
        .stat-card {
            background: var(--bg-card);
            border-radius: var(--radius);
            box-shadow: var(--shadow-sm);
            border: 1px solid var(--border);
            padding: 22px;
            transition: var(--transition-slow);
            position: relative;
            overflow: hidden;
        }
        .stat-card::after {
            content: '';
            position: absolute;
            top: 0;
            right: 0;
            width: 80px;
            height: 80px;
            border-radius: 50%;
            opacity: 0.04;
            transform: translate(20px, -20px);
        }
        .stat-card.blue::after { background: var(--primary); }
        .stat-card.green::after { background: var(--success); }
        .stat-card.orange::after { background: var(--warning); }
        .stat-card.red::after { background: var(--danger); }
        .stat-card:hover {
            box-shadow: var(--shadow-md);
            transform: translateY(-3px);
        }
        .stat-icon {
            width: 42px;
            height: 42px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            margin-bottom: 14px;
        }
        .stat-icon.blue { background: var(--primary-bg); }
        .stat-icon.green { background: var(--success-bg); }
        .stat-icon.orange { background: var(--warning-bg); }
        .stat-icon.red { background: var(--danger-bg); }
        .stat-value { font-size: 30px; font-weight: 800; color: var(--text); line-height: 1.1; letter-spacing: -0.5px; }
        .stat-label { color: var(--text-secondary); margin-top: 6px; font-size: 13px; font-weight: 500; }

        .table-container { overflow-x: auto; border-radius: var(--radius-sm); }
        .table { width: 100%; border-collapse: collapse; }
        .table th {
            padding: 12px 16px;
            text-align: left;
            font-size: 11px;
            font-weight: 700;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.6px;
            border-bottom: 2px solid var(--border);
            background: transparent;
        }
        .table td {
            padding: 14px 16px;
            border-bottom: 1px solid var(--border-light);
            font-size: 13px;
            color: var(--text);
            vertical-align: middle;
        }
        .table tbody tr { transition: var(--transition); }
        .table tbody tr:nth-child(even) { background: #fafbfc; }
        /* 长文本（扫描器 type/ID、歌曲名）统一省略，悬停用 title 看全文 */
        .cell-clip {
            display: block;
            max-width: 100%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .cell-clip-type { max-width: 220px; }
        .cell-clip-id { max-width: 140px; }
        .cell-clip-song { max-width: 240px; }
        .table-api-logs { table-layout: fixed; min-width: 1040px; }
        .table-api-logs td { overflow: hidden; white-space: nowrap; }
        .table-api-logs td:first-child { white-space: nowrap; }
        .table-scroll-y {
            max-height: 320px;
            overflow-y: auto;
        }
        .table-scroll-y thead th {
            position: sticky;
            top: 0;
            z-index: 1;
            background: var(--bg-card);
        }
        .pager {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 8px;
            margin-top: 12px;
            flex-wrap: wrap;
        }
        .pager .page-info { padding: 0 12px; color: var(--text-secondary); font-size: 13px; }
        .table tbody tr:hover { background: var(--primary-bg); }
        .table tbody tr:last-child td { border-bottom: none; }

        .badge {
            display: inline-flex;
            align-items: center;
            padding: 3px 10px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            letter-spacing: 0.01em;
        }
        .badge-success { background: var(--success-bg); color: var(--success); }
        .badge-warning { background: var(--warning-bg); color: var(--warning); }
        .badge-info { background: var(--info-bg); color: var(--info); }
        .badge-error { background: var(--danger-bg); color: var(--danger); }
        .badge-primary { background: var(--primary-bg); color: var(--primary); }

        .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(15,23,42,0.4);
            backdrop-filter: blur(6px);
            justify-content: center;
            align-items: center;
            z-index: 1000;
        }
        .modal.show { display: flex; }
        .modal-content {
            display: flex;
            flex-direction: column;
            background: var(--bg-card);
            padding: 0;
            border-radius: var(--radius-lg);
            width: 100%;
            max-width: 520px;
            max-height: 85vh;
            overflow: hidden;
            box-shadow: var(--shadow-lg);
            animation: modalIn 0.3s cubic-bezier(0.16,1,0.3,1);
        }
        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px 24px;
            border-bottom: 1px solid var(--border);
        }
        .modal-header h3 { font-size: 16px; font-weight: 700; }
        .modal-close {
            background: none;
            border: none;
            font-size: 18px;
            cursor: pointer;
            color: var(--text-muted);
            width: 32px;
            height: 32px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: var(--transition);
        }
        .modal-close:hover { background: #f1f5f9; color: var(--text); }
        .modal-body { padding: 24px; overflow-y: auto; flex: 1 1 auto; min-height: 0; }
        .modal-header,
        .modal-footer { flex: 0 0 auto; }
        .modal-footer {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
            padding: 16px 24px;
            border-top: 1px solid var(--border);
            background: var(--border-light);
            border-radius: 0 0 var(--radius-lg) var(--radius-lg);
        }

        .status-dot {
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            margin-right: 6px;
            vertical-align: middle;
        }
        .status-active {
            background: var(--success);
            box-shadow: 0 0 0 3px var(--success-bg);
            animation: pulse 2s ease-in-out infinite;
        }
        .status-inactive { background: var(--text-muted); }

        .toast {
            position: fixed;
            top: 24px;
            right: 24px;
            padding: 14px 22px;
            border-radius: var(--radius-sm);
            color: white;
            z-index: 2000;
            animation: slideIn 0.35s cubic-bezier(0.16,1,0.3,1);
            font-size: 13px;
            font-weight: 600;
            box-shadow: var(--shadow-md);
            display: flex;
            align-items: center;
            gap: 8px;
            max-width: 360px;
        }
        .toast-success { background: var(--success); }
        .toast-error { background: var(--danger); }

        .cookie-preview {
            font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
            font-size: 12px;
            color: var(--text-secondary);
            max-width: 160px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .actions { display: flex; gap: 6px; flex-wrap: wrap; }
        /* 卡片头部的独立下拉框（如来源分析的时间范围），与 btn-sm 同高 */
        .filter-input {
            height: 30px;
            padding: 0 30px 0 10px;
            border: 1px solid var(--border);
            border-radius: 7px;
            background-color: var(--bg-card);
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23928b7c' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: right 9px center;
            color: var(--text);
            font-family: inherit;
            font-size: 12px;
            line-height: 1.4;
            appearance: none;
            cursor: pointer;
            transition: border-color var(--transition), box-shadow var(--transition), background-color var(--transition);
        }
        .filter-input:hover { border-color: var(--primary); }
        .filter-input:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px var(--primary-bg); }

        .empty-state {
            text-align: center;
            padding: 56px 20px;
            color: var(--text-muted);
        }
        .empty-state-icon { font-size: 48px; margin-bottom: 16px; opacity: 0.6; }
        .empty-state-text { font-size: 14px; font-weight: 500; }

        .validation-status { display: flex; align-items: center; gap: 8px; }
        .user-info-tooltip { font-size: 12px; color: var(--text-secondary); margin-top: 4px; }

        .loading {
            display: inline-block;
            width: 14px;
            height: 14px;
            border: 2px solid rgba(255,255,255,0.3);
            border-top: 2px solid white;
            border-radius: 50%;
            animation: spin 0.6s linear infinite;
        }

        .skeleton {
            background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
            background-size: 200% 100%;
            animation: shimmer 1.5s ease-in-out infinite;
            border-radius: var(--radius-sm);
        }
        .skeleton-text { height: 14px; margin-bottom: 8px; }
        .skeleton-text.short { width: 60%; }

        .help-link {
            display: block;
            text-align: center;
            margin-top: 16px;
            color: var(--primary);
            font-size: 13px;
            cursor: pointer;
            transition: var(--transition);
            font-weight: 500;
        }
        .help-link:hover { text-decoration: underline; }
        .help-content {
            display: none;
            margin-top: 16px;
            padding: 16px;
            background: #f8fafc;
            border-radius: var(--radius-sm);
            border: 1px solid var(--border);
            text-align: left;
            font-size: 12px;
            line-height: 1.8;
        }
        .help-content.show { display: block; animation: fadeUp 0.25s ease; }
        .help-content h4 { margin-bottom: 8px; color: var(--text); font-size: 13px; font-weight: 600; }
        .help-content ol { margin-left: 16px; color: var(--text-secondary); }
        .help-content code {
            background: var(--primary-bg);
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'SF Mono', 'Fira Code', monospace;
            font-size: 11px;
            color: var(--primary);
        }
        .help-section { margin-bottom: 16px; }

        .divider { margin: 28px 0; border: none; border-top: 1px solid var(--border); }

        .form-row { display: flex; gap: 12px; }

        .form-section-title {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 12px;
            font-weight: 700;
            color: var(--text-secondary);
            letter-spacing: 0.5px;
            margin: 26px 0 14px;
            padding-top: 18px;
            border-top: 1px solid var(--border-light);
        }
        .form-section-title .icon { color: var(--primary); width: 14px; height: 14px; }

        .form-inline-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; transition: opacity var(--transition); }
        .form-inline-row input[type="number"] { width: 90px; }
        .form-inline-text { font-size: 13px; color: var(--text-secondary); }

        .checkbox-label,
        /* .form-group label 的 display:block 优先级更高，这里显式提高一级 */
        .form-group label.checkbox-label {
            display: flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
            font-size: 13px;
            color: var(--text);
            font-weight: 500;
        }
        .checkbox-label input[type="checkbox"],
        .form-group label.checkbox-label input[type="checkbox"] {
            width: 16px;
            height: 16px;
            margin: 0;
            flex: 0 0 auto;
            accent-color: var(--primary);
            cursor: pointer;
        }

        .settings-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr));
            gap: 24px;
        }
        .settings-tabs {
            display: flex;
            gap: 4px;
            width: fit-content;
            max-width: 100%;
            margin-bottom: 20px;
            padding: 4px;
            overflow-x: auto;
            border: 1px solid var(--border);
            border-radius: 10px;
            background: var(--panel);
        }
        .settings-tab {
            appearance: none;
            border: 0;
            border-radius: 7px;
            background: transparent;
            padding: 8px 16px;
            color: var(--text-secondary);
            font-family: inherit;
            font-size: 13px;
            font-weight: 600;
            white-space: nowrap;
            cursor: pointer;
            transition: background-color var(--transition), color var(--transition), box-shadow var(--transition);
        }
        .settings-tab:hover { color: var(--text); background: rgba(0, 0, 0, 0.035); }
        .settings-tab.active {
            color: var(--text);
            background: var(--bg-card);
            box-shadow: var(--shadow-xs);
        }
        .settings-tab:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
        .settings-panel { display: none; }
        .settings-panel.active { display: block; animation: fadeIn 0.18s ease; }
        .cache-ttl-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 10px;
        }
        .cache-ttl-item { display: flex; flex-direction: column; gap: 4px; }
        .cache-ttl-item > label {
            margin: 0;
            color: var(--text-secondary);
            font-size: 12px;
            font-weight: 600;
        }
        .cache-ttl-item .cache-ttl-input { display: flex; align-items: center; gap: 6px; }
        .cache-ttl-item .cache-ttl-input input { flex: 1; min-width: 0; padding: 8px 10px; }
        .cache-ttl-item .unit { flex: 0 0 auto; color: var(--text-muted); font-size: 11px; }
        .cache-stat-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 10px;
            margin-bottom: 12px;
        }
        .cache-stat {
            padding: 10px 12px;
            border: 1px solid var(--border);
            border-radius: 8px;
            background: var(--panel);
        }
        .cache-stat span { display: block; color: var(--text-muted); font-size: 11px; }
        .cache-stat b { display: block; margin-top: 4px; color: var(--text); font-size: 15px; font-weight: 700; }
        .input-with-button { display: flex; gap: 8px; align-items: center; }
        .input-with-button input { flex: 1; min-width: 0; }
        .input-with-button .btn { flex: 0 0 auto; }
        .geo-result {
            margin: 4px 0 0;
            padding: 12px;
            border: 1px solid var(--border);
            border-radius: 10px;
            background: var(--panel);
        }
        .geo-result-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
            gap: 8px 14px;
        }
        .geo-result-item span { display: block; color: var(--text-muted); font-size: 11px; }
        .geo-result-item b { display: block; margin-top: 2px; color: var(--text); font-size: 13px; font-weight: 600; word-break: break-all; }
        .geo-result details { margin-top: 10px; }
        .geo-result summary { cursor: pointer; color: var(--text-secondary); font-size: 12px; }
        .geo-result pre {
            max-height: 220px;
            margin-top: 8px;
            padding: 10px;
            overflow: auto;
            border-radius: 8px;
            background: rgba(0,0,0,0.05);
            font-size: 11px;
            line-height: 1.5;
        }
        .settings-section { min-width: 0; }
        .settings-section h4 {
            font-size: 15px;
            font-weight: 700;
            margin-bottom: 18px;
            color: var(--text);
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .monitor-status-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
            gap: 14px;
            margin-bottom: 24px;
        }
        .monitor-status-card {
            background: #f8fafc;
            border: 1px solid var(--border);
            border-radius: var(--radius-sm);
            padding: 18px;
            text-align: center;
            transition: var(--transition);
        }
        .monitor-status-card:hover { border-color: var(--primary-border); }
        .monitor-status-card .stat-value { font-size: 22px; font-weight: 800; }
        .monitor-status-card .stat-label { font-size: 12px; color: var(--text-secondary); margin-top: 4px; font-weight: 500; }

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { box-shadow: 0 0 0 3px var(--success-bg); } 50% { box-shadow: 0 0 0 6px rgba(16,185,129,0.1); } }
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes modalIn { from { opacity: 0; transform: scale(0.95) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes gradientShift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-20px); } }

        @media (max-width: 768px) {
            .sidebar {
                width: 100%;
                height: auto;
                position: fixed;
                bottom: 0;
                top: auto;
                left: 0;
                right: 0;
                z-index: 100;
                flex-direction: row;
                border-top: 1px solid rgba(255,255,255,0.1);
                box-shadow: 0 -2px 12px rgba(0,0,0,0.15);
            }
            .sidebar-brand { display: none; }
            .sidebar-menu {
                display: flex;
                flex-direction: row;
                padding: 0;
                width: 100%;
                overflow-x: auto;
                overflow-y: hidden;
                -webkit-overflow-scrolling: touch;
                scrollbar-width: none;
            }
            .sidebar-menu::-webkit-scrollbar { display: none; }
            .sidebar-menu li {
                flex: 1;
                min-width: 0;
                justify-content: center;
                padding: 10px 6px;
                margin-bottom: 0;
                border-radius: 0;
                flex-direction: column;
                gap: 3px;
                font-size: 10px;
            }
            .sidebar-menu li .menu-icon { font-size: 18px; width: auto; }
            .sidebar-menu li .menu-text { font-size: 10px; white-space: nowrap; }
            .sidebar-menu li.active::before { display: none; }
            .sidebar-menu li.active {
                background: var(--bg-sidebar-active);
                color: var(--primary-light);
            }
            .main-content {
                margin-left: 0;
                margin-bottom: 60px;
                min-height: calc(100vh - 60px);
            }
            .page-content { padding: 16px 14px; }
            .stats-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
            .stat-card { padding: 16px; }
            .stat-value { font-size: 24px; }
            .stat-icon { width: 36px; height: 36px; font-size: 15px; margin-bottom: 10px; }
            .header { padding: 10px 0; }
            .header-inner { padding: 0 14px; }
            .header h3 { font-size: 15px; }
            .card { padding: 16px; margin-bottom: 14px; }
            .card-header { flex-wrap: wrap; gap: 10px; }
            .modal-content { margin: 12px; max-width: calc(100% - 24px); max-height: 90vh; }
            .modal-body { padding: 16px; }
            .modal-header { padding: 16px; }
            .modal-footer { padding: 12px 16px; }
            .table th, .table td { padding: 10px 10px; font-size: 12px; }
            .cookie-preview { max-width: 100px; }
            .actions { flex-wrap: wrap; }
            .btn-sm { padding: 5px 8px; font-size: 11px; }
            .form-row { flex-direction: column; gap: 0; }
            .toast { top: auto; bottom: 72px; right: 12px; left: 12px; max-width: none; font-size: 12px; padding: 10px 14px; }
            .monitor-status-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
            .settings-grid { max-width: none; }
            .settings-tabs { width: 100%; }
            .settings-tab { flex: 1; padding: 8px 10px; }
            .user-info .user-name { display: none; }
            .abuse-config-grid { grid-template-columns: 1fr; gap: 14px; }
            .rule-toggles { grid-template-columns: 1fr 1fr; }
            .ban-form-row { flex-wrap: wrap; }
            .ban-input-reason { flex: 1; min-width: 120px; }
            .ban-btn { width: 100%; }
            .abuse-detail-grid { grid-template-columns: 1fr; }
            .abuse-filters-row > * { flex: 1 1 100%; }
            .logs-toolbar { flex-direction: column; align-items: flex-start; }
            .logs-filters { width: 100%; }
            .filter-input { flex: 1; min-width: 0; }
            .master-switch { padding: 16px; }
        }

        /* Abuse log detail panel */
        .abuse-detail-row td { background: rgba(0,0,0,0.2); padding: 16px !important; }
        .abuse-detail-panel { font-size: 13px; }
        .abuse-detail-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; margin-bottom: 12px; }
        .abuse-detail-item label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-secondary); margin-right: 8px; }
        .abuse-detail-item span, .abuse-detail-item code { color: var(--text-primary); font-family: 'SF Mono', 'Fira Code', monospace; font-size: 12px; word-break: break-all; }
        .abuse-violations-title { font-weight: 600; margin-bottom: 8px; color: var(--text-primary); font-size: 13px; }
        .abuse-violation-list { display: flex; flex-wrap: wrap; gap: 8px; }
        .abuse-violation-card { padding: 8px 12px; border-radius: var(--radius-sm); font-size: 12px; }
        .abuse-vi-high { border-left: 3px solid #ef4444; background: rgba(239,68,68,0.1); }
        .abuse-vi-medium { border-left: 3px solid #f97316; background: rgba(249,115,22,0.1); }
        .abuse-vi-low { border-left: 3px solid #3b82f6; background: rgba(59,130,246,0.1); }
        .abuse-vi-type { font-weight: 600; margin-right: 6px; }
        .abuse-vi-severity { font-size: 10px; padding: 1px 6px; border-radius: 3px; margin-right: 6px; text-transform: uppercase; }
        .sev-high { background: rgba(239,68,68,0.2); color: #ef4444; }
        .sev-medium { background: rgba(249,115,22,0.2); color: #f97316; }
        .sev-low { background: rgba(59,130,246,0.2); color: #3b82f6; }
        .abuse-vi-detail { color: var(--text-secondary); }

        /* Abuse filter bar */
        .abuse-filters-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: flex-end; margin-bottom: 0; }
        .abuse-filters-row .form-group { margin-bottom: 0; }

        /* Small table for Top Requesters */
        .table-sm th, .table-sm td { padding: 6px 10px; font-size: 12px; }
        .top-requester-ip { font-family: monospace; font-size: 12px; }

        @media (max-width: 480px) {
            .stats-grid { grid-template-columns: 1fr; }
            .login-box { padding: 28px 20px; }
            .login-box h1 { font-size: 22px; }
            .stat-value { font-size: 22px; }
            .card-title { font-size: 14px; }
            .monitor-status-grid { grid-template-columns: 1fr 1fr; }
            .badge { font-size: 11px; padding: 2px 8px; }
        }

        @media (max-width: 360px) {
            .sidebar-menu li { padding: 8px 4px; font-size: 9px; }
            .sidebar-menu li .menu-icon { font-size: 16px; }
            .sidebar-menu li .menu-text { font-size: 9px; }
            .page-content { padding: 12px 10px; }
        }
    </style>
    <style id="admin-redesign">
        /* ============================================================
           管理后台视觉重制：纸感底 + 墨色文字 + 橙色强调
           只覆盖外观，不改任何结构与行为
           ============================================================ */
        :root {
            --bg: #f4f1ea;
            --bg-card: #fffdf9;
            --bg-sidebar: #fbf9f4;
            --bg-sidebar-hover: rgba(21, 19, 14, 0.05);
            --bg-sidebar-active: #ffffff;
            --text: #191713;
            --text-secondary: #5f5a50;
            --text-muted: #928b7c;
            --text-sidebar: #6b6457;
            --text-sidebar-active: #191713;
            --border: #e7e1d4;
            --border-light: #f1ece2;
            --primary: #ff6900;
            --primary-light: #ffd2b0;
            --primary-dark: #e85d00;
            --primary-bg: rgba(255, 105, 0, 0.09);
            --primary-border: rgba(255, 105, 0, 0.28);
            --success: #0a8f5a;
            --success-bg: rgba(10, 143, 90, 0.10);
            --warning: #a8690a;
            --warning-bg: rgba(168, 105, 10, 0.10);
            --danger: #c22f28;
            --danger-bg: rgba(194, 47, 40, 0.09);
            --info: #2f6db0;
            --info-bg: rgba(47, 109, 176, 0.09);
            --radius: 12px;
            --radius-sm: 8px;
            --radius-lg: 16px;
            --shadow-xs: 0 1px 2px rgba(25, 23, 19, 0.04);
            --shadow-sm: 0 1px 2px rgba(25, 23, 19, 0.04), 0 8px 20px -12px rgba(25, 23, 19, 0.18);
            --shadow: 0 2px 6px rgba(25, 23, 19, 0.05), 0 18px 36px -22px rgba(25, 23, 19, 0.22);
            --shadow-md: 0 4px 10px rgba(25, 23, 19, 0.06), 0 24px 48px -26px rgba(25, 23, 19, 0.28);
            --shadow-lg: 0 30px 70px -32px rgba(25, 23, 19, 0.45);
            /* 线条语义：--border-strong = 区块边界（重），--border = 控件描边，--border-light = 区块内细分隔 */
            --border-strong: #d9d0be;
            --accent: var(--primary);
            /* 工具面板（表单/筛选/帮助）底色，与纸面区分开，不再靠边框 */
            --panel: #f7f3ea;
            --transition: 0.18s cubic-bezier(0.2, 0.7, 0.3, 1);
            --transition-slow: 0.28s cubic-bezier(0.2, 0.7, 0.3, 1);
        }

        body {
            background: var(--bg);
            color: var(--text);
            font-family: "PingFang SC", "HarmonyOS Sans SC", "Microsoft YaHei", system-ui, sans-serif;
            font-size: 13px;
            letter-spacing: 0.01em;
            /* 数字统一等宽，列向扫视时数字位对齐 */
            font-variant-numeric: tabular-nums;
        }

        ::-webkit-scrollbar-thumb { background: #d8d1c2; border-radius: 999px; }
        ::-webkit-scrollbar-thumb:hover { background: #c2b9a6; }

        /* ---------- 登录 ---------- */
        .login-container {
            padding: 24px;
            background-color: #10151f;
            background-image:
                radial-gradient(60% 50% at 12% 0%, #ffe7d2 0%, rgba(255, 231, 210, 0) 62%),
                radial-gradient(55% 45% at 92% 100%, #e7edf6 0%, rgba(231, 237, 246, 0) 60%),
                linear-gradient(180deg, #faf7f0 0%, #f4f1ea 100%);
        }
        /* 背景图由 /admin/login-bg 提供：服务端缓存，刷新不换图 */
        .login-container.has-login-bg {
            background-color: #10151f;
            background-position: center;
            background-size: cover;
            background-repeat: no-repeat;
        }
        .login-container::after { display: none; }
        .login-container.has-login-bg::after {
            content: '';
            position: absolute;
            inset: 0;
            display: block;
            z-index: 0;
            pointer-events: none;
            background: linear-gradient(180deg, rgba(10,14,22,0.58) 0%, rgba(10,14,22,0.28) 42%, rgba(10,14,22,0.62) 100%);
        }
        .login-container.has-login-bg .login-box {
            background: rgba(255,253,249,0.94);
            border-color: rgba(255,255,255,0.58);
            box-shadow: 0 40px 90px -30px rgba(0,0,0,0.62);
            backdrop-filter: blur(18px) saturate(1.05);
        }
        .login-box {
            max-width: 400px;
            padding: 40px 36px;
            border: 1px solid var(--border);
            border-radius: 18px;
            background: var(--bg-card);
            box-shadow: 0 40px 80px -42px rgba(25, 23, 19, 0.42);
            backdrop-filter: none;
        }
        .login-box h1 {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 8px;
            text-align: left;
            font-size: 22px;
            letter-spacing: 0.02em;
        }
        .login-box h1::before {
            content: '';
            width: 10px;
            height: 10px;
            background: var(--primary);
            border: 1px solid var(--text);
            transform: rotate(45deg);
        }
        .login-box .login-subtitle {
            margin-bottom: 28px;
            text-align: left;
            font-size: 13px;
            color: var(--text-muted);
            letter-spacing: 0.02em;
        }
        .login-box .error-msg { margin-top: 10px; text-align: left; font-size: 12px; }
        .login-box .help-link { text-align: left; margin-top: 14px; font-size: 12px; }

        /* ---------- 侧栏 ---------- */
        .sidebar {
            background: var(--bg-sidebar);
            border-right: 1px solid var(--border);
            color: var(--text-sidebar);
        }
        .sidebar-brand { position: relative; padding: 22px 18px 16px; border-bottom: 1px solid var(--border-light); }
        .sidebar-close {
            display: none;
            position: absolute;
            top: 14px;
            right: 12px;
            align-items: center;
            justify-content: center;
            width: 30px;
            height: 30px;
            border: 1px solid var(--border);
            border-radius: 7px;
            background: transparent;
            color: var(--text-secondary);
            cursor: pointer;
        }
        .sidebar-close:hover { border-color: var(--primary); color: var(--primary-dark); background: var(--primary-bg); }
        .sidebar-close .icon { width: 16px; height: 16px; }
        .sidebar-brand h2 { color: var(--text); font-size: 16px; font-weight: 700; letter-spacing: 0.02em; }
        .sidebar-brand h2 .icon { color: var(--primary); }
        .sidebar-brand .brand-sub {
            margin-top: 6px;
            padding-left: 0;
            color: var(--text-muted);
            font-size: 11px;
            letter-spacing: 0.08em;
        }
        .sidebar-menu { padding: 10px 8px; }
        .sidebar-menu li {
            margin-bottom: 1px;
            padding: 9px 12px;
            border-radius: 8px;
            color: var(--text-sidebar);
            font-size: 13.5px;
            transition: background-color var(--transition), color var(--transition);
        }
        .sidebar-menu li:hover { background: var(--bg-sidebar-hover); color: var(--text); }
        .sidebar-menu li.active {
            background: var(--bg-sidebar-active);
            color: var(--text);
            box-shadow: var(--shadow-xs);
        }
        .sidebar-menu li.active::before {
            left: 0;
            width: 3px;
            height: 16px;
            border-radius: 3px;
            background: var(--primary);
        }
        .sidebar-menu li .menu-icon { color: var(--text-muted); }
        .sidebar-menu li.active .menu-icon { color: var(--primary); }

        /* ---------- 可折叠侧边导航 ---------- */
        .header-title { display: flex; align-items: center; gap: 12px; min-width: 0; }
        .nav-toggle {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 36px;
            height: 36px;
            flex: 0 0 auto;
            border: 1px solid var(--border);
            border-radius: 8px;
            background: transparent;
            color: var(--text-secondary);
            cursor: pointer;
            transition: color var(--transition), border-color var(--transition), background-color var(--transition);
        }
        .nav-toggle:hover { border-color: var(--primary); color: var(--primary-dark); background: var(--primary-bg); }
        .nav-toggle:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
        .nav-toggle .nav-icon { display: none; align-items: center; justify-content: center; }
        .nav-toggle .icon { width: 18px; height: 18px; }
        .nav-toggle-mobile { display: none; }
        .sidebar-foot {
            margin-top: auto;
            padding: 10px 12px 14px;
            border-top: 1px solid var(--border-light);
        }
        .sidebar-toggle {
            width: 100%;
            height: 38px;
            justify-content: flex-start;
            gap: 10px;
            padding: 0 10px;
            border-radius: 8px;
        }
        .nav-toggle-label {
            font-size: 12px;
            font-weight: 600;
            letter-spacing: 0.02em;
            white-space: nowrap;
        }
        .nav-backdrop { display: none; }

        @media (min-width: 769px) {
            body:not(.nav-collapsed) .nav-toggle .nav-icon-collapse { display: inline-flex; }
            body.nav-collapsed .nav-toggle .nav-icon-open { display: inline-flex; }

            /* 桌面端收起为图标栏 */
            body.nav-collapsed .sidebar { width: 72px; }
            body.nav-collapsed .main-content { margin-left: 72px; }
            body.nav-collapsed .sidebar-brand { padding: 22px 8px 16px; text-align: center; }
            body.nav-collapsed .sidebar-brand h2 { justify-content: center; gap: 0; }
            body.nav-collapsed .brand-text,
            body.nav-collapsed .brand-sub { display: none; }
            body.nav-collapsed .sidebar-menu { padding: 10px 8px; }
            body.nav-collapsed .sidebar-menu li { justify-content: center; gap: 0; padding: 11px 0; }
            body.nav-collapsed .sidebar-menu li .menu-text { display: none; }
            body.nav-collapsed .sidebar-menu li.active::before { left: 0; }
            body.nav-collapsed .sidebar-foot { padding: 10px 8px 14px; }
            body.nav-collapsed .sidebar-toggle { justify-content: center; padding: 0; }
            body.nav-collapsed .sidebar-toggle .nav-toggle-label { display: none; }
        }

        /* ---------- 顶栏 ---------- */
        .header {
            padding: 13px 0;
            border-bottom: 1px solid var(--border);
            background: rgba(251, 249, 244, 0.92);
            backdrop-filter: blur(10px);
        }
        .header h3 { font-size: 17px; font-weight: 700; letter-spacing: 0.02em; }
        .user-name {
            padding: 4px 10px;
            border-radius: 999px;
            background: var(--primary-bg);
            color: var(--primary-dark);
            font-size: 12px;
            font-weight: 600;
        }
        .page-content { padding: 26px 32px 40px; }

        /* ---------- 卡片 ---------- */
        .card {
            padding: 22px;
            margin-bottom: 18px;
            border: 1px solid var(--border);
            border-radius: var(--radius);
            background: var(--bg-card);
            box-shadow: var(--shadow-sm);
        }
        .card:hover { box-shadow: var(--shadow); }
        .card-header { margin-bottom: 16px; }
        .card-title { font-size: 15px; font-weight: 700; letter-spacing: 0.01em; }

        .stats-grid { gap: 14px; margin-bottom: 20px; }
        .stat-card {
            padding: 20px;
            border: 1px solid var(--border);
            border-radius: var(--radius);
            background: var(--bg-card);
            box-shadow: var(--shadow-sm);
        }
        .stat-card:hover { transform: translateY(-2px); box-shadow: var(--shadow); }
        .stat-card::after { display: none; }
        .stat-icon {
            width: 38px;
            height: 38px;
            margin-bottom: 14px;
            border-radius: 10px;
            border: 1px solid var(--border-light);
        }
        .stat-card.blue .stat-icon { color: var(--primary); background: var(--primary-bg); }
        .stat-card.green .stat-icon { color: var(--success); background: var(--success-bg); }
        .stat-card.orange .stat-icon { color: var(--warning); background: var(--warning-bg); }
        .stat-card.red .stat-icon { color: var(--danger); background: var(--danger-bg); }
        .stat-value { font-size: 28px; font-weight: 700; letter-spacing: -0.02em; }
        .stat-label {
            margin-top: 4px;
            color: var(--text-muted);
            font-size: 12px;
            letter-spacing: 0.02em;
        }
        /* 防护概览：图标在数据左侧，而不是压在数据上方 */
        .abuse-stat { display: flex; align-items: center; gap: 14px; }
        .abuse-stat .stat-icon { margin-bottom: 0; flex: 0 0 auto; }
        .abuse-stat .stat-body { min-width: 0; }
        .abuse-stat .stat-label { margin-top: 2px; }

        /* ---------- 表格 ---------- */
        .table th {
            padding: 10px 14px;
            border-bottom: 1px solid var(--border);
            color: var(--text-muted);
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 0.08em;
            text-transform: none;
        }
        .table td {
            padding: 12px 14px;
            border-bottom: 1px solid var(--border-light);
            font-size: 13px;
        }
        .table tbody tr:nth-child(even) { background: transparent; }
        .table tbody tr:hover { background: #faf6ee; }
        .table-sm td, .table-sm th { padding: 8px 10px; font-size: 12px; }

        /* ---------- 徽标 / 状态 ---------- */
        .badge {
            padding: 3px 9px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 0.02em;
        }
        .status-dot { width: 7px; height: 7px; margin-right: 7px; }
        .status-active { box-shadow: 0 0 0 3px var(--success-bg); }

        /* ---------- 仪表盘看板 ---------- */
        .board-kpis {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 12px;
            margin-bottom: 16px;
        }
        .kpi {
            padding: 16px;
            border: 1px solid var(--border);
            border-radius: var(--radius);
            background: var(--bg-card);
            box-shadow: var(--shadow-sm);
        }
        .kpi-label { color: var(--text-muted); font-size: 11px; letter-spacing: 0.06em; }
        .kpi-value {
            margin-top: 6px;
            font-size: 28px;
            font-weight: 700;
            letter-spacing: -0.02em;
            font-variant-numeric: tabular-nums;
        }
        .kpi-sub { margin-top: 2px; color: var(--text-muted); font-size: 11px; }

        .board-grid { display: grid; grid-template-columns: 1.7fr 1fr; gap: 16px; margin-bottom: 16px; }
        .board-grid-3 { grid-template-columns: 1.2fr 1fr 1fr; }

        .bars {
            display: flex;
            align-items: flex-end;
            gap: 3px;
            height: 210px;
            padding: 6px 0;
            border-bottom: 1px solid var(--border-light);
        }
        .bar {
            display: flex;
            flex: 1;
            flex-direction: column;
            justify-content: flex-end;
            height: 100%;
            min-width: 3px;
            overflow: hidden;
            border-radius: 2px 2px 0 0;
        }
        .bar span { display: block; width: 100%; }
        .bar .ok { background: var(--primary); }
        .bar .err { background: var(--danger); }
        .bar:hover .ok { background: var(--primary-dark); }
        .bars-axis {
            display: flex;
            justify-content: space-between;
            margin-top: 6px;
            color: var(--text-muted);
            font-size: 10px;
        }

        .rows { display: flex; flex-direction: column; gap: 2px; }
        .list-row {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 7px 0;
            border-bottom: 1px solid var(--border-light);
        }
        .list-row:last-child { border-bottom: 0; }
        .list-name {
            flex: 0 0 132px;
            overflow: hidden;
            font-size: 13px;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .share { flex: 1; min-width: 40px; height: 4px; overflow: hidden; border-radius: 99px; background: #efeadd; }
        .share i { display: block; height: 100%; border-radius: 99px; background: var(--primary); }
        /* 数值列统一宽度右对齐：各行的条与数字落在同一竖线上 */
        .list-val { flex: 0 0 auto; min-width: 44px; margin-left: auto; text-align: right; color: var(--text-muted); font-size: 11px; font-variant-numeric: tabular-nums; }
        /* 请求类型的字段都很短，单独收窄标签列，避免标签与条形之间出现大片空档 */
        #boardTypes .list-name { flex-basis: 78px; }

        @media (max-width: 1100px) {
            .board-grid, .board-grid-3 { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 760px) {
            .board-grid, .board-grid-3 { grid-template-columns: 1fr; }
        }

        /* 品牌 logo */
        .login-brand { display: flex; align-items: center; gap: 12px; margin-bottom: 6px; }
        .login-brand img { width: 42px; height: 42px; border-radius: 10px; }
        .login-brand h1 { margin-bottom: 0; }
        .login-box h1::before { content: none; }
        .sidebar-brand h2 .brand-logo {
            width: 22px;
            height: 22px;
            margin-right: 2px;
            border-radius: 5px;
            vertical-align: -4px;
        }

        /* 合并后的区块标题 */
        .merge-block { margin-top: 40px; padding-top: 24px; border-top: 1px solid var(--border-strong); }
        .merge-title { margin-bottom: 16px; font-size: 15px; font-weight: 700; letter-spacing: 0.02em; }

        /* 工具面板：表单 / 筛选 / 帮助等「可操作面」，浅底填充，不加边框 */
        .tool-panel {
            padding: 20px 22px;
            border-radius: var(--radius);
            background: var(--panel);
        }
        .tool-panel > *:last-child { margin-bottom: 0; }
        /* 设置类表单统一贴左，不居中；限宽避免输入框过长 */
        .form-narrow { max-width: 460px; margin: 0; }
        .form-wide { max-width: 680px; margin: 0; }

        /* 取消卡片外框：用分隔线组织内容 */
        .card {
            padding: 0;
            margin-bottom: 24px;
            border: 0;
            border-radius: 0;
            background: transparent;
            box-shadow: none;
        }
        .card:hover { box-shadow: none; }
        .card .card-header {
            /* 固定高度：带按钮的标题栏与纯文字标题栏底线必须落在同一水平线上 */
            min-height: 40px;
            margin-bottom: 16px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--border);
        }
        /* 头部按钮统一高度，保证并排区块的标题底线落在同一条线上 */
        .card-header .btn { padding: 5px 12px; font-size: 12px; line-height: 1.4; }
        .stat-card, .kpi {
            padding: 0;
            border: 0;
            border-radius: 0;
            background: transparent;
            box-shadow: none;
        }
        .stats-grid { gap: 26px; }
        .stat-card:hover { transform: none; box-shadow: none; }
        /* 指标块统一签名：label / value / sub 三行，靠字级与留白分层（不加装饰线） */
        .kpi {
            padding: 2px 0;
        }
        .kpi-value.value-text { font-size: 20px; letter-spacing: 0; }
        .kpi-value.value-time { font-size: 15px; font-weight: 600; letter-spacing: 0; }
        .monitor-status-grid { grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 0; }

        /* 图表图例：色片 + 文字，替代纯文字说明 */
        .chart-legend {
            display: flex;
            align-items: center;
            gap: 16px;
            margin-top: 10px;
            color: var(--text-muted);
            font-size: 11px;
        }
        .legend-item { display: inline-flex; align-items: center; gap: 6px; }
        .legend-swatch { width: 8px; height: 8px; border-radius: 2px; }
        .legend-ok { background: var(--primary); }
        .legend-err { background: var(--danger); }
        .legend-note { margin-left: auto; }

        /* 手机端：导航收进左侧抽屉，由顶栏汉堡按钮展开 */
        @media (max-width: 768px) {
            .nav-backdrop {
                display: block;
                position: fixed;
                inset: 0;
                z-index: 110;
                background: rgba(25, 23, 19, 0.38);
                opacity: 0;
                pointer-events: none;
                transition: opacity var(--transition);
            }
            body.nav-open .nav-backdrop { opacity: 1; pointer-events: auto; }
            body.nav-open { overflow: hidden; }
            .nav-toggle .nav-icon-menu { display: inline-flex; }
            .nav-toggle-mobile { display: inline-flex; }
            .sidebar-foot { display: none; }
            .sidebar {
                position: fixed;
                left: 0;
                top: 0;
                width: min(78vw, 260px);
                height: 100vh;
                flex-direction: column;
                transform: translateX(-100%);
                transition: transform var(--transition-slow);
                z-index: 120;
                border-right: 1px solid var(--border);
                border-bottom: 0;
                background: var(--bg-sidebar);
                box-shadow: var(--shadow-lg);
            }
            body.nav-open .sidebar { transform: translateX(0); }
            .sidebar-brand { display: block; padding: 20px 18px 16px; text-align: left; }
            .sidebar-brand .brand-sub { display: block; }
            .sidebar-close { display: inline-flex; }
            .sidebar-menu {
                flex-direction: column;
                gap: 2px;
                width: auto;
                padding: 10px 8px;
                overflow-x: hidden;
                overflow-y: auto;
            }
            .sidebar-menu li {
                flex: 0 0 auto;
                min-width: 0;
                flex-direction: row;
                justify-content: flex-start;
                gap: 10px;
                padding: 11px 12px;
                border-radius: 8px;
                font-size: 13.5px;
                white-space: normal;
            }
            .sidebar-menu li .menu-icon { width: 22px; font-size: 16px; }
            .sidebar-menu li .menu-text { display: inline; font-size: 13.5px; white-space: nowrap; }
            .sidebar-menu li.active {
                background: var(--bg-sidebar-active);
                color: var(--text);
                box-shadow: var(--shadow-xs);
            }
            .sidebar-menu li.active::before { display: block; left: 0; }
            .main-content { margin-left: 0; margin-bottom: 0; min-height: 100vh; }
            .monitor-status-grid { grid-template-columns: repeat(2, 1fr); gap: 14px; }
            .kpi-value.value-time { font-size: 14px; }
        }

        /* ---------- 按钮 ---------- */
        .btn {
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 600;
            letter-spacing: 0.02em;
        }
        .btn-primary { background: var(--primary); color: #fff; }
        .btn-primary:hover {
            background: var(--primary-dark);
            box-shadow: 0 6px 16px -6px rgba(255, 105, 0, 0.55);
        }
        .btn-danger:hover { background: #a92822; box-shadow: none; }
        .btn-default { border: 1px solid var(--border); background: transparent; }
        .btn-default:hover { border-color: var(--primary); color: var(--primary-dark); background: var(--primary-bg); }
        .btn-success:hover, .btn-warning:hover { box-shadow: none; }
        .btn-sm { padding: 6px 12px; font-size: 12px; border-radius: 7px; }
        .btn-lg { padding: 11px 26px; font-size: 14px; border-radius: 9px; }

        /* ---------- 表单 ---------- */
        .form-group label {
            margin-bottom: 6px;
            color: var(--text-secondary);
            font-size: 12px;
            font-weight: 600;
            letter-spacing: 0.04em;
        }
        .form-group input,
        .form-group select,
        .form-group textarea {
            padding: 10px 12px;
            border: 1px solid var(--border);
            border-radius: var(--radius-sm);
            background: #fff;
            font-size: 13px;
        }
        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
            border-color: var(--primary);
            box-shadow: 0 0 0 3px var(--primary-bg);
        }
        .form-group input:disabled { background: #f5f2ec; }
        .checkbox-label input[type="checkbox"] { accent-color: var(--primary); }
        .form-section-title {
            margin: 24px 0 12px;
            padding-top: 16px;
            border-top: 1px solid var(--border-light);
            color: var(--text-muted);
            font-size: 11px;
            letter-spacing: 0.16em;
            text-transform: uppercase;
        }
        .help-content { border: 1px solid var(--border); background: #faf7f0; }
        .help-content code { background: var(--primary-bg); color: var(--primary-dark); }

        /* ---------- 弹窗 ---------- */
        .modal { background: rgba(25, 23, 19, 0.38); backdrop-filter: blur(4px); }
        .modal-content {
            max-width: 540px;
            border: 1px solid var(--border);
            border-radius: 18px;
            background: var(--bg-card);
            box-shadow: var(--shadow-lg);
        }
        .modal-header { padding: 18px 22px; border-bottom: 1px solid var(--border); }
        .modal-header h3 { font-size: 15px; letter-spacing: 0.01em; }
        .modal-body { padding: 20px 22px; }
        .modal-footer {
            padding: 14px 22px;
            border-top: 1px solid var(--border);
            border-radius: 0 0 18px 18px;
            background: #faf7f0;
        }
        .modal-close { border-radius: 8px; }
        .modal-close:hover { background: var(--bg-sidebar-hover); }

        /* ---------- 提示 ---------- */
        .toast {
            border-radius: 10px;
            background: var(--text);
            color: #fdfaf4;
            font-size: 12.5px;
            box-shadow: var(--shadow-md);
        }
        .toast-success { background: #14664a; }
        .toast-error { background: #8f2620; }

        /* ---------- 其余细节 ---------- */
        .empty-state { padding: 48px 20px; }
        .empty-state-icon { font-size: 40px; opacity: 0.5; }
        .cookie-preview { font-size: 11.5px; color: var(--text-muted); }

        /* ---------- Cookie 卡片 ---------- */
        .cookie-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
            gap: 16px;
        }
        .cookie-card {
            display: flex;
            flex-direction: column;
            min-width: 0;
            padding: 16px;
            border: 1px solid var(--border-light);
            border-radius: 12px;
            background: var(--bg-card);
            transition: border-color var(--transition), box-shadow var(--transition), transform var(--transition);
        }
        .cookie-card:hover { border-color: var(--border-strong); box-shadow: var(--shadow-sm); transform: translateY(-1px); }
        .cookie-card-head { display: flex; align-items: flex-start; gap: 12px; }
        .cookie-avatar {
            display: grid;
            place-items: center;
            width: 42px;
            height: 42px;
            flex: 0 0 auto;
            overflow: hidden;
            border-radius: 50%;
            background: var(--primary-bg);
            color: var(--primary-dark);
            font-size: 15px;
            font-weight: 700;
        }
        .cookie-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .cookie-avatar span { display: none; }
        .cookie-avatar.is-fallback span { display: block; }
        .cookie-identity { flex: 1; min-width: 0; }
        .cookie-platform { display: flex; align-items: center; gap: 6px; color: var(--text-muted); font-size: 11px; }
        .cookie-platform-ico {
            width: 14px;
            height: 14px;
            flex: 0 0 auto;
            border-radius: 3px;
            background-position: center;
            background-repeat: no-repeat;
            background-size: contain;
        }
        .cookie-platform-ico[data-platform="netease"] { background-image: url("${platformIcons.netease}"); }
        .cookie-platform-ico[data-platform="tencent"] { background-image: url("${platformIcons.tencent}"); }
        .cookie-name {
            margin-top: 3px;
            overflow: hidden;
            color: var(--text);
            font-size: 14px;
            font-weight: 700;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .cookie-sub { margin-top: 2px; overflow: hidden; color: var(--text-muted); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
        .cookie-head-side { display: flex; flex-direction: column; align-items: flex-end; gap: 5px; flex: 0 0 auto; }
        .cookie-active-text { color: var(--text-muted); font-size: 10px; }
        .ck-switch { position: relative; display: inline-flex; align-items: center; cursor: pointer; }
        .ck-switch input { position: absolute; width: 0; height: 0; opacity: 0; }
        .ck-track {
            position: relative;
            display: block;
            width: 34px;
            height: 20px;
            border-radius: 999px;
            background: #dcd5c6;
            transition: background-color var(--transition);
        }
        .ck-thumb {
            position: absolute;
            top: 3px;
            left: 3px;
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background: #fff;
            box-shadow: 0 1px 2px rgba(25, 23, 19, 0.18);
            transition: transform var(--transition);
        }
        .ck-switch input:checked + .ck-track { background: var(--primary); }
        .ck-switch input:checked + .ck-track .ck-thumb { transform: translateX(14px); }
        .ck-switch input:focus-visible + .ck-track { box-shadow: 0 0 0 3px var(--primary-bg); }
        .cookie-card-body {
            display: flex;
            flex-direction: column;
            gap: 10px;
            /* 统一底色：不用内部横线，也不做明暗分区，只靠间距和字级分层 */
            margin-top: 14px;
        }
        .cookie-kv { display: flex; align-items: baseline; gap: 10px; min-width: 0; }
        .cookie-kv-label { flex: 0 0 58px; color: var(--text-muted); font-size: 10px; letter-spacing: 0.04em; }
        .cookie-kv-value { flex: 1; min-width: 0; }
        .cookie-preview-line { display: block; overflow: hidden; color: var(--text-muted); font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
        .cookie-facts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
        .cookie-fact { min-width: 0; }
        .cookie-fact-label { display: block; color: var(--text-muted); font-size: 10px; letter-spacing: 0.04em; }
        .cookie-fact-value { display: block; margin-top: 2px; overflow: hidden; color: var(--text); font-size: 11.5px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
        .cookie-fact-value.ok { color: var(--success); }
        .cookie-fact-value.svip { color: var(--primary-dark); }
        .cookie-fact-value.bad { color: var(--danger); }
        .cookie-fact-value.muted { color: var(--text-muted); font-weight: 500; }
        .cookie-error { margin-top: 2px; padding: 7px 9px; border-radius: 6px; background: var(--danger-bg); color: var(--danger); font-size: 11px; line-height: 1.45; }
        .cookie-card-foot { display: flex; align-items: center; justify-content: flex-end; gap: 8px; margin-top: 12px; }
        .cookie-actions { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
        .cookie-actions .btn { padding: 5px 10px; font-size: 11px; }
        .cookie-empty { grid-column: 1 / -1; padding: 44px 20px; border: 1px dashed var(--border); border-radius: 12px; text-align: center; color: var(--text-muted); }
        .cookie-empty .empty-state-text { color: var(--text-secondary); }
        .cookie-empty p { margin-top: 6px; font-size: 12px; }
        .divider { margin: 24px 0; border-top: 1px solid var(--border-light); }
        .settings-section h4 { font-size: 14px; letter-spacing: 0.01em; }
        .login-bg-preview {
            position: relative;
            aspect-ratio: 16 / 9;
            margin-bottom: 12px;
            border: 1px solid var(--border-strong);
            border-radius: 12px;
            overflow: hidden;
            background: #10151f;
        }
        .login-bg-preview img {
            display: block;
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        .login-bg-preview.is-empty::before {
            content: '尚未缓存背景图';
            position: absolute;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            color: rgba(255,255,255,0.55);
            font-size: 12px;
            letter-spacing: 0.04em;
        }
        .login-bg-preview.is-empty img { visibility: hidden; }
        .abuse-violation-card,
        .abuse-detail-panel,
        .logs-toolbar {
            border: 1px solid var(--border);
            border-radius: var(--radius-sm);
            background: var(--bg-card);
        }

        @media (max-width: 760px) {
            .login-box { padding: 30px 24px; }
            .page-content { padding: 18px 16px 32px; }
            .header-inner { padding: 0 16px; }
        }
    </style>
</head>
<body>
    <script>
        // 有登录令牌时先进入“验证中”状态，避免刷新时登录页闪一下
        try {
            if (localStorage.getItem('authToken')) document.body.classList.add('auth-pending');
        } catch (_) {}
    </script>
    <div class="auth-loading" id="authLoading" role="status" aria-live="polite">
        <img src="${logoDataUri}" alt="" width="32" height="32">
        <span>正在加载管理后台…</span>
    </div>
    <div class="login-container${loginBgClass}" id="loginContainer"${loginBgStyle}>
        <div class="login-box" id="loginBox">
            <div class="login-brand"><img src="${logoDataUri}" alt="Meting" width="42" height="42"><h1>Meting-API</h1></div>
            <p class="login-subtitle">管理后台登录</p>
            <form id="loginForm">
                <div class="form-group">
                    <label>用户名</label>
                    <input type="text" id="loginUsername" required placeholder="请输入用户名">
                </div>
                <div class="form-group">
                    <label>密码</label>
                    <input type="password" id="loginPassword" required placeholder="请输入密码">
                </div>
                <div class="error-msg" id="loginError"></div>
                <button type="submit" class="btn btn-primary btn-lg btn-full" style="margin-top:8px;">登 录</button>
            </form>
        </div>
        <div class="login-box" id="twoFactorBox" style="display:none;">
            <h1>${icon('lock')} 双因素认证</h1>
            <p class="login-subtitle">请输入认证器中的验证码</p>
            <form id="twoFactorForm">
                <input type="hidden" id="twoFactorUsername">
                <div class="form-group">
                    <label>验证码</label>
                    <input type="text" id="twoFactorCode" required placeholder="6位数字验证码" maxlength="6" pattern="[0-9]{6}" inputmode="numeric" autocomplete="one-time-code" style="text-align:center;font-size:24px;letter-spacing:8px;font-weight:700;">
                </div>
                <div class="error-msg" id="twoFactorError"></div>
                <button type="submit" class="btn btn-primary btn-lg btn-full" style="margin-top:8px;">验 证</button>
                <button type="button" class="btn btn-default btn-full" style="margin-top:8px;" onclick="cancel2FA()">返回登录</button>
            </form>
        </div>
    </div>

    <div class="admin-container" id="adminContainer">
        <div class="sidebar" id="adminSidebar">
            <div class="sidebar-brand">
                <button type="button" class="sidebar-close" id="navClose" aria-label="关闭导航">${icon('xmark')}</button>
                <h2><img class="brand-logo" src="${logoDataUri}" alt="" width="22" height="22"> <span class="brand-text">Meting</span></h2>
                <span class="brand-sub">管理后台</span>
            </div>
            <ul class="sidebar-menu">
                <li class="active" data-section="dashboard"><span class="menu-icon">${icon('dashboard')}</span><span class="menu-text">仪表盘</span></li>
                <li data-section="cookies"><span class="menu-icon">${icon('cookie')}</span><span class="menu-text">Cookie 与监测</span></li>
                <li data-section="tokens"><span class="menu-icon">${icon('key')}</span><span class="menu-text">API Token</span></li>
                <li data-section="abuse"><span class="menu-icon">${icon('shield')}</span><span class="menu-text">滥用防护</span></li>
                <li data-section="users"><span class="menu-icon">${icon('users')}</span><span class="menu-text">用户管理</span></li>
                <li data-section="logs"><span class="menu-icon">${icon('list')}</span><span class="menu-text">操作日志</span></li>
                <li data-section="apilogs"><span class="menu-icon">${icon('radio')}</span><span class="menu-text">API 调用日志</span></li>
                <li data-section="settings"><span class="menu-icon">${icon('settings')}</span><span class="menu-text">设置</span></li>
            </ul>
            <div class="sidebar-foot">
                <button type="button" class="nav-toggle sidebar-toggle" id="navToggle" aria-label="收起导航" aria-controls="adminSidebar" aria-expanded="true">
                    <span class="nav-icon nav-icon-collapse">${icon('panelClose')}</span>
                    <span class="nav-icon nav-icon-open">${icon('panelOpen')}</span>
                    <span class="nav-toggle-label">收起侧栏</span>
                </button>
            </div>
        </div>
        <div class="nav-backdrop" id="navBackdrop" aria-hidden="true"></div>
        <div class="main-content">
            <div class="header">
                <div class="header-inner">
                    <div class="header-title">
                        <button type="button" class="nav-toggle nav-toggle-mobile" id="navToggleMobile" aria-label="打开导航" aria-controls="adminSidebar" aria-expanded="false">
                            <span class="nav-icon nav-icon-menu">${icon('menu')}</span>
                        </button>
                        <h3 id="pageTitle">仪表盘</h3>
                    </div>
                    <div class="user-info">
                        <span class="user-name" id="currentUser"></span>
                        <button class="btn btn-default btn-sm" onclick="logout()">退出登录</button>
                    </div>
                </div>
            </div>

            <div class="page-content">
                <div class="content-section active" id="dashboardSection">
                    <div class="board-kpis">
                        <div class="kpi"><div class="kpi-label">24h 请求</div><div class="kpi-value" id="kpiCalls">-</div><div class="kpi-sub" id="kpiCallsSub">累计 -</div></div>
                        <div class="kpi"><div class="kpi-label">成功率</div><div class="kpi-value" id="kpiRate">-</div><div class="kpi-sub">近 24 小时</div></div>
                        <div class="kpi"><div class="kpi-label">独立 IP</div><div class="kpi-value" id="kpiIPs">-</div><div class="kpi-sub">近 24 小时</div></div>
                        <div class="kpi"><div class="kpi-label">有效 Cookie</div><div class="kpi-value" id="kpiCookies">-</div><div class="kpi-sub" id="kpiCookiesSub">有效 / 总数</div></div>
                        <div class="kpi"><div class="kpi-label">封禁 IP</div><div class="kpi-value" id="kpiBans">-</div><div class="kpi-sub">当前生效</div></div>
                        <div class="kpi"><div class="kpi-label">来源站点</div><div class="kpi-value" id="kpiSources">-</div><div class="kpi-sub">近 24 小时</div></div>
                    </div>

                    <div class="board-grid">
                        <section class="card">
                            <div class="card-header">
                                <span class="card-title">近 24 小时请求</span>
                                <button class="btn btn-default btn-sm" onclick="loadDashboard()">刷新</button>
                            </div>
                            <div class="bars" id="boardBars"></div>
                            <div class="bars-axis" id="boardAxis"></div>
                            <p class="chart-legend">
                                <span class="legend-item"><i class="legend-swatch legend-ok"></i>成功</span>
                                <span class="legend-item"><i class="legend-swatch legend-err"></i>失败</span>
                                <span class="legend-note">每根柱子代表一小时，悬停可见明细</span>
                            </p>
                        </section>
                        <section class="card">
                            <div class="card-header"><span class="card-title">请求类型</span></div>
                            <div class="rows" id="boardTypes"></div>
                        </section>
                    </div>

                    <div class="board-grid board-grid-3">
                        <section class="card">
                            <div class="card-header"><span class="card-title">来源站点</span></div>
                            <div class="rows" id="boardSources"></div>
                        </section>
                        <section class="card">
                            <div class="card-header"><span class="card-title">Cookie 健康度</span></div>
                            <div class="rows" id="boardCookies"></div>
                        </section>
                        <section class="card">
                            <div class="card-header"><span class="card-title">最近操作</span></div>
                            <div class="rows" id="boardOps"></div>
                        </section>
                    </div>
                </div>

                <div class="content-section" id="cookiesSection">
                    <div class="card">
                        <div class="card-header">
                            <span class="card-title">Cookie 列表</span>
                            <div style="display:flex;gap:8px;flex-wrap:wrap;">
                                ${neteaseQrLoginEnabled ? `<button class="btn btn-primary btn-sm" onclick="openQrLogin()">${icon('qr')} 网易云扫码登录</button>` : ''}
                                <button class="btn ${neteaseQrLoginEnabled ? 'btn-default' : 'btn-primary'} btn-sm" onclick="showAddCookieModal()">添加 Cookie</button>
                            </div>
                        </div>
                        <div class="cookie-grid" id="cookiesList"></div>
                    </div>

                    <div class="merge-block" id="monitorSection">
                        <h2 class="merge-title">自动监测与通知</h2>
                    <div class="card">
                        <div class="card-header">
                            <span class="card-title">监测状态</span>
                            <button class="btn btn-primary btn-sm" onclick="checkNow()">立即检查</button>
                        </div>
                        <div class="monitor-status-grid">
                            <div class="kpi">
                                <div class="kpi-label">监测状态</div>
                                <div class="kpi-value value-text" id="monitorStatus">-</div>
                                <div class="kpi-sub">定时自动检查</div>
                            </div>
                            <div class="kpi">
                                <div class="kpi-label">检查间隔</div>
                                <div class="kpi-value" id="monitorInterval">-</div>
                                <div class="kpi-sub">分钟</div>
                            </div>
                            <div class="kpi">
                                <div class="kpi-label">检查次数</div>
                                <div class="kpi-value" id="monitorCheckCount">0</div>
                                <div class="kpi-sub">自启动以来</div>
                            </div>
                            <div class="kpi">
                                <div class="kpi-label">上次检查</div>
                                <div class="kpi-value value-time" id="monitorLastCheck">-</div>
                                <div class="kpi-sub">本地时间</div>
                            </div>
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-header"><span class="card-title">监测设置</span></div>
                        <form id="monitorForm" class="tool-panel form-narrow">
                            <div class="form-group">
                                <label class="checkbox-label"><input type="checkbox" id="monitorEnabled"> 启用定时监测</label>
                            </div>
                            <div class="form-group">
                                <label>检查间隔（分钟）</label>
                                <input type="number" id="monitorIntervalInput" min="5" max="1440" value="60">
                                <small>最小 5 分钟，最大 1440 分钟（24 小时）</small>
                            </div>
                            <button type="submit" class="btn btn-primary">保存设置</button>
                        </form>
                    </div>

                    <div class="card">
                        <div class="card-header"><span class="card-title">Webhook 通知设置</span></div>
                        <form id="webhookForm" class="tool-panel form-wide">
                            <div class="form-group">
                                <label class="checkbox-label"><input type="checkbox" id="webhookEnabled"> 启用 Webhook 通知</label>
                            </div>
                            <div class="form-group">
                                <label>Webhook URL</label>
                                <input type="text" id="webhookUrl" placeholder="https://example.com/webhook">
                            </div>
                            <div class="form-group">
                                <label>Content-Type</label>
                                <select id="webhookContentType" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg);color:var(--text);font-size:13px;">
                                    <option value="application/json">application/json</option>
                                    <option value="application/x-www-form-urlencoded">application/x-www-form-urlencoded</option>
                                </select>
                                <small>根据目标服务要求选择</small>
                            </div>
                            <div class="form-group">
                                <label>自定义 Headers（JSON 格式）</label>
                                <textarea id="webhookHeaders" rows="3" placeholder='{"Authorization": "Bearer xxx"}'></textarea>
                                <small>可选，用于添加认证等自定义请求头</small>
                            </div>
                            <div class="form-group">
                                <label>Body 模板（JSON 格式，可选）</label>
                                <textarea id="webhookBodyTemplate" rows="5" placeholder='{"msgtype":"markdown","markdown":{"title":"{{title}}","text":"{{message}}"}}'></textarea>
                                <small>留空使用默认格式。支持变量：{{title}}、{{message}}、{{priority}}、{{event}}、{{time}}</small>
                            </div>
                            <div class="form-row">
                                <button type="submit" class="btn btn-primary">保存 Webhook</button>
                                <button type="button" class="btn btn-default" onclick="testWebhook()">测试发送</button>
                            </div>
                        </form>
                    </div>

                    <div class="card">
                        <div class="card-header"><span class="card-title">SMTP 邮件通知</span></div>
                        <form id="smtpForm" class="tool-panel form-wide">
                            <div class="form-group">
                                <label class="checkbox-label"><input type="checkbox" id="smtpEnabled"> 启用邮件通知</label>
                            </div>
                            <div class="form-row">
                                <div class="form-group" style="flex:2;">
                                    <label>SMTP 服务器</label>
                                    <input type="text" id="smtpHost" placeholder="smtp.example.com">
                                </div>
                                <div class="form-group" style="flex:1;">
                                    <label>端口</label>
                                    <input type="number" id="smtpPort" placeholder="465">
                                </div>
                            </div>
                            <div class="form-group">
                                <label class="checkbox-label"><input type="checkbox" id="smtpSecure" checked> 使用 SSL/TLS 加密</label>
                            </div>
                            <div class="form-row">
                                <div class="form-group" style="flex:1;">
                                    <label>发件人邮箱</label>
                                    <input type="email" id="smtpFrom" placeholder="noreply@example.com">
                                </div>
                                <div class="form-group" style="flex:1;">
                                    <label>用户名</label>
                                    <input type="text" id="smtpUser" placeholder="noreply@example.com">
                                </div>
                            </div>
                            <div class="form-group">
                                <label>密码 / 授权码</label>
                                <input type="password" id="smtpPass" placeholder="SMTP授权码（非邮箱密码）" autocomplete="new-password">
                            </div>
                            <div class="form-group">
                                <label>收件人邮箱</label>
                                <input type="text" id="smtpTo" placeholder="admin@example.com（多个用逗号分隔）">
                            </div>
                            <div class="form-row">
                                <button type="submit" class="btn btn-primary">保存 SMTP</button>
                                <button type="button" class="btn btn-default" onclick="testSmtp()">发送测试邮件</button>
                            </div>
                        </form>
                    </div>

                    <div class="card">
                        <div class="card-header"><span class="card-title">监测历史</span></div>
                        <div class="table-container">
                            <table class="table">
                                <thead><tr><th>时间</th><th>类型</th><th>详情</th></tr></thead>
                                <tbody id="monitorLogsList"></tbody>
                            </table>
                        </div>
                        <div class="pager" id="monitorLogPagination">
                            <button class="btn btn-default btn-sm" onclick="loadMonitorLogs(1)" id="monitorLogFirstBtn" disabled>首页</button>
                            <button class="btn btn-default btn-sm" onclick="loadMonitorLogs(monitorLogCurrentPage - 1)" id="monitorLogPrevBtn" disabled>上一页</button>
                            <span class="page-info">第 <b id="monitorLogPageInfo">1</b>/<b id="monitorLogTotalPagesInfo">1</b> 页，共 <b id="monitorLogTotalCount">0</b> 条</span>
                            <button class="btn btn-default btn-sm" onclick="loadMonitorLogs(monitorLogCurrentPage + 1)" id="monitorLogNextBtn" disabled>下一页</button>
                            <button class="btn btn-default btn-sm" onclick="loadMonitorLogs(monitorLogTotalPages)" id="monitorLogLastBtn" disabled>末页</button>
                        </div>
                    </div>
                </div>
                </div>

                <div class="content-section" id="usersSection">
                    <div class="card">
                        <div class="card-header">
                            <span class="card-title">用户列表</span>
                            <button class="btn btn-primary btn-sm" onclick="showAddUserModal()">+ 添加用户</button>
                        </div>
                        <div class="table-container">
                            <table class="table">
                                <thead><tr><th>用户名</th><th>角色</th><th>创建时间</th><th>最后登录</th><th>操作</th></tr></thead>
                                <tbody id="usersList"></tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div class="content-section" id="logsSection">
                    <div class="card">
                        <div class="card-header">
                            <span class="card-title">操作日志</span>
                            <button class="btn btn-danger btn-sm" id="clearLogsBtn" onclick="clearOperationLogs()">${icon('trash')} 清空日志</button>
                        </div>
                        <div class="table-container">
                            <table class="table">
                                <thead><tr><th>时间</th><th>操作类型</th><th>详情</th><th>操作人</th></tr></thead>
                                <tbody id="logsList"></tbody>
                            </table>
                        </div>
                        <div class="pager" id="logsPagination">
                            <button class="btn btn-default btn-sm" onclick="loadLogs(1)" id="logsFirstBtn" disabled>首页</button>
                            <button class="btn btn-default btn-sm" onclick="loadLogs(logsCurrentPage - 1)" id="logsPrevBtn" disabled>上一页</button>
                            <span class="page-info">第 <b id="logsPageInfo">1</b>/<b id="logsTotalPagesInfo">1</b> 页，共 <b id="logsTotalCount">0</b> 条</span>
                            <button class="btn btn-default btn-sm" onclick="loadLogs(logsCurrentPage + 1)" id="logsNextBtn" disabled>下一页</button>
                            <button class="btn btn-default btn-sm" onclick="loadLogs(logsTotalPages)" id="logsLastBtn" disabled>末页</button>
                        </div>
                    </div>
                </div>

                <!-- API 调用日志 -->
                <div class="content-section" id="apilogsSection">
                    <div class="card">
                        <div class="stats-grid" id="apiLogStats">
                            <div class="stat-card"><div class="stat-label">总调用数</div><div class="stat-value" id="apiLogTotal">-</div></div>
                            <div class="stat-card"><div class="stat-label">24h 调用</div><div class="stat-value" id="apiLog24h">-</div></div>
                            <div class="stat-card"><div class="stat-label">独立 IP</div><div class="stat-value" id="apiLogIPs">-</div></div>
                            <div class="stat-card"><div class="stat-label">成功数</div><div class="stat-value" id="apiLogSuccess">-</div></div>
                        </div>
                    </div>
                    <div class="card">
                        <div class="card-header">
                            <span class="card-title">${icon('link')} 来源分析（Referer）</span>
                            <div class="actions">
                                <select id="refererHours" class="filter-input" style="min-width:120px;" onchange="loadReferers()">
                                    <option value="24">近 24 小时</option>
                                    <option value="168">近 7 天</option>
                                    <option value="720">近 30 天</option>
                                </select>
                                <button class="btn btn-default btn-sm" onclick="loadReferers()">刷新</button>
                            </div>
                        </div>
                        <p class="user-info-tooltip" style="margin-bottom:12px;">
                            按请求头 Referer 归并来源站点；「直接访问」表示没有 Referer（播放器、服务端调用或隐私模式）。
                        </p>
                        <div class="table-container">
                            <table class="table table-sm">
                                <thead>
                                    <tr><th>来源站点</th><th>请求数</th><th>占比</th><th>独立 IP</th><th>主要平台</th><th>主要地区</th><th>最近访问</th></tr>
                                </thead>
                                <tbody id="refererList">
                                    <tr><td colspan="7" class="empty-state-text">加载中…</td></tr>
                                </tbody>
                            </table>
                        </div>
                        <p class="user-info-tooltip" id="refererCountries" style="margin-top:10px;"></p>
                    </div>
                    <div class="card">
                        <div class="card-header"><span class="card-title">筛选</span></div>
                        <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;">
                            <div class="form-group" style="min-width:140px;">
                                <label>开始时间</label>
                                <input type="datetime-local" id="apiLogStartTime">
                            </div>
                            <div class="form-group" style="min-width:140px;">
                                <label>结束时间</label>
                                <input type="datetime-local" id="apiLogEndTime">
                            </div>
                            <div class="form-group" style="min-width:120px;">
                                <label>IP 地址</label>
                                <input type="text" id="apiLogIP" placeholder="模糊搜索">
                            </div>
                            <div class="form-group" style="min-width:100px;">
                                <label>平台</label>
                                <select id="apiLogServer">
                                    <option value="">全部</option>
                                    <option value="netease">网易云</option>
                                    <option value="tencent">QQ音乐</option>
                                </select>
                            </div>
                            <div class="form-group" style="min-width:100px;">
                                <label>类型</label>
                                <select id="apiLogType">
                                    <option value="">全部</option>
                                    <option value="song">歌曲</option>
                                    <option value="url">URL</option>
                                    <option value="lrc">歌词</option>
                                    <option value="pic">图片</option>
                                    <option value="search">搜索</option>
                                    <option value="playlist">歌单</option>
                                </select>
                            </div>
                            <div class="form-group" style="min-width:90px;">
                                <label>状态</label>
                                <select id="apiLogStatus">
                                    <option value="">全部</option>
                                    <option value="success">成功</option>
                                    <option value="error">失败</option>
                                </select>
                            </div>
                            <div class="form-group" style="min-width:120px;">
                                <label>关键词</label>
                                <input type="text" id="apiLogKeyword" placeholder="ID / 歌曲名">
                            </div>
                            <div class="form-group" style="display:flex;gap:8px;align-items:flex-end;">
                                <button class="btn btn-primary" onclick="loadApiLogs(1)" style="margin-top:auto;">${icon('search')} 查询</button>
                                <button class="btn btn-default" onclick="resetApiLogFilters()" style="margin-top:auto;">重置</button>
                            </div>
                        </div>
                    </div>
                    <div class="card">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
                            <span style="color:var(--text-secondary);font-size:13px;">共 <b id="apiLogTotalCount">0</b> 条记录，第 <b id="apiLogCurrentPage">1</b>/<b id="apiLogTotalPages">1</b> 页</span>
                            <div style="display:flex;gap:8px;">
                                <button class="btn btn-default" onclick="exportApiLogs()">${icon('download')} 导出 CSV</button>
                                <button class="btn btn-danger" onclick="clearApiLogs()">${icon('trash')} 清空日志</button>
                            </div>
                        </div>
                        <div class="table-container">
                            <table class="table table-api-logs">
                                <colgroup>
                                    <col style="width:170px;"><col style="width:120px;"><col style="width:75px;">
                                    <col style="width:200px;"><col style="width:125px;"><col style="width:65px;">
                                    <col style="width:65px;"><col style="width:65px;"><col style="width:220px;">
                                </colgroup>
                                <thead><tr><th>时间</th><th>IP</th><th>平台</th><th>类型</th><th>请求 ID</th><th>状态码</th><th>状态</th><th>耗时</th><th>歌曲信息</th></tr></thead>
                                <tbody id="apiLogsList"></tbody>
                            </table>
                        </div>
                        <div style="display:flex;justify-content:center;align-items:center;gap:8px;margin-top:12px;" id="apiLogPagination">
                            <button class="btn btn-default" onclick="loadApiLogs(1)" id="apiLogFirstBtn" disabled>首页</button>
                            <button class="btn btn-default" onclick="loadApiLogs(apiLogCurrentPage - 1)" id="apiLogPrevBtn" disabled>上一页</button>
                            <span style="padding:0 12px;">第 <b id="apiLogPageInfo">1</b> 页</span>
                            <button class="btn btn-default" onclick="loadApiLogs(apiLogCurrentPage + 1)" id="apiLogNextBtn" disabled>下一页</button>
                            <button class="btn btn-default" onclick="loadApiLogs(apiLogTotalPages)" id="apiLogLastBtn" disabled>末页</button>
                        </div>
                    </div>
                </div>

                <div class="content-section" id="tokensSection">
                    <div class="card">
                        <div class="card-header">
                            <h4>${icon('key')} API Token 管理</h4>
                            <button class="btn btn-primary" onclick="showTokenModal()">创建 Token</button>
                        </div>
                        <p style="color:var(--text-secondary);font-size:13px;margin-bottom:16px;">API Token 用于程序化访问管理接口，使用 <code>Authorization: Bearer &lt;token&gt;</code> 请求头认证。</p>
                        <div class="table-responsive">
                            <table class="table">
                                <thead>
                                    <tr>
                                        <th>名称</th>
                                        <th>Token</th>
                                        <th>创建时间</th>
                                        <th>最后使用</th>
                                        <th>使用次数</th>
                                        <th>操作</th>
                                    </tr>
                                </thead>
                                <tbody id="tokensList"></tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div class="content-section" id="abuseSection">
                    <div class="card">
                        <div class="card-header"><span class="card-title">防护概览</span></div>
                        <div class="stats-grid" id="abuseStatsGrid">
                            <div class="stat-card blue abuse-stat">
                                <div class="stat-icon blue">${icon('eye')}</div>
                                <div class="stat-body">
                                    <div class="stat-value" id="abuseActiveRecords">0</div>
                                    <div class="stat-label">活跃监控</div>
                                </div>
                            </div>
                            <div class="stat-card red abuse-stat">
                                <div class="stat-icon red">${icon('ban')}</div>
                                <div class="stat-body">
                                    <div class="stat-value" id="abuseBannedCount">0</div>
                                    <div class="stat-label">封禁 IP</div>
                                </div>
                            </div>
                            <div class="stat-card orange abuse-stat">
                                <div class="stat-icon orange">${icon('warning')}</div>
                                <div class="stat-body">
                                    <div class="stat-value" id="abuseRecentBlocked">0</div>
                                    <div class="stat-label">最近拦截</div>
                                </div>
                            </div>
                            <div class="stat-card green abuse-stat">
                                <div class="stat-icon green">${icon('list')}</div>
                                <div class="stat-body">
                                    <div class="stat-value" id="abuseTotalLogs">0</div>
                                    <div class="stat-label">日志总数</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="card" id="topRequestersCard" style="display:none;">
                        <div class="card-header"><span class="card-title">Top 活跃 IP（本次运行期间）</span></div>
                        <div class="table-container table-scroll-y">
                            <table class="table table-sm" id="topRequestersTable">
                                <thead><tr><th>IP</th><th>请求数</th><th>API 请求</th><th>违规次数</th></tr></thead>
                                <tbody id="topRequestersBody"></tbody>
                            </table>
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-header"><span class="card-title">防护配置</span></div>
                        <form id="abuseConfigForm" style="max-width: 640px;">
                            <div class="form-group">
                                <label class="checkbox-label"><input type="checkbox" id="abuseEnabled"> 启用滥用防护</label>
                                <small>关闭后不再进行频控与自动封禁，手动封禁与白名单仍然生效</small>
                            </div>

                            <div class="form-section-title">${icon('dashboard')} 速率限制</div>
                            <div class="form-row">
                                <div class="form-group" style="flex:1">
                                    <label>时间窗口（秒）</label>
                                    <input type="number" id="abuseWindowMs" min="10" max="3600" value="60">
                                    <small>在该时间范围内统计请求频率</small>
                                </div>
                                <div class="form-group" style="flex:1">
                                    <label>窗口内最大请求数</label>
                                    <input type="number" id="abuseMaxRequests" min="10" max="10000" value="120">
                                    <small>超出记为速率违规</small>
                                </div>
                            </div>
                            <div class="form-row">
                                <div class="form-group" style="flex:1">
                                    <label>API 最大请求数</label>
                                    <input type="number" id="abuseMaxApiRequests" min="5" max="5000" value="60">
                                    <small>仅统计 /api 开头的路径</small>
                                </div>
                                <div class="form-group" style="flex:1"></div>
                            </div>

                            <div class="form-section-title">${icon('ban')} 封禁策略</div>
                            <div class="form-row">
                                <div class="form-group" style="flex:1">
                                    <label>封禁阈值（违规次数）</label>
                                    <input type="number" id="abuseThreshold" min="1" max="100" value="3">
                                    <small>高危违规达到阈值即封禁</small>
                                </div>
                                <div class="form-group" style="flex:1">
                                    <label>封禁时长（分钟）</label>
                                    <input type="number" id="abuseDuration" min="1" max="1440" value="60">
                                    <small>首次触发封禁的持续时间</small>
                                </div>
                            </div>
                            <div class="form-group">
                                <label class="checkbox-label"><input type="checkbox" id="abuseExtendOnHit" checked onchange="syncAbuseExtendUI()"> 封禁期内命中自动续期</label>
                                <div class="form-inline-row" id="abuseExtendRow" style="margin-top:8px;">
                                    <span class="form-inline-text">每次命中延长</span>
                                    <input type="number" id="abuseExtendMs" min="1" max="1440" value="10">
                                    <span class="form-inline-text">分钟，攻击停止后到期自动解封</span>
                                </div>
                            </div>

                            <div class="form-section-title">${icon('eye')} 检测规则</div>
                            <div class="form-group">
                                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;">
                                    <label class="checkbox-label"><input type="checkbox" id="abuseRuleRapid" checked> 速率检测</label>
                                    <label class="checkbox-label"><input type="checkbox" id="abuseRuleInvalid" checked> 可疑参数</label>
                                    <label class="checkbox-label"><input type="checkbox" id="abuseRulePath" checked> 路径枚举</label>
                                    <label class="checkbox-label"><input type="checkbox" id="abuseRulePattern" checked> 模式检测</label>
                                </div>
                            </div>

                            <div class="form-section-title">${icon('shield')} 白名单</div>
                            <div class="form-group">
                                <label>白名单 IP（逗号分隔）</label>
                                <input type="text" id="abuseWhitelistIps" placeholder="1.2.3.4, 240e:xxxx::1" style="font-family:monospace;">
                                <small>白名单 IP 完全跳过频控与封禁，可用于固定出口 IP 的管理设备</small>
                            </div>
                            <button type="submit" class="btn btn-primary">保存配置</button>
                        </form>
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <span class="card-title">IP 封禁管理</span>
                        </div>
                        <form id="abuseBanForm" style="max-width: 600px;">
                            <div class="form-row">
                                <div class="form-group" style="flex:1">
                                    <label>IP 地址</label>
                                    <input type="text" id="banIPInput" placeholder="192.168.1.1" style="font-family:monospace;">
                                </div>
                                <div class="form-group" style="width:120px;flex:none;">
                                    <label>封禁时长（分钟）</label>
                                    <input type="number" id="banDurationInput" placeholder="60" min="1" max="525600">
                                </div>
                            </div>
                            <div class="form-group">
                                <label class="checkbox-label" style="margin-bottom:12px;">
                                    <input type="checkbox" id="banPermanentCheck" onchange="document.getElementById('banDurationInput').disabled=this.checked;"> 永久封禁（勾选后忽略时长，永不过期）
                                </label>
                            </div>
                            <div class="form-group">
                                <label>封禁原因（可选）</label>
                                <input type="text" id="banReasonInput" placeholder="简要说明封禁原因">
                            </div>
                            <button type="submit" class="btn btn-danger">${icon('ban')} 封禁此 IP</button>
                        </form>
                        <div class="table-container">
                            <table class="table">
                                <thead><tr><th>IP</th><th>原因</th><th>封禁时间</th><th>到期</th><th>操作</th></tr></thead>
                                <tbody id="abuseBansBody"></tbody>
                            </table>
                        </div>
                    </div>

                    <div class="card">
                        <div class="card-header"><span class="card-title">筛选</span></div>
                        <div class="abuse-filters-row">
                            <div class="form-group" style="min-width:150px;">
                                <label>开始时间</label>
                                <input type="datetime-local" id="abuseLogStartTime">
                            </div>
                            <div class="form-group" style="min-width:150px;">
                                <label>结束时间</label>
                                <input type="datetime-local" id="abuseLogEndTime">
                            </div>
                            <div class="form-group" style="min-width:130px;">
                                <label>IP 地址</label>
                                <input type="text" id="abuseLogIP" placeholder="精确匹配">
                            </div>
                            <div class="form-group" style="min-width:100px;">
                                <label>级别</label>
                                <select id="abuseLogLevel">
                                    <option value="">全部</option>
                                    <option value="low">低</option>
                                    <option value="medium">中</option>
                                    <option value="high">高</option>
                                    <option value="ban">封禁</option>
                                </select>
                            </div>
                            <div class="form-group" style="min-width:100px;">
                                <label>状态</label>
                                <select id="abuseLogBlocked">
                                    <option value="">全部</option>
                                    <option value="true">已拦截</option>
                                    <option value="false">已记录</option>
                                </select>
                            </div>
                            <div class="form-group" style="min-width:130px;">
                                <label>关键词</label>
                                <input type="text" id="abuseLogKeyword" placeholder="路径/原因搜索">
                            </div>
                            <div class="form-group" style="display:flex;gap:6px;align-items:flex-end;">
                                <button class="btn btn-primary" onclick="loadAbuseLogs(1)" style="margin-top:auto;">查询</button>
                                <button class="btn btn-default" onclick="resetAbuseFilters()" style="margin-top:auto;">重置</button>
                            </div>
                        </div>
                    </div>

                    <div class="card">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px;">
                            <span style="color:var(--text-secondary);font-size:13px;">共 <b id="abuseLogTotalCount">0</b> 条记录，第 <b id="abuseLogCurrentPage">1</b>/<b id="abuseLogTotalPages">1</b> 页</span>
                            <div style="display:flex;gap:8px;">
                                <button class="btn btn-default" onclick="exportAbuseLogs()">${icon('download')} 导出 CSV</button>
                                <button class="btn btn-danger" onclick="clearAbuseLogs()">${icon('trash')} 清空日志</button>
                            </div>
                        </div>
                        <div class="table-container">
                            <table class="table">
                                <thead><tr><th>时间</th><th>IP</th><th>方法</th><th>级别</th><th>路径</th><th>原因</th><th>状态</th><th>操作</th></tr></thead>
                                <tbody id="abuseLogsBody"></tbody>
                            </table>
                        </div>
                        <div style="display:flex;justify-content:center;align-items:center;gap:8px;margin-top:12px;" id="abuseLogPagination">
                            <button class="btn btn-default" onclick="loadAbuseLogs(1)" id="abuseLogFirstBtn" disabled>首页</button>
                            <button class="btn btn-default" onclick="loadAbuseLogs(abuseLogCurrentPage - 1)" id="abuseLogPrevBtn" disabled>上一页</button>
                            <span style="padding:0 12px;">第 <b id="abuseLogPageInfo">1</b> 页</span>
                            <button class="btn btn-default" onclick="loadAbuseLogs(abuseLogCurrentPage + 1)" id="abuseLogNextBtn" disabled>下一页</button>
                            <button class="btn btn-default" onclick="loadAbuseLogs(abuseLogTotalPages)" id="abuseLogLastBtn" disabled>末页</button>
                        </div>
                    </div>
                </div>
                <div class="content-section" id="settingsSection">
                    <div class="settings-tabs" role="tablist" aria-label="设置分类">
                        <button type="button" class="settings-tab active" role="tab" id="settingsTabAccount" aria-selected="true" aria-controls="settingsPanelAccount" data-settings-tab="Account">账户</button>
                        <button type="button" class="settings-tab" role="tab" id="settingsTabSecurity" aria-selected="false" aria-controls="settingsPanelSecurity" data-settings-tab="Security">安全</button>
                        <button type="button" class="settings-tab" role="tab" id="settingsTabIntegrations" aria-selected="false" aria-controls="settingsPanelIntegrations" data-settings-tab="Integrations">集成与外观</button>
                        <button type="button" class="settings-tab" role="tab" id="settingsTabCache" aria-selected="false" aria-controls="settingsPanelCache" data-settings-tab="Cache">缓存</button>
                    </div>
                    <div class="settings-panel active" id="settingsPanelAccount" role="tabpanel" aria-labelledby="settingsTabAccount" data-settings-panel="Account">
                    <div class="settings-grid">
                        <div class="card settings-section">
                            <h4>${icon('user')} 个人设置</h4>
                            <form id="profileForm">
                                <div class="form-group">
                                    <label>当前用户名</label>
                                    <input type="text" id="currentUsernameDisplay" disabled>
                                </div>
                                <div class="form-group">
                                    <label>新用户名</label>
                                    <input type="text" id="newUsername" placeholder="留空则不修改">
                                </div>
                                <button type="submit" class="btn btn-primary">修改用户名</button>
                            </form>
                        </div>

                        <div class="card settings-section">
                            <h4>${icon('lockKey')} 修改密码</h4>
                            <form id="changePasswordForm">
                                <div class="form-group">
                                    <label>旧密码</label>
                                    <input type="password" id="oldPassword" required>
                                </div>
                                <div class="form-group">
                                    <label>新密码</label>
                                    <input type="password" id="newPassword" required>
                                </div>
                                <div class="form-group">
                                    <label>确认新密码</label>
                                    <input type="password" id="confirmPassword" required>
                                </div>
                                <button type="submit" class="btn btn-primary">修改密码</button>
                            </form>
                        </div>
                    </div>
                    </div>

                    <div class="settings-panel" id="settingsPanelSecurity" role="tabpanel" aria-labelledby="settingsTabSecurity" data-settings-panel="Security">
                    <div class="settings-grid">
                        <div class="card settings-section" id="adminPathSection">
                            <h4>${icon('shield')} 安全设置</h4>
                            <form id="adminPathForm">
                                <div class="form-group">
                                    <label>管理后台路径</label>
                                    <input type="text" id="adminPathInput" placeholder="例如: secret-admin">
                                    <small>修改后需要重启服务才能生效</small>
                                </div>
                                <button type="submit" class="btn btn-primary">保存路径</button>
                            </form>
                        </div>

                        <div class="card settings-section" id="twoFactorSection">
                            <h4>${icon('lock')} 双因素认证</h4>
                            <div id="twoFactorDisabled">
                                <p style="color:var(--text-secondary);font-size:13px;margin-bottom:16px;">双因素认证可为您的账户提供额外安全保障，启用后登录时需要输入验证码。</p>
                                <button type="button" class="btn btn-primary" onclick="startSetup2FA()">启用双因素认证</button>
                            </div>
                            <div id="twoFactorEnabled" style="display:none;">
                                <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
                                    <span class="status-dot status-active"></span>
                                    <span style="color:var(--success);font-weight:600;font-size:14px;">已启用</span>
                                </div>
                                <button type="button" class="btn btn-danger" onclick="showDisable2FAModal()">禁用双因素认证</button>
                            </div>
                        </div>
                    </div>
                    </div>

                    <div class="settings-panel" id="settingsPanelIntegrations" role="tabpanel" aria-labelledby="settingsTabIntegrations" data-settings-panel="Integrations">
                    <div class="settings-grid">
                        <div class="card settings-section" id="geoSection">
                            <h4>${icon('radio')} IP 归属地接口</h4>
                            <form id="geoForm">
                                <div class="form-group">
                                    <label class="checkbox-label"><input type="checkbox" id="geoEnabled" checked> 启用 ShowAPI 在线查询</label>
                                    <small>关闭后仅使用离线国家库；在线查询只补省/市，不阻塞 /api 响应。</small>
                                </div>
                                <div class="form-group">
                                    <label>ShowAPI appKey</label>
                                    <input type="password" id="geoApiKey" placeholder="填写 ShowAPI 控制台的 appKey" autocomplete="new-password">
                                    <small id="geoKeyHint">未配置密钥。重复 IP 只查询一次并缓存在本地。</small>
                                    <small style="display:block;margin-top:6px;">获取地址：<a href="https://www.showapi.com/console#/myApp" target="_blank" rel="noopener">ShowAPI 控制台 → 我的应用</a>；需为应用开通「全球IP地址查询」。</small>
                                </div>
                                <div class="form-group">
                                    <label>测试 IP</label>
                                    <div class="input-with-button">
                                        <input type="text" id="geoTestIp" placeholder="留空则使用当前访问 IP">
                                        <button type="button" class="btn btn-default btn-sm" onclick="fillMyIp()">获取我的 IP</button>
                                    </div>
                                    <small>默认使用当前访问后台的公网 IP（优先 X-Forwarded-For），也可以手动填写；支持 IPv4 / IPv6，IPv6 走 ipwho.is 备用接口。</small>
                                </div>
                                <div class="geo-result" id="geoTestResult" style="display:none;"></div>
                                <p class="user-info-tooltip" id="geoTestStatus" style="margin:6px 0 0;"></p>
                                <div class="form-row" style="margin-top:12px;">
                                    <button type="submit" class="btn btn-primary">保存</button>
                                    <button type="button" class="btn btn-default" onclick="testGeoApi()">测试查询</button>
                                    <button type="button" class="btn btn-default" onclick="clearGeoCacheConfirm()">清空缓存</button>
                                </div>
                                <p class="user-info-tooltip" id="geoCacheInfo" style="margin-top:10px;">本地缓存 0 个 IP</p>
                            </form>
                        </div>

                        <div class="card settings-section" id="loginBgSection">
                            <h4>${icon('image')} 登录页背景</h4>
                            <form id="loginBgForm">
                                <div class="form-group">
                                    <label class="checkbox-label"><input type="checkbox" id="loginBgEnabled" checked> 启用 ACG 随机背景图</label>
                                    <small>由 uapis.cn 随机图接口提供。服务端抓取后缓存，刷新登录页始终是同一张。</small>
                                </div>
                                <div class="form-group">
                                    <label>图片接口地址</label>
                                    <input type="url" id="loginBgApiUrl" required placeholder="https://uapis.cn/api/v1/random/image?category=acg">
                                    <small>默认 <code>category=acg</code>；换分类只需修改这里的 query 参数。</small>
                                </div>
                                <div class="form-group">
                                    <label>缓存有效期（小时）</label>
                                    <input type="number" id="loginBgTtlHours" min="1" max="168" step="1" value="6" required>
                                    <small>到期后自动换一张；期间所有访问共用同一张，建议 6~24 小时。</small>
                                </div>
                                <div class="login-bg-preview is-empty" id="loginBgPreviewWrap">
                                    <img id="loginBgPreview" alt="登录页背景预览"${loginBgPreviewSrc} onload="this.parentElement.classList.remove('is-empty')" onerror="this.parentElement.classList.add('is-empty')">
                                </div>
                                <p class="user-info-tooltip" id="loginBgCacheInfo" style="margin-bottom:12px;">正在读取缓存状态…</p>
                                <div class="form-row">
                                    <button type="submit" class="btn btn-primary">保存</button>
                                    <button type="button" class="btn btn-default" id="loginBgRefreshBtn" onclick="refreshLoginBg()">立即换一张</button>
                                    <button type="button" class="btn btn-default" onclick="clearLoginBgCacheConfirm()">清除缓存</button>
                                </div>
                            </form>
                        </div>
                    </div>
                    </div>

                    <div class="settings-panel" id="settingsPanelCache" role="tabpanel" aria-labelledby="settingsTabCache" data-settings-panel="Cache">
                    <div class="settings-grid">
                        <div class="card settings-section" id="cacheSection">
                            <h4>${icon('dashboard')} /api 响应缓存</h4>
                            <form id="cacheForm">
                                <div class="form-group">
                                    <label class="checkbox-label"><input type="checkbox" id="cacheEnabled" checked> 启用响应缓存</label>
                                    <small>只缓存成功结果；关闭后所有请求直接回源。</small>
                                </div>
                                <div class="form-group">
                                    <label>分类型 TTL（分钟）</label>
                                    <div class="cache-ttl-grid" id="cacheTtlGrid"></div>
                                    <small>TTL 应大于同一 id 的重复拉取间隔；直链建议 10 分钟，歌单/歌词建议 30~60 分钟。</small>
                                </div>
                                <div class="form-group">
                                    <label>最大缓存条目</label>
                                    <input type="number" id="cacheMaxEntries" min="50" max="100000" step="50" value="500" required>
                                    <small>超出后按插入顺序淘汰最旧条目。</small>
                                </div>
                                <p class="user-info-tooltip" id="cacheEnvNote" style="margin-bottom:12px;"></p>
                                <div class="form-row">
                                    <button type="submit" class="btn btn-primary">保存缓存配置</button>
                                    <button type="button" class="btn btn-default" onclick="clearApiCacheConfirm()">清空缓存</button>
                                </div>
                            </form>
                        </div>

                        <div class="card settings-section">
                            <h4>${icon('radio')} 运行统计</h4>
                            <div class="cache-stat-grid">
                                <div class="cache-stat"><span>缓存条目</span><b id="cacheStatSize">-</b></div>
                                <div class="cache-stat"><span>命中率</span><b id="cacheStatHitRate">-</b></div>
                                <div class="cache-stat"><span>命中 / 未命中</span><b id="cacheStatHits">-</b></div>
                                <div class="cache-stat"><span>写入 / 淘汰</span><b id="cacheStatSets">-</b></div>
                                <div class="cache-stat"><span>跳过（超大）</span><b id="cacheStatSkipped">-</b></div>
                                <div class="cache-stat"><span>状态</span><b id="cacheStatEnabled">-</b></div>
                            </div>
                            <p class="user-info-tooltip" id="cacheStatsInfo" style="margin:8px 0 12px;">最近读取的缓存统计</p>
                            <button type="button" class="btn btn-default" onclick="loadCacheConfig()">刷新统计</button>
                        </div>
                    </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <div class="modal" id="cookieModal">
        <div class="modal-content">
            <div class="modal-header">
                <h3 id="cookieModalTitle">添加 Cookie</h3>
                <button class="modal-close" onclick="closeModal('cookieModal')">&times;</button>
            </div>
            <div class="modal-body">
                <form id="cookieForm">
                    <input type="hidden" id="cookieId">
                    <div class="form-group">
                        <label>平台</label>
                        <select id="cookiePlatform" required>
                            <option value="netease">网易云音乐</option>
                            <option value="tencent">QQ音乐</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Cookie 数据</label>
                        <textarea id="cookieData" rows="4" required placeholder="请粘贴 Cookie 数据"></textarea>
                    </div>
                    <div class="form-group">
                        <label>备注</label>
                        <input type="text" id="cookieNote" placeholder="可选备注信息">
                    </div>
                    <div class="form-group">
                        <label class="checkbox-label"><input type="checkbox" id="skipValidation"> 跳过在线验证（不推荐）</label>
                    </div>
                    <div class="form-group">
                        <label class="checkbox-label"><input type="checkbox" id="cookieActive" checked> 启用此Cookie</label>
                    </div>
                </form>
                <span class="help-link" onclick="toggleCookieHelp()">${icon('help')} 如何获取 Cookie？</span>
                <div class="help-content" id="cookieHelpContent">
                    ${neteaseQrLoginEnabled ? '<p style="margin-bottom:12px;color:var(--text-secondary);font-size:12px;">网易云音乐可以直接用列表上方的「网易云扫码登录」，下面的手动步骤只在扫码不可用时使用。</p>' : ''}
                    <div class="help-section">
                        <h4>网易云音乐 Cookie 获取方法：</h4>
                        <ol>
                            <li>登录 <a href="https://music.163.com" target="_blank">music.163.com</a></li>
                            <li>按 F12 打开开发者工具</li>
                            <li>切换到 Network（网络）标签</li>
                            <li>刷新页面，点击任意请求</li>
                            <li>在 Headers（请求头）中找到 Cookie</li>
                            <li>复制完整 Cookie 值（需包含 <code>MUSIC_U</code>）</li>
                        </ol>
                    </div>
                    <div class="help-section">
                        <h4>QQ音乐 Cookie 获取方法：</h4>
                        <ol>
                            <li>登录 <a href="https://y.qq.com" target="_blank">y.qq.com</a></li>
                            <li>按 F12 打开开发者工具</li>
                            <li>切换到 Application（应用）标签</li>
                            <li>在左侧 Cookies 下找到 y.qq.com</li>
                            <li>复制 <code>uin</code> 和 <code>qqmusic_key</code> 的值</li>
                            <li>格式：<code>uin=你的uin; qqmusic_key=你的key</code></li>
                        </ol>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-default" onclick="closeModal('cookieModal')">取消</button>
                <button type="submit" class="btn btn-primary" id="cookieSubmitBtn" onclick="document.getElementById('cookieForm').dispatchEvent(new Event('submit',{cancelable:true}))">保存并验证</button>
            </div>
        </div>
    </div>

    ${neteaseQrLoginEnabled ? `
    <div class="modal" id="qrLoginModal">
        <div class="modal-content" style="max-width:420px;">
            <div class="modal-header">
                <h3>${icon('qr')} 网易云扫码登录</h3>
                <button class="modal-close" onclick="closeQrLogin()">&times;</button>
            </div>
            <div class="modal-body">
                <div style="text-align:center;">
                    <div style="display:inline-block;padding:12px;background:#fff;border:1px solid var(--border);border-radius:var(--radius);min-width:264px;min-height:264px;">
                        <div id="qrLoginPlaceholder" style="display:flex;align-items:center;justify-content:center;height:240px;color:var(--text-secondary);font-size:13px;">正在生成二维码…</div>
                        <img id="qrLoginImage" alt="网易云音乐登录二维码" style="display:none;width:240px;height:240px;">
                    </div>
                    <p id="qrLoginStatus" style="margin-top:14px;font-size:13px;color:var(--text-secondary);">正在生成二维码…</p>
                    <div id="qrLoginDebug" style="margin-top:4px;font-size:11px;color:var(--text-secondary);opacity:.7;"></div>
                    <p style="margin-top:6px;font-size:12px;line-height:1.7;color:var(--text-secondary);">
                        用网易云音乐 App 扫码，并在手机上点「确认登录」。<br>
                        确认后会自动保存并验证，无需再复制 Cookie。
                    </p>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-default" onclick="closeQrLogin()">取消</button>
                <button type="button" class="btn btn-primary" id="qrLoginRefreshBtn" onclick="refreshQrLogin()">刷新二维码</button>
            </div>
        </div>
    </div>
    ` : ''}

    <div class="modal" id="userModal">
        <div class="modal-content">
            <div class="modal-header">
                <h3 id="userModalTitle">添加用户</h3>
                <button class="modal-close" onclick="closeModal('userModal')">&times;</button>
            </div>
            <div class="modal-body">
                <form id="userForm">
                    <input type="hidden" id="editUsername">
                    <div class="form-group">
                        <label>用户名</label>
                        <input type="text" id="userUsername" required>
                    </div>
                    <div class="form-group" id="passwordGroup">
                        <label>密码</label>
                        <input type="password" id="userPassword">
                    </div>
                    <div class="form-group">
                        <label>角色</label>
                        <select id="userRole">
                            <option value="user">普通用户</option>
                            <option value="admin">管理员</option>
                        </select>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-default" onclick="closeModal('userModal')">取消</button>
                <button type="submit" class="btn btn-primary" id="userSubmitBtn" onclick="document.getElementById('userForm').dispatchEvent(new Event('submit',{cancelable:true}))">保存</button>
            </div>
        </div>
    </div>

    <div class="modal" id="twoFactorSetupModal">
        <div class="modal-content">
            <div class="modal-header">
                <h3>${icon('lock')} 设置双因素认证</h3>
                <button class="modal-close" onclick="closeModal('twoFactorSetupModal')">&times;</button>
            </div>
            <div class="modal-body">
                <div id="twoFactorStep1">
                    <h4 style="margin-bottom:12px;font-size:15px;">第 1 步：扫描二维码</h4>
                    <p style="color:var(--text-secondary);font-size:13px;margin-bottom:16px;">使用 Google Authenticator、Authy 或其他 TOTP 认证应用扫描下方二维码。</p>
                    <div style="text-align:center;margin-bottom:16px;">
                        <div id="qrcodeContainer" style="display:inline-block;padding:12px;background:#fff;border:1px solid var(--border);border-radius:var(--radius);"></div>
                    </div>
                    <div class="form-group">
                        <label>手动输入密钥</label>
                        <div style="display:flex;gap:8px;">
                            <input type="text" id="twoFactorSecretDisplay" readonly style="font-family:monospace;font-size:13px;letter-spacing:1px;">
                            <button type="button" class="btn btn-default btn-sm" onclick="copy2FASecret()">复制</button>
                        </div>
                    </div>
                </div>
                <div id="twoFactorStep2" style="display:none;">
                    <h4 style="margin-bottom:12px;font-size:15px;">第 2 步：输入验证码</h4>
                    <p style="color:var(--text-secondary);font-size:13px;margin-bottom:16px;">输入认证器应用中显示的 6 位验证码以完成设置。</p>
                    <form id="twoFactorSetupForm">
                        <div class="form-group">
                            <label>验证码</label>
                            <input type="text" id="twoFactorSetupCode" required placeholder="6位数字验证码" maxlength="6" pattern="[0-9]{6}" inputmode="numeric" style="text-align:center;font-size:24px;letter-spacing:8px;font-weight:700;">
                        </div>
                        <div class="error-msg" id="twoFactorSetupError"></div>
                    </form>
                </div>
                <div id="twoFactorStep3" style="display:none;">
                    <h4 style="margin-bottom:12px;font-size:15px;color:var(--success);">${icon('check')} 双因素认证已启用</h4>
                    <p style="color:var(--text-secondary);font-size:13px;">您的账户现在受到额外保护，每次登录时都需要输入验证码。</p>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-default" id="twoFactorSetupBack" onclick="twoFactorSetupGoBack()" style="display:none;">上一步</button>
                <button type="button" class="btn btn-primary" id="twoFactorSetupNext" onclick="twoFactorSetupGoNext()">下一步</button>
                <button type="button" class="btn btn-default" id="twoFactorSetupFinish" onclick="closeModal('twoFactorSetupModal')" style="display:none;">完成</button>
            </div>
        </div>
    </div>

    <div class="modal" id="twoFactorDisableModal">
        <div class="modal-content">
            <div class="modal-header">
                <h3>禁用双因素认证</h3>
                <button class="modal-close" onclick="closeModal('twoFactorDisableModal')">&times;</button>
            </div>
            <div class="modal-body">
                <p style="color:var(--text-secondary);font-size:13px;margin-bottom:16px;">禁用双因素认证会降低账户安全性，请输入密码确认操作。</p>
                <form id="twoFactorDisableForm">
                    <div class="form-group">
                        <label>当前密码</label>
                        <input type="password" id="disable2FAPassword" required placeholder="请输入当前密码">
                    </div>
                    <div class="error-msg" id="disable2FAError"></div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-default" onclick="closeModal('twoFactorDisableModal')">取消</button>
                <button type="submit" class="btn btn-danger" onclick="document.getElementById('twoFactorDisableForm').dispatchEvent(new Event('submit',{cancelable:true}))">确认禁用</button>
            </div>
        </div>
    </div>

    <div class="modal" id="tokenModal">
        <div class="modal-content">
            <div class="modal-header">
                <h3 id="tokenModalTitle">创建 API Token</h3>
                <button class="modal-close" onclick="closeModal('tokenModal')">&times;</button>
            </div>
            <div class="modal-body">
                <form id="tokenForm">
                    <div class="form-group">
                        <label>Token 名称</label>
                        <input type="text" id="tokenName" required placeholder="例如: 自动化脚本">
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-default" onclick="closeModal('tokenModal')">取消</button>
                <button type="submit" class="btn btn-primary" onclick="createToken()">创建</button>
            </div>
        </div>
    </div>

    <div class="modal" id="tokenShowModal">
        <div class="modal-content">
            <div class="modal-header">
                <h3>${icon('success')} Token 已创建</h3>
                <button class="modal-close" onclick="closeModal('tokenShowModal')">&times;</button>
            </div>
            <div class="modal-body">
                <p style="color:var(--text-secondary);font-size:13px;margin-bottom:16px;">请立即复制并妥善保存此 Token，关闭后将无法再次查看完整内容。</p>
                <div class="form-group">
                    <label>Token</label>
                    <div style="display:flex;gap:8px;">
                        <input type="text" id="createdToken" readonly style="font-family:monospace;font-size:12px;">
                        <button type="button" class="btn btn-primary" onclick="copyCreatedToken()">复制</button>
                    </div>
                </div>
                <div class="form-group">
                    <label>使用示例</label>
                    <pre style="background:var(--bg);padding:12px;border-radius:var(--radius-sm);font-size:11px;overflow-x:auto;">curl -H "Authorization: Bearer &lt;token&gt;" http://your-api/admin/cookies</pre>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-primary" onclick="closeModal('tokenShowModal')">我已保存</button>
            </div>
        </div>
    </div>

    <script>
        let authToken = localStorage.getItem('authToken');
        let authUsername = localStorage.getItem('authUsername');
        const QR_LOGIN_ENABLED = ${neteaseQrLoginEnabled};

        const api = async (url, options = {}) => {
            const headers = {
                'Content-Type': 'application/json',
                ...options.headers
            };
            if (authToken) {
                headers['X-Auth-Username'] = authUsername;
                headers['X-Auth-Token'] = authToken;
            }
            const res = await fetch(url, { ...options, headers });
            const data = await res.json();
            if (res.status === 401 && !url.includes('/admin/login')) {
                localStorage.removeItem('authToken');
                localStorage.removeItem('authUsername');
                showLogin();
            }
            return data;
        };

        const escapeHtml = (str) => {
            if (str === null || str === undefined) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        };

        const showToast = (message, type = 'success') => {
            const toast = document.createElement('div');
            toast.className = 'toast toast-' + type;
            toast.innerHTML = (type === 'success' ? '${icon('check')} ' : '${icon('xmark')} ') + message;
            document.body.appendChild(toast);
            setTimeout(() => {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(20px)';
                toast.style.transition = '0.3s ease';
            }, 2500);
            setTimeout(() => toast.remove(), 3000);
        };

        const formatDate = (timestamp) => {
            if (!timestamp) return '-';
            return new Date(timestamp).toLocaleString('zh-CN');
        };

        const getPlatformName = (platform) => {
            return platform === 'netease' ? '网易云音乐' : 'QQ音乐';
        };

        const getValidationBadge = (cookie) => {
            if (cookie.isValid === null || cookie.isValid === undefined) {
                return '<span class="badge badge-warning">未验证</span>';
            } else if (cookie.isValid) {
                let vipText = cookie.userInfo?.isVip ? ' VIP' : '';
                return '<span class="badge badge-success">有效' + vipText + '</span>';
            } else {
                return '<span class="badge badge-error">无效</span>';
            }
        };

        const toggleCookieHelp = () => {
            const el = document.getElementById('cookieHelpContent');
            el.classList.toggle('show');
        };

        const showLogin = () => {
            document.body.classList.remove('auth-pending');
            document.getElementById('loginContainer').style.display = 'flex';
            document.getElementById('adminContainer').style.display = 'none';
            document.getElementById('loginBox').style.display = 'block';
            document.getElementById('twoFactorBox').style.display = 'none';
        };

        const showAdmin = () => {
            document.body.classList.remove('auth-pending');
            document.getElementById('loginContainer').style.display = 'none';
            document.getElementById('adminContainer').style.display = 'block';
            document.getElementById('currentUser').textContent = authUsername;
            document.getElementById('currentUsernameDisplay').value = authUsername;
            loadDashboard();
            loadConfig();
            load2FAStatus();
        };

        let currentUserRole = 'user';

        const loadConfig = async () => {
            const checkRes = await api('/admin/check');
            if (checkRes?.success) {
                currentUserRole = checkRes.data.role;
                if (currentUserRole !== 'admin') {
                    document.getElementById('adminPathSection').style.display = 'none';
                    document.getElementById('loginBgSection').style.display = 'none';
                    document.getElementById('clearLogsBtn').style.display = 'none';
                    return;
                }
                document.getElementById('clearLogsBtn').style.display = '';
            }
            const res = await api('/admin/config');
            if (res?.success && res.data?.adminPath) {
                document.getElementById('adminPathInput').value = res.data.adminPath;
            }
            await loadGeoConfig();
        };

        const loadGeoConfig = async () => {
            try {
                const res = await api('/admin/geo');
                if (!res?.success) return;
                const d = res.data || {};
                const enabled = document.getElementById('geoEnabled');
                if (enabled) enabled.checked = d.enabled !== false;
                const keyInput = document.getElementById('geoApiKey');
                if (keyInput) {
                    keyInput.value = '';
                    keyInput.placeholder = d.hasKey
                        ? '已配置 ' + d.keyPreview + '，留空保持不变'
                        : '填写 ShowAPI 控制台的 appKey';
                }
                const hint = document.getElementById('geoKeyHint');
                if (hint) {
                    hint.textContent = d.hasKey
                        ? '密钥已配置；重复 IP 只查询一次并缓存在本地。'
                        : '未配置密钥；IPv4 仅使用离线国家库，IPv6 走 ipwho.is 备用接口。';
                }
                const cache = document.getElementById('geoCacheInfo');
                if (cache) cache.textContent = '本地缓存 ' + (d.cacheSize || 0) + ' 个 IP，有效期 ' + (d.cacheTtlDays || 30) + ' 天';
                const ipInput = document.getElementById('geoTestIp');
                if (ipInput && !ipInput.value.trim()) fillMyIp(true);
            } catch (_) {}
        };

        const formatLoginBgSize = (bytes) => {
            if (!bytes) return '-';
            if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
            return Math.max(1, Math.round(bytes / 1024)) + ' KB';
        };

        const renderLoginBgPreview = (d) => {
            const wrap = document.getElementById('loginBgPreviewWrap');
            const img = document.getElementById('loginBgPreview');
            const info = document.getElementById('loginBgCacheInfo');
            if (!wrap || !img || !info) return;
            const enabled = d?.enabled !== false;
            wrap.style.display = enabled ? '' : 'none';
            if (!enabled) {
                info.textContent = '背景图已关闭，登录页使用默认渐变背景。';
                return;
            }
            const cache = d?.cache;
            if (cache && cache.fetchedAt) {
                const at = new Date(cache.fetchedAt).toLocaleString('zh-CN');
                const suffix = cache.stale ? '，已过期（下次访问自动更换）' : '，刷新登录页不会换图';
                info.textContent = '已缓存 1 张（' + formatLoginBgSize(cache.size) + '），抓取于 ' + at + suffix;
                wrap.classList.remove('is-empty');
                img.src = '/admin/login-bg?v=' + cache.fetchedAt;
            } else {
                info.textContent = '正在获取背景图…（若长时间空白，点「立即换一张」）';
                wrap.classList.add('is-empty');
                if (!img.getAttribute('src')) img.src = '/admin/login-bg';
            }
        };

        const loadLoginBgConfig = async () => {
            try {
                const res = await api('/admin/login-bg/settings');
                if (!res?.success) return;
                const d = res.data || {};
                const enabled = document.getElementById('loginBgEnabled');
                if (enabled) enabled.checked = d.enabled !== false;
                const urlInput = document.getElementById('loginBgApiUrl');
                if (urlInput) urlInput.value = d.apiUrl || '';
                const ttlInput = document.getElementById('loginBgTtlHours');
                if (ttlInput) ttlInput.value = d.ttlHours || 6;
                renderLoginBgPreview(d);
            } catch (_) {}
        };

        const renderCacheStats = (d) => {
            const stats = d?.stats || {};
            const setText = (id, value) => {
                const el = document.getElementById(id);
                if (el) el.textContent = value;
            };
            const total = (stats.hits || 0) + (stats.misses || 0);
            setText('cacheStatSize', String(stats.size || 0) + ' / ' + String(d?.maxEntries || stats.maxEntries || '-'));
            setText('cacheStatHitRate', total ? ((stats.hitRate || 0) * 100).toFixed(1) + '%' : '暂无请求');
            setText('cacheStatHits', String(stats.hits || 0) + ' / ' + String(stats.misses || 0));
            setText('cacheStatSets', String(stats.sets || 0) + ' / ' + String(stats.evictions || 0));
            setText('cacheStatSkipped', String(stats.skipped || 0));
            setText('cacheStatEnabled', d?.envLocked ? '被环境变量关闭' : (d?.enabled ? '运行中' : '已关闭'));

            const maxValueMb = stats.maxValueBytes ? (stats.maxValueBytes / 1048576).toFixed(1) + ' MB' : '-';
            const info = document.getElementById('cacheStatsInfo');
            if (info) {
                info.textContent = '单条上限 ' + maxValueMb + '；TTL 修改保存后旧缓存会自动清空。';
            }
            const envNote = document.getElementById('cacheEnvNote');
            if (envNote) {
                if (d?.envLocked) {
                    envNote.textContent = '环境变量 CACHE_ENABLED=0 已强制关闭缓存，后台开关不会生效。';
                } else if (d?.envGlobalTtlSeconds) {
                    envNote.textContent = '环境变量 CACHE_TTL_SECONDS=' + d.envGlobalTtlSeconds + ' 当前作为默认值；保存后以本页分类型 TTL 为准。';
                } else {
                    envNote.textContent = '环境变量未覆盖；保存后以本页配置为准。';
                }
            }
        };

        const loadCacheConfig = async () => {
            try {
                const res = await api('/admin/cache');
                if (!res?.success) return;
                const d = res.data || {};
                const enabled = document.getElementById('cacheEnabled');
                if (enabled) {
                    enabled.checked = d.enabled !== false && !d.envLocked;
                    enabled.disabled = !!d.envLocked;
                }
                const maxEntries = document.getElementById('cacheMaxEntries');
                if (maxEntries) maxEntries.value = d.maxEntries || 500;

                const grid = document.getElementById('cacheTtlGrid');
                if (grid) {
                    const types = Array.isArray(d.types) && d.types.length ? d.types : [];
                    grid.innerHTML = types.map((t) => {
                        const minutes = Number(d.ttlByType?.[t.key]) || 60;
                        return '<div class="cache-ttl-item">'
                            + '<label>' + escapeHtml(t.label) + '</label>'
                            + '<div class="cache-ttl-input"><input type="number" data-cache-ttl="' + escapeHtml(t.key) + '" min="1" max="10080" step="1" value="' + minutes + '"><span class="unit">分钟</span></div>'
                            + '</div>';
                    }).join('');
                }
                renderCacheStats(d);
            } catch (_) {}
        };

        const clearApiCacheConfirm = async () => {
            if (!confirm('确定清空 /api 响应缓存？清空后下一次请求会重新回源。')) return;
            const res = await api('/admin/cache/clear', { method: 'POST' });
            if (res?.success) {
                showToast('响应缓存已清空');
                renderCacheStats(res.data);
            } else {
                showToast(res?.error || '清空缓存失败', 'error');
            }
        };

        const doRefreshLoginBg = async (silent) => {
            const res = await api('/admin/login-bg/refresh', { method: 'POST' });
            if (res?.success) {
                renderLoginBgPreview(res.data);
                if (res.warning) showToast('已换图，但新图抓取失败：' + res.warning, 'error');
                else showToast(silent ? '背景图已缓存' : '已更换背景图');
            } else {
                showToast(res?.error || '更换背景图失败', 'error');
            }
            return res;
        };

        const refreshLoginBg = async () => {
            const btn = document.getElementById('loginBgRefreshBtn');
            if (btn) { btn.disabled = true; btn.textContent = '抓取中…'; }
            try {
                await doRefreshLoginBg(false);
            } finally {
                if (btn) { btn.disabled = false; btn.textContent = '立即换一张'; }
            }
        };

        const clearLoginBgCacheConfirm = async () => {
            if (!confirm('清除后，下次打开登录页会重新抓取一张随机图。确定清除？')) return;
            const res = await api('/admin/login-bg/cache/clear', { method: 'POST' });
            if (res?.success) {
                showToast('背景图缓存已清除');
                renderLoginBgPreview(res.data);
            } else {
                showToast(res?.error || '清除缓存失败', 'error');
            }
        };

        const logout = async () => {
            await api('/admin/logout', { method: 'POST' });
            localStorage.removeItem('authToken');
            localStorage.removeItem('authUsername');
            showLogin();
        };

        const switchSection = (section) => {
            document.querySelectorAll('.sidebar-menu li').forEach(li => li.classList.remove('active'));
            document.querySelector('[data-section="' + section + '"]').classList.add('active');
            document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
            document.getElementById(section + 'Section').classList.add('active');
            const titles = { dashboard: '仪表盘', cookies: 'Cookie 与监测', tokens: 'API Token', abuse: '滥用防护', users: '用户管理', logs: '操作日志', apilogs: 'API 调用日志', settings: '设置' };
            document.getElementById('pageTitle').textContent = titles[section];
            if (section === 'cookies') { loadCookies(); loadMonitor(); }
            if (section === 'dashboard') loadDashboard();
            if (section === 'users') loadUsers();
            if (section === 'logs') loadLogs();
            if (section === 'apilogs') { loadApiLogs(1); loadReferers(); }
            if (section === 'tokens') loadTokens();
            if (section === 'abuse') loadAbuse();
            if (section === 'settings') { loadGeoConfig(); loadLoginBgConfig(); loadCacheConfig(); }
        };

        // 设置页分类选项卡
        const settingsTabs = Array.from(document.querySelectorAll('.settings-tab'));
        const settingsPanels = Array.from(document.querySelectorAll('.settings-panel'));
        const activateSettingsTab = (tab) => {
            if (!tab) return;
            const target = tab.dataset.settingsTab;
            settingsTabs.forEach((t) => {
                const active = t === tab;
                t.classList.toggle('active', active);
                t.setAttribute('aria-selected', active ? 'true' : 'false');
                t.tabIndex = active ? 0 : -1;
            });
            settingsPanels.forEach((panel) => {
                panel.classList.toggle('active', panel.dataset.settingsPanel === target);
            });
        };
        settingsTabs.forEach((tab, index) => {
            tab.tabIndex = tab.classList.contains('active') ? 0 : -1;
            tab.addEventListener('click', () => activateSettingsTab(tab));
            tab.addEventListener('keydown', (e) => {
                if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
                e.preventDefault();
                const offset = e.key === 'ArrowRight' ? 1 : -1;
                const next = settingsTabs[(index + offset + settingsTabs.length) % settingsTabs.length];
                activateSettingsTab(next);
                next.focus();
            });
        });

        const loadAbuse = async () => {
            await Promise.all([loadAbuseStats(), loadAbuseConfig(), loadAbuseBans(), loadAbuseLogs(1)]);
        };

        let abuseLogCurrentPage = 1;
        let abuseLogTotalPages = 1;

        const getAbuseLogFilters = () => ({
            startTime: document.getElementById('abuseLogStartTime').value,
            endTime: document.getElementById('abuseLogEndTime').value,
            ip: document.getElementById('abuseLogIP').value.trim(),
            level: document.getElementById('abuseLogLevel').value,
            blocked: document.getElementById('abuseLogBlocked').value,
            keyword: document.getElementById('abuseLogKeyword').value.trim(),
        });

        const loadAbuseStats = async () => {
            const res = await api('/admin/abuse/stats');
            if (!res?.success) return;
            const d = res.data;
            document.getElementById('abuseActiveRecords').textContent = d.activeRecords || 0;
            document.getElementById('abuseBannedCount').textContent = d.activeBans || 0;
            document.getElementById('abuseRecentBlocked').textContent = d.recentBlocked || 0;
            document.getElementById('abuseTotalLogs').textContent = d.totalLogs || 0;
            // Top Requesters
            const top = d.topRequesters || [];
            const card = document.getElementById('topRequestersCard');
            const body = document.getElementById('topRequestersBody');
            if (top.length > 0) {
                card.style.display = '';
                body.innerHTML = top.slice(0, 10).map(r => '<tr>'
                    + '<td class="top-requester-ip">' + escapeHtml(r.ip) + '</td>'
                    + '<td>' + r.count + '</td>'
                    + '<td>' + (r.apiCount || 0) + '</td>'
                    + '<td>' + (r.violations || 0) + '</td></tr>').join('');
            } else {
                card.style.display = 'none';
            }
        };

        // 续期开关联动：未勾选时置灰时长输入
        window.syncAbuseExtendUI = () => {
            const on = document.getElementById('abuseExtendOnHit').checked;
            document.getElementById('abuseExtendMs').disabled = !on;
            document.getElementById('abuseExtendRow').style.opacity = on ? '1' : '0.45';
        };

        const loadAbuseConfig = async () => {
            const res = await api('/admin/abuse/config');
            if (res?.success && res.data) {
                const c = res.data;
                document.getElementById('abuseEnabled').checked = c.enabled !== false;
                document.getElementById('abuseWindowMs').value = (c.rateLimit?.windowMs || 60000) / 1000;
                document.getElementById('abuseMaxRequests').value = c.rateLimit?.maxRequests || 120;
                document.getElementById('abuseMaxApiRequests').value = c.rateLimit?.maxApiRequests || 60;
                document.getElementById('abuseThreshold').value = c.ban?.threshold || 3;
                document.getElementById('abuseDuration').value = (c.ban?.duration || 3600000) / 60000;
                document.getElementById('abuseExtendOnHit').checked = c.ban?.extendOnHit !== false;
                document.getElementById('abuseExtendMs').value = (c.ban?.extendMs || 600000) / 60000;
                document.getElementById('abuseRuleRapid').checked = c.rules?.rapidRequests !== false;
                document.getElementById('abuseRuleInvalid').checked = c.rules?.invalidParams !== false;
                document.getElementById('abuseRulePath').checked = c.rules?.pathEnumeration !== false;
                document.getElementById('abuseRulePattern').checked = c.rules?.suspiciousPatterns !== false;
                document.getElementById('abuseWhitelistIps').value = (c.whitelist?.ips || []).join(',');
                window.syncAbuseExtendUI();
            }
        };

        const updateAbusePagination = () => {
            document.getElementById('abuseLogTotalCount').textContent = '...';
            document.getElementById('abuseLogCurrentPage').textContent = abuseLogCurrentPage;
            document.getElementById('abuseLogTotalPages').textContent = abuseLogTotalPages;
            document.getElementById('abuseLogPageInfo').textContent = abuseLogCurrentPage;
            document.getElementById('abuseLogFirstBtn').disabled = abuseLogCurrentPage <= 1;
            document.getElementById('abuseLogPrevBtn').disabled = abuseLogCurrentPage <= 1;
            document.getElementById('abuseLogNextBtn').disabled = abuseLogCurrentPage >= abuseLogTotalPages;
            document.getElementById('abuseLogLastBtn').disabled = abuseLogCurrentPage >= abuseLogTotalPages;
        };

        window.loadAbuseLogs = async (page = 1) => {
            const filters = getAbuseLogFilters();
            const params = new URLSearchParams({ page: Math.max(1, page), pageSize: 50 });
            if (filters.ip) params.set('ip', filters.ip);
            if (filters.level) params.set('level', filters.level);
            if (filters.blocked) params.set('blocked', filters.blocked);
            if (filters.keyword) params.set('keyword', filters.keyword);
            const res = await api('/admin/abuse/logs?' + params.toString());
            if (!res?.success) return;
            const { items, total } = res.data;
            window._abuseLogs = items;
            abuseLogTotalPages = res.data.totalPages || 1;
            abuseLogCurrentPage = res.data.page || 1;
            document.getElementById('abuseLogTotalCount').textContent = total;
            const tbody = document.getElementById('abuseLogsBody');
            if (items.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:20px;color:#94a3b8;">暂无日志</td></tr>';
            } else {
                tbody.innerHTML = items.map((log, idx) => {
                    const badgeClass = log.level === 'ban' ? 'badge-error' : log.level === 'high' ? 'badge-warning' : log.level === 'medium' ? 'badge-info' : 'badge-primary';
                    const statusHtml = log.blocked
                        ? '<span style="color:#ef4444;font-weight:600;">已拦截</span>' + (log.hitCount > 1 ? ' <span style="color:#f59e0b;font-size:11px;font-weight:600;" title="聚合命中次数">×' + log.hitCount + '</span>' : '')
                        : '<span style="color:#10b981;">已记录</span>';
                    return '<tr data-log-idx="' + idx + '" onclick="toggleAbuseDetail(' + idx + ')" style="cursor:pointer;">'
                        + '<td>' + escapeHtml(new Date(log.timestamp).toLocaleString('zh-CN')) + '</td>'
                        + '<td>' + escapeHtml(log.ip) + '</td>'
                        + '<td><code style="font-size:11px;background:rgba(255,255,255,0.1);padding:1px 5px;border-radius:3px;">' + escapeHtml(log.method) + '</code></td>'
                        + '<td><span class="badge ' + badgeClass + '">' + escapeHtml(log.level) + '</span></td>'
                        + '<td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + escapeHtml(log.path) + '">' + escapeHtml(log.path) + '</td>'
                        + '<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + escapeHtml(log.reason) + '">' + escapeHtml(log.reason) + '</td>'
                        + '<td>' + statusHtml + '</td>'
                        + '<td style="white-space:nowrap;"><button class="btn btn-sm btn-default" onclick="event.stopPropagation();toggleAbuseDetail(' + idx + ')">详情</button></td>'
                        + '</tr>';
                }).join('');
            }
            updateAbusePagination();
            loadAbuseStats();
        };

        window.toggleAbuseDetail = (idx) => {
            const logs = window._abuseLogs;
            if (!logs || logs.length === 0) return;
            const existing = document.querySelector('.abuse-detail-row');
            if (existing) { existing.remove(); return; }
            const log = logs[idx];
            if (!log) return;
            const violationsHtml = (log.violations || []).map(v =>
                '<div class="abuse-violation-card abuse-vi-' + escapeHtml(v.severity || 'low') + '">'
                + '<span class="abuse-vi-severity sev-' + escapeHtml(v.severity || 'low') + '">' + escapeHtml(v.severity || 'low') + '</span>'
                + '<span class="abuse-vi-type">' + escapeHtml(v.type || '') + '</span>'
                + '<span class="abuse-vi-detail">' + escapeHtml(v.detail || '') + '</span>'
                + '</div>'
            ).join('');
            const detailRow = document.createElement('tr');
            detailRow.className = 'abuse-detail-row';
            detailRow.innerHTML = '<td colspan="8"><div class="abuse-detail-panel">'
                + '<div class="abuse-detail-grid">'
                + '<div class="abuse-detail-item"><label>请求路径</label><code>' + escapeHtml(log.path) + '</code></div>'
                + '<div class="abuse-detail-item"><label>User-Agent</label><code>' + escapeHtml(log.userAgent || '(无)') + '</code></div>'
                + (log.hitCount > 1 ? '<div class="abuse-detail-item"><label>聚合命中</label><code>' + log.hitCount + ' 次（同一 IP 每分钟聚合为一条）</code></div>' : '')
                + '</div>'
                + (violationsHtml ? '<div class="abuse-violations-title">违规明细 (' + (log.violations || []).length + ' 项)</div><div class="abuse-violation-list">' + violationsHtml + '</div>' : '')
                + '</div></td>';
            const row = document.querySelector('[data-log-idx="' + idx + '"]');
            if (row) row.after(detailRow);
        };

        window.resetAbuseFilters = () => {
            document.getElementById('abuseLogStartTime').value = '';
            document.getElementById('abuseLogEndTime').value = '';
            document.getElementById('abuseLogIP').value = '';
            document.getElementById('abuseLogLevel').value = '';
            document.getElementById('abuseLogBlocked').value = '';
            document.getElementById('abuseLogKeyword').value = '';
            loadAbuseLogs(1);
        };

        window.exportAbuseLogs = async () => {
            showToast('正在导出所有数据...', 'success');
            try {
                const allItems = [];
                let page = 1;
                let totalPages = 1;
                while (page <= totalPages) {
                    const filters = getAbuseLogFilters();
                    const params = new URLSearchParams({ page, pageSize: 500 });
                    if (filters.ip) params.set('ip', filters.ip);
                    if (filters.level) params.set('level', filters.level);
                    if (filters.blocked) params.set('blocked', filters.blocked);
                    if (filters.keyword) params.set('keyword', filters.keyword);
                    const res = await api('/admin/abuse/logs?' + params.toString());
                    if (!res?.success) break;
                    allItems.push(...res.data.items);
                    totalPages = res.data.totalPages || 1;
                    page++;
                }
                const headers = ['时间', 'IP', '方法', '级别', '路径', '原因', '状态', '违规明细'];
                const rows = allItems.map(log => [
                    new Date(log.timestamp).toLocaleString('zh-CN'),
                    log.ip,
                    log.method,
                    log.level,
                    log.path,
                    log.reason,
                    log.blocked ? '已拦截' : '已记录',
                    (log.violations || []).map(v => v.type + ': ' + v.detail).join('; '),
                ].map(cell => '"' + String(cell).replace(/"/g, '""') + '"').join(','));
                const bom = '\\uFEFF';
                const csv = bom + headers.join(',') + '\\n' + rows.join('\\n');
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'abuse_logs_' + new Date().toISOString().slice(0, 10) + '.csv';
                a.click();
                URL.revokeObjectURL(url);
                showToast('导出成功，共 ' + allItems.length + ' 条记录');
            } catch (e) {
                showToast('导出失败: ' + e.message, 'error');
            }
        };

        const loadAbuseBans = async () => {
            const res = await api('/admin/abuse/bans');
            const tbody = document.getElementById('abuseBansBody');
            if (res?.success) {
                tbody.innerHTML = res.data.map(ban => {
                    const expired = ban.expiresAt ? new Date(ban.expiresAt).toLocaleString('zh-CN') : '永久';
                    return '<tr><td>' + escapeHtml(ban.ip) + '</td>'
                        + '<td>' + escapeHtml(ban.reason) + '</td>'
                        + '<td>' + escapeHtml(new Date(ban.bannedAt).toLocaleString('zh-CN')) + '</td>'
                        + '<td>' + escapeHtml(expired) + '</td>'
                        + '<td style="white-space:nowrap;">'
                            + '<button class="btn btn-sm btn-default" onclick="resetCount(\\'' + ban.ip + '\\')" style="margin-right:4px;">重置计数</button>'
                            + '<button class="btn btn-sm btn-danger" onclick="unbanIP(\\'' + ban.ip + '\\')">解封</button>'
                        + '</td></tr>';
                }).join('') || '<tr><td colspan="5" style="text-align:center;padding:20px;color:#94a3b8;">暂无封禁</td></tr>';
            }
        };

        window.resetCount = async (ip) => {
            if (!confirm('确定重置 IP ' + ip + ' 的请求计数？')) return;
            const res = await api('/admin/abuse/reset/' + encodeURIComponent(ip), { method: 'POST' });
            if (res?.success) {
                showToast('已重置计数');
                loadAbuseStats();
            } else {
                showToast('重置失败: ' + (res?.error || '未知错误'), 'error');
            }
        };

        window.unbanIP = async (ip) => {
            if (!confirm('确定解封 ' + ip + ' ？')) return;
            const res = await api('/admin/abuse/bans/' + encodeURIComponent(ip), { method: 'DELETE' });
            if (res?.success) {
                showToast('已解封');
                loadAbuseBans();
                loadAbuseStats();
            }
        };

        window.clearAbuseLogs = async () => {
            if (!confirm('确定清空所有滥用日志？此操作不可恢复。')) return;
            const res = await api('/admin/abuse/logs', { method: 'DELETE' });
            if (res?.success) {
                showToast('已清空');
                loadAbuseLogs(1);
                loadAbuseStats();
            }
        };

        document.addEventListener('submit', async (e) => {
            if (e.target.id === 'abuseConfigForm') {
                e.preventDefault();
                const config = {
                    enabled: document.getElementById('abuseEnabled').checked,
                    rateLimit: {
                        windowMs: parseInt(document.getElementById('abuseWindowMs').value) * 1000,
                        maxRequests: parseInt(document.getElementById('abuseMaxRequests').value),
                        maxApiRequests: parseInt(document.getElementById('abuseMaxApiRequests').value),
                    },
                    ban: {
                        threshold: parseInt(document.getElementById('abuseThreshold').value),
                        duration: parseInt(document.getElementById('abuseDuration').value) * 60000,
                        extendOnHit: document.getElementById('abuseExtendOnHit').checked,
                        extendMs: parseInt(document.getElementById('abuseExtendMs').value) * 60000,
                    },
                    rules: {
                        rapidRequests: document.getElementById('abuseRuleRapid').checked,
                        invalidParams: document.getElementById('abuseRuleInvalid').checked,
                        pathEnumeration: document.getElementById('abuseRulePath').checked,
                        suspiciousPatterns: document.getElementById('abuseRulePattern').checked,
                    },
                    whitelist: {
                        ips: document.getElementById('abuseWhitelistIps').value
                            .split(',').map(s => s.trim()).filter(Boolean),
                    },
                };
                const res = await api('/admin/abuse/config', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(config),
                });
                if (res?.success) showToast('配置已保存');
            }
            if (e.target.id === 'abuseBanForm') {
                e.preventDefault();
                const ip = document.getElementById('banIPInput').value.trim();
                const reason = document.getElementById('banReasonInput').value.trim();
                const minutes = parseInt(document.getElementById('banDurationInput').value) || 60;
                const permanent = document.getElementById('banPermanentCheck').checked;
                if (!ip) { showToast('请输入IP', 'error'); return; }
                const body = { ip, reason };
                if (permanent) {
                    body.permanent = true;
                } else {
                    body.duration = minutes * 60000;
                }
                const res = await api('/admin/abuse/bans', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                if (res?.success) {
                    showToast('已封禁');
                    document.getElementById('banIPInput').value = '';
                    document.getElementById('banReasonInput').value = '';
                    document.getElementById('banDurationInput').value = '';
                    loadAbuseBans();
                    loadAbuseStats();
                }
            }
        });

        const loadDashboard = async () => {
            const [statsRes, seriesRes, refsRes, cookiesRes, bansRes, logsRes] = await Promise.all([
                api('/admin/api-logs/stats').catch(() => null),
                api('/admin/api-logs/timeseries?hours=24').catch(() => null),
                api('/admin/api-logs/referers?hours=24&limit=6').catch(() => null),
                api('/admin/cookies').catch(() => null),
                api('/admin/abuse/bans').catch(() => null),
                api('/admin/logs?limit=6').catch(() => null)
            ]);

            const setText = (id, value) => {
                const node = document.getElementById(id);
                if (node) node.textContent = value;
            };
            const barRow = (name, count, share) => {
                const pct = Math.max(2, Math.round((share || 0) * 100));
                return '<div class="list-row"><span class="list-name">' + escapeHtml(name) + '</span>' +
                    '<span class="share"><i style="width:' + pct + '%"></i></span>' +
                    '<span class="list-val">' + count + '</span></div>';
            };
            const emptyRow = (text) => '<p class="user-info-tooltip">' + escapeHtml(text) + '</p>';

            const stats = statsRes?.success ? statsRes.data : null;
            const total = stats?.last24h || 0;
            const success = stats?.byStatus?.success || 0;
            setText('kpiCalls', total);
            setText('kpiCallsSub', '累计 ' + (stats?.total || 0));
            setText('kpiRate', total ? Math.round(success / total * 100) + '%' : '-');
            setText('kpiIPs', stats?.uniqueIPs24h ?? '-');

            const cookies = cookiesRes?.success ? cookiesRes.data : [];
            const valid = cookies.filter(c => c.isValid === true).length;
            setText('kpiCookies', valid + ' / ' + cookies.length);
            setText('kpiBans', bansRes?.success ? bansRes.data.length : '-');

            const refs = refsRes?.success ? refsRes.data : null;
            setText('kpiSources', refs ? refs.uniqueHosts : '-');

            // 24 小时柱状图：橙=成功，红=失败
            const bars = document.getElementById('boardBars');
            const series = seriesRes?.success ? seriesRes.data : [];
            if (bars) {
                const max = Math.max(1, ...series.map(item => item.total));
                bars.innerHTML = series.map(item => {
                    const height = Math.round((item.total / max) * 100);
                    const errHeight = item.total ? Math.round((item.error / item.total) * height) : 0;
                    const okHeight = height - errHeight;
                    const hour = new Date(item.t).getHours();
                    const title = hour + ':00 · ' + item.total + ' 次 · 失败 ' + item.error;
                    return '<div class="bar" title="' + title + '">' +
                        '<span class="ok" style="height:' + okHeight + '%"></span>' +
                        '<span class="err" style="height:' + errHeight + '%"></span></div>';
                }).join('');
            }
            const axis = document.getElementById('boardAxis');
            if (axis) {
                axis.innerHTML = series.map((item, index) => index % 4 === 0
                    ? '<span>' + new Date(item.t).getHours() + '时</span>'
                    : '<span></span>').join('');
            }

            const types = Object.entries(stats?.byType || {}).sort((a, b) => b[1] - a[1]);
            const typeTotal = types.reduce((sum, entry) => sum + entry[1], 0) || 1;
            const typeBox = document.getElementById('boardTypes');
            if (typeBox) {
                typeBox.innerHTML = types.length
                    ? types.map(entry => barRow(entry[0] === 'invalid' ? '其他' : entry[0], entry[1], entry[1] / typeTotal)).join('')
                    : emptyRow('近 24 小时暂无调用');
            }

            const sources = document.getElementById('boardSources');
            if (sources) {
                const items = refs?.items || [];
                sources.innerHTML = items.length
                    ? items.map(item => barRow(item.host === 'direct' ? '直接访问' : item.host, item.count, item.share)).join('')
                    : emptyRow('暂无来源记录');
            }

            const cookieBox = document.getElementById('boardCookies');
            if (cookieBox) {
                const groups = {};
                for (const cookie of cookies) {
                    const key = cookie.platform || '其他';
                    groups[key] = groups[key] || { total: 0, valid: 0 };
                    groups[key].total++;
                    if (cookie.isValid === true) groups[key].valid++;
                }
                const entries = Object.entries(groups).sort((a, b) => b[1].total - a[1].total);
                cookieBox.innerHTML = entries.length
                    ? entries.map(entry => {
                        const health = entry[1].total ? entry[1].valid / entry[1].total : 0;
                        const label = getPlatformName(entry[0]) + ' · ' + entry[1].valid + '/' + entry[1].total;
                        return barRow(label, Math.round(health * 100) + '%', health);
                    }).join('')
                    : emptyRow('还没有配置 Cookie');
            }

            const ops = document.getElementById('boardOps');
            if (ops) {
                const items = logsRes?.success ? logsRes.data : [];
                ops.innerHTML = items.length
                    ? items.map(log => '<div class="list-row"><span class="list-name">' + escapeHtml(log.action) + '</span>' +
                        '<span class="list-val">' + escapeHtml(formatDate(log.timestamp)) + '</span></div>').join('')
                    : emptyRow('暂无操作记录');
            }
        };

        const loadCookies = async () => {
            const res = await api('/admin/cookies');
            if (!res?.success) return;
            const grid = document.getElementById('cookiesList');
            if (!grid) return;
            if (!res.data || res.data.length === 0) {
                grid.innerHTML = '<div class="cookie-empty"><div class="empty-state-icon">${icon('cookie')}</div><div class="empty-state-text">暂无 Cookie 数据</div><p>' + (QR_LOGIN_ENABLED ? '用右上角的「网易云扫码登录」或「手动添加」接入一个账号。' : '用右上角的「添加 Cookie」接入一个账号。') + '</p></div>';
                return;
            }
            grid.innerHTML = res.data.map(cookie => {
                const user = cookie.userInfo || {};
                const name = user.nickname || cookie.note || '未命名账号';
                const initial = String(name).trim().charAt(0) || (cookie.platform === 'netease' ? '网' : 'Q');
                const avatar = user.avatarUrl ? String(user.avatarUrl).replace(/^http:/, 'https:') : '';
                const uid = user.userId ? 'UID ' + user.userId : '未绑定账号信息';
                const validity = cookie.isValid === true
                    ? '<span class="badge badge-success">有效</span>'
                    : cookie.isValid === false
                        ? '<span class="badge badge-error">无效</span>'
                        : '<span class="badge badge-warning">未验证</span>';
                const roleLabel = user.vipRoleLabel || (user.isVip ? 'VIP' : '普通用户');
                const roleClass = user.vipRole === 'svip'
                    ? 'svip'
                    : (user.vipRole === 'vip' || user.isVip) ? 'ok' : 'muted';
                const pad2 = (n) => String(n).padStart(2, '0');
                const shortDateTime = (ts) => {
                    if (!ts) return '';
                    const d = new Date(ts);
                    if (Number.isNaN(d.getTime())) return '-';
                    return pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
                };
                const shortDate = (ts) => {
                    if (!ts) return '-';
                    const d = new Date(ts);
                    if (Number.isNaN(d.getTime())) return '-';
                    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
                };
                const lastValid = cookie.validatedAt ? shortDateTime(cookie.validatedAt) : '未验证';
                const created = shortDate(cookie.createdAt);
                const noteRow = cookie.note
                    ? '<div class="cookie-kv"><span class="cookie-kv-label">备注</span><span class="cookie-kv-value">' + escapeHtml(cookie.note) + '</span></div>'
                    : '';
                const errorRow = cookie.validationError
                    ? '<p class="cookie-error">' + escapeHtml(cookie.validationError) + '</p>'
                    : '';
                return '<article class="cookie-card' + (cookie.isActive ? '' : ' is-inactive') + '">' +
                    '<div class="cookie-card-head">' +
                        '<div class="cookie-avatar' + (avatar ? '' : ' is-fallback') + '">' +
                            (avatar ? '<img src="' + escapeHtml(avatar) + '" alt="" loading="lazy" onerror="this.style.display=\\'none\\';this.parentElement.classList.add(\\'is-fallback\\')">' : '') +
                            '<span>' + escapeHtml(initial) + '</span>' +
                        '</div>' +
                        '<div class="cookie-identity">' +
                            '<div class="cookie-platform">' +
                                '<span class="cookie-platform-ico" data-platform="' + escapeHtml(cookie.platform) + '"></span>' +
                                '<span>' + escapeHtml(getPlatformName(cookie.platform)) + '</span>' +
                                validity +
                            '</div>' +
                            '<div class="cookie-name">' + escapeHtml(name) + '</div>' +
                            '<div class="cookie-sub">' + escapeHtml(uid) + '</div>' +
                        '</div>' +
                        '<div class="cookie-head-side">' +
                            '<label class="ck-switch" title="' + (cookie.isActive ? '点击禁用' : '点击启用') + '">' +
                                '<input type="checkbox" ' + (cookie.isActive ? 'checked ' : '') + 'aria-label="启用此 Cookie" onchange="toggleCookieActive(\\'' + escapeHtml(cookie.id) + '\\', this.checked)">' +
                                '<span class="ck-track"><span class="ck-thumb"></span></span>' +
                            '</label>' +
                            '<span class="cookie-active-text">' + (cookie.isActive ? '启用' : '禁用') + '</span>' +
                        '</div>' +
                    '</div>' +
                    '<div class="cookie-card-body">' +
                        '<div class="cookie-kv"><span class="cookie-kv-label">Cookie</span><span class="cookie-kv-value"><code class="cookie-preview-line" title="' + escapeHtml(cookie.cookiePreview || '') + '">' + escapeHtml(cookie.cookiePreview || '-') + '</code></span></div>' +
                        noteRow +
                        '<div class="cookie-facts">' +
                            '<div class="cookie-fact"><span class="cookie-fact-label">角色</span><span class="cookie-fact-value ' + roleClass + '">' + escapeHtml(roleLabel) + '</span></div>' +
                            '<div class="cookie-fact"><span class="cookie-fact-label">最近验证</span><span class="cookie-fact-value muted" title="' + escapeHtml(cookie.validatedAt ? formatDate(cookie.validatedAt) : '未验证') + '">' + escapeHtml(lastValid) + '</span></div>' +
                            '<div class="cookie-fact"><span class="cookie-fact-label">创建时间</span><span class="cookie-fact-value muted" title="' + escapeHtml(formatDate(cookie.createdAt)) + '">' + escapeHtml(created) + '</span></div>' +
                        '</div>' +
                        errorRow +
                    '</div>' +
                    '<div class="cookie-card-foot"><div class="cookie-actions">' +
                        '<button class="btn btn-default btn-sm" onclick="verifyCookie(\\'' + escapeHtml(cookie.id) + '\\')">验证</button>' +
                        '<button class="btn btn-default btn-sm" onclick="editCookie(\\'' + escapeHtml(cookie.id) + '\\')">编辑</button>' +
                        '<button class="btn btn-danger btn-sm" onclick="deleteCookie(\\'' + escapeHtml(cookie.id) + '\\')">删除</button>' +
                    '</div></div>' +
                '</article>';
            }).join('');
        };

        const loadUsers = async () => {
            const res = await api('/admin/users');
            if (!res?.success) return;
            const tbody = document.getElementById('usersList');
            tbody.innerHTML = res.data.map(user => '<tr><td>' + escapeHtml(user.username) + '</td><td><span class="badge ' + (user.role === 'admin' ? 'badge-warning' : 'badge-success') + '">' + (user.role === 'admin' ? '管理员' : '普通用户') + '</span></td><td>' + escapeHtml(formatDate(user.createdAt)) + '</td><td>' + escapeHtml(formatDate(user.lastLogin)) + '</td><td class="actions"><button class="btn btn-default btn-sm" onclick="editUser(\\'' + escapeHtml(user.username) + '\\')">编辑</button>' + (user.username !== 'admin' ? '<button class="btn btn-danger btn-sm" onclick="deleteUser(\\'' + escapeHtml(user.username) + '\\')">删除</button>' : '') + '</td></tr>').join('');
        };

        let logsCurrentPage = 1;
        let logsTotalPages = 1;
        let logsTotalCount = 0;
        const logsPageSize = 20;

        const updateLogsPagination = () => {
            document.getElementById('logsPageInfo').textContent = logsCurrentPage;
            document.getElementById('logsTotalPagesInfo').textContent = logsTotalPages;
            document.getElementById('logsTotalCount').textContent = logsTotalCount;
            document.getElementById('logsFirstBtn').disabled = logsCurrentPage <= 1;
            document.getElementById('logsPrevBtn').disabled = logsCurrentPage <= 1;
            document.getElementById('logsNextBtn').disabled = logsCurrentPage >= logsTotalPages;
            document.getElementById('logsLastBtn').disabled = logsCurrentPage >= logsTotalPages;
        };

        const loadLogs = async (page = 1) => {
            logsCurrentPage = Math.max(1, page);
            const res = await api('/admin/logs?page=' + logsCurrentPage + '&pageSize=' + logsPageSize);
            if (!res?.success) return;
            logsTotalPages = res.totalPages || 1;
            logsTotalCount = res.total || 0;
            if (logsCurrentPage > logsTotalPages) {
                return loadLogs(logsTotalPages);
            }
            const tbody = document.getElementById('logsList');
            if (!res.data || res.data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" class="empty-state-text">暂无操作日志</td></tr>';
            } else {
                tbody.innerHTML = res.data.map(log => '<tr><td>' + escapeHtml(formatDate(log.timestamp)) + '</td><td>' + escapeHtml(log.action) + '</td><td>' + escapeHtml(log.details) + '</td><td>' + escapeHtml(log.username) + '</td></tr>').join('');
            }
            updateLogsPagination();
        };

        const clearOperationLogs = async () => {
            if (!confirm('确定清空所有操作日志？此操作不可恢复。')) return;
            const res = await api('/admin/logs', { method: 'DELETE' });
            if (res?.success) {
                showToast('已清空 ' + (res.data?.count ?? 0) + ' 条操作日志');
                loadLogs();
            } else {
                showToast(res?.error || '清空失败', 'error');
            }
        };

        // === API 调用日志 ===
        let apiLogCurrentPage = 1;
        let apiLogTotalPages = 1;
        let apiLogTotalCount = 0;

        const getApiLogFilters = () => ({
            startTime: document.getElementById('apiLogStartTime').value ? new Date(document.getElementById('apiLogStartTime').value).getTime() : '',
            endTime: document.getElementById('apiLogEndTime').value ? new Date(document.getElementById('apiLogEndTime').value).getTime() : '',
            ip: document.getElementById('apiLogIP').value.trim(),
            server: document.getElementById('apiLogServer').value,
            type: document.getElementById('apiLogType').value,
            status: document.getElementById('apiLogStatus').value,
            keyword: document.getElementById('apiLogKeyword').value.trim(),
        });

        const resetApiLogFilters = () => {
            document.getElementById('apiLogStartTime').value = '';
            document.getElementById('apiLogEndTime').value = '';
            document.getElementById('apiLogIP').value = '';
            document.getElementById('apiLogServer').value = '';
            document.getElementById('apiLogType').value = '';
            document.getElementById('apiLogStatus').value = '';
            document.getElementById('apiLogKeyword').value = '';
            loadApiLogs(1);
        };

        const updateApiLogPagination = () => {
            document.getElementById('apiLogTotalCount').textContent = apiLogTotalCount;
            document.getElementById('apiLogCurrentPage').textContent = apiLogCurrentPage;
            document.getElementById('apiLogTotalPages').textContent = apiLogTotalPages;
            document.getElementById('apiLogPageInfo').textContent = apiLogCurrentPage;
            document.getElementById('apiLogFirstBtn').disabled = apiLogCurrentPage <= 1;
            document.getElementById('apiLogPrevBtn').disabled = apiLogCurrentPage <= 1;
            document.getElementById('apiLogNextBtn').disabled = apiLogCurrentPage >= apiLogTotalPages;
            document.getElementById('apiLogLastBtn').disabled = apiLogCurrentPage >= apiLogTotalPages;
        };

        const loadApiLogStats = async () => {
            try {
                const res = await api('/admin/api-logs/stats');
                if (!res?.success) return;
                const d = res.data;
                document.getElementById('apiLogTotal').textContent = d.total || 0;
                document.getElementById('apiLog24h').textContent = d.last24h || 0;
                document.getElementById('apiLogIPs').textContent = d.uniqueIPs24h || 0;
                document.getElementById('apiLogSuccess').textContent = (d.byStatus?.success || 0);
            } catch (_) {}
        };

        const loadReferers = async () => {
            const tbody = document.getElementById('refererList');
            if (!tbody) return;
            const hours = document.getElementById('refererHours')?.value || '24';
            try {
                const res = await api('/admin/api-logs/referers?hours=' + encodeURIComponent(hours));
                if (!res?.success) return;
                const data = res.data || {};
                if (!data.items || data.items.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:#94a3b8;">该时间范围内没有来源记录</td></tr>';
                    return;
                }
                tbody.innerHTML = data.items.map(item => {
                    const host = item.host === 'direct' ? '直接访问' : escapeHtml(item.host);
                    const share = (item.share * 100).toFixed(1) + '%';
                    const region = item.topRegion || (item.topCountry && item.topCountry !== '??' ? item.topCountry : '');
                    return '<tr><td>' + host + '</td><td>' + item.count + '</td><td>' + share + '</td><td>' +
                        item.uniqueIPs + '</td><td>' + escapeHtml(item.topServer || '-') + '</td><td>' +
                        escapeHtml(region || '-') + '</td><td>' +
                        escapeHtml(formatDate(item.lastSeen)) + '</td></tr>';
                }).join('');
                const countryBox = document.getElementById('refererCountries');
                if (countryBox) {
                    const regions = (data.regions || [])
                        .filter(item => item.label && item.label !== '??')
                        .slice(0, 8)
                        .map(item => item.label + ' ' + (item.share * 100).toFixed(0) + '%');
                    const countries = (data.countries || [])
                        .filter(item => item.code && item.code !== '??')
                        .slice(0, 8)
                        .map(item => item.code + ' ' + (item.share * 100).toFixed(0) + '%');
                    const parts = regions.length ? regions : countries;
                    countryBox.textContent = parts.length ? '地区分布：' + parts.join(' · ') : '地区分布：暂无可用归属地（IPv6 或保留地址）';
                }
            } catch (_) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:20px;color:#c22f28;">来源统计加载失败</td></tr>';
            }
        };

        const loadApiLogs = async (page = 1) => {
            apiLogCurrentPage = page;
            const filters = getApiLogFilters();
            const params = new URLSearchParams({ page, pageSize: 50 });
            if (filters.startTime) params.set('startTime', filters.startTime);
            if (filters.endTime) params.set('endTime', filters.endTime);
            if (filters.ip) params.set('ip', filters.ip);
            if (filters.server) params.set('server', filters.server);
            if (filters.type) params.set('type', filters.type);
            if (filters.status) params.set('status', filters.status);
            if (filters.keyword) params.set('keyword', filters.keyword);

            const res = await api('/admin/api-logs?' + params.toString());
            if (!res?.success) return;

            const { items, total, totalPages } = res;
            apiLogTotalPages = totalPages;
            apiLogTotalCount = total;

            const tbody = document.getElementById('apiLogsList');
            if (items.length === 0) {
                tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:20px;color:#94a3b8;">暂无记录</td></tr>';
            } else {
                tbody.innerHTML = items.map(l => {
                    const statusBadge = l.status === 'success'
                        ? '<span class="badge badge-success">成功</span>'
                        : '<span class="badge badge-error">失败</span>';
                    const typeText = l.type || '-';
                    const requestId = l.requestId || '-';
                    const songText = l.songName ? (l.songName + (l.songArtist ? ' - ' + l.songArtist : '')) : '-';
                    return '<tr>' +
                        '<td>' + escapeHtml(formatDate(l.timestamp)) + '</td>' +
                        '<td>' + escapeHtml(l.ip) + '</td>' +
                        '<td>' + escapeHtml(l.server) + '</td>' +
                        '<td><div class="cell-clip cell-clip-type" title="' + escapeHtml(typeText) + '">' + escapeHtml(typeText) + '</div></td>' +
                        '<td><div class="cell-clip cell-clip-id" title="' + escapeHtml(requestId) + '">' + escapeHtml(requestId) + '</div></td>' +
                        '<td>' + escapeHtml(String(l.statusCode)) + '</td>' +
                        '<td>' + statusBadge + '</td>' +
                        '<td>' + escapeHtml(l.durationMs + 'ms') + '</td>' +
                        '<td><div class="cell-clip cell-clip-song" title="' + escapeHtml(songText) + '">' + escapeHtml(songText) + '</div></td>' +
                        '</tr>';
                }).join('');
            }
            updateApiLogPagination();
            loadApiLogStats();
        };

        const exportApiLogs = () => {
            const filters = getApiLogFilters();
            const params = new URLSearchParams();
            if (filters.startTime) params.set('startTime', filters.startTime);
            if (filters.endTime) params.set('endTime', filters.endTime);
            if (filters.ip) params.set('ip', filters.ip);
            if (filters.server) params.set('server', filters.server);
            if (filters.type) params.set('type', filters.type);
            if (filters.status) params.set('status', filters.status);
            if (filters.keyword) params.set('keyword', filters.keyword);
            window.open('/admin/api-logs/export?' + params.toString(), '_blank');
        };

        const clearApiLogs = async () => {
            if (!confirm('确定要清空所有 API 调用日志吗？此操作不可恢复。')) return;
            const res = await api('/admin/api-logs', 'DELETE');
            if (res?.success) {
                loadApiLogs(1);
            } else {
                alert('清空失败: ' + (res?.error || '未知错误'));
            }
        };

        const loadTokens = async () => {
            const res = await api('/admin/tokens');
            if (!res?.success) return;
            const tbody = document.getElementById('tokensList');
            if (res.data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" class="empty-state"><div class="empty-state-icon">${icon('key')}</div><div class="empty-state-text">暂无 API Token</div></td></tr>';
            } else {
                tbody.innerHTML = res.data.map(token => {
                    const tokenPreview = token.id.substring(0, 8) + '...';
                    return '<tr>' +
                        '<td>' + escapeHtml(token.name) + '</td>' +
                        '<td><code style="font-size:11px;color:var(--text-muted);">' + escapeHtml(tokenPreview) + '</code></td>' +
                        '<td>' + escapeHtml(formatDate(token.createdAt)) + '</td>' +
                        '<td>' + (token.lastUsedAt ? escapeHtml(formatDate(token.lastUsedAt)) : '-') + '</td>' +
                        '<td>' + escapeHtml(token.usageCount || 0) + '</td>' +
                        '<td class="actions">' +
                            '<button class="btn btn-danger btn-sm" onclick="deleteToken(\\'' + escapeHtml(token.id) + '\\',\\'' + escapeHtml(token.name) + '\\')">删除</button>' +
                        '</td></tr>';
                }).join('');
            }
        };

        const showTokenModal = () => {
            document.getElementById('tokenForm').reset();
            document.getElementById('tokenModal').classList.add('show');
        };

        const createToken = async () => {
            const name = document.getElementById('tokenName').value.trim();
            if (!name) {
                showToast('请输入 Token 名称', 'error');
                return;
            }
            const res = await api('/admin/tokens', {
                method: 'POST',
                body: JSON.stringify({ name })
            });
            if (res?.success) {
                closeModal('tokenModal');
                document.getElementById('createdToken').value = res.data.token;
                document.getElementById('tokenShowModal').classList.add('show');
                loadTokens();
            } else {
                showToast(res?.error || '创建失败', 'error');
            }
        };

        const copyCreatedToken = () => {
            const token = document.getElementById('createdToken').value;
            navigator.clipboard.writeText(token).then(() => showToast('已复制到剪贴板'));
        };

        const deleteToken = async (id, name) => {
            if (!confirm('确定要删除 Token "' + name + '" 吗？删除后使用该 Token 的应用将无法访问 API。')) return;
            const res = await api('/admin/tokens/' + id, { method: 'DELETE' });
            if (res?.success) {
                showToast('Token 已删除');
                loadTokens();
            } else {
                showToast(res?.error || '删除失败', 'error');
            }
        };

        let monitorLogCurrentPage = 1;
        let monitorLogTotalPages = 1;
        let monitorLogTotalCount = 0;
        const monitorLogPageSize = 20;

        const updateMonitorLogPagination = () => {
            document.getElementById('monitorLogPageInfo').textContent = monitorLogCurrentPage;
            document.getElementById('monitorLogTotalPagesInfo').textContent = monitorLogTotalPages;
            document.getElementById('monitorLogTotalCount').textContent = monitorLogTotalCount;
            document.getElementById('monitorLogFirstBtn').disabled = monitorLogCurrentPage <= 1;
            document.getElementById('monitorLogPrevBtn').disabled = monitorLogCurrentPage <= 1;
            document.getElementById('monitorLogNextBtn').disabled = monitorLogCurrentPage >= monitorLogTotalPages;
            document.getElementById('monitorLogLastBtn').disabled = monitorLogCurrentPage >= monitorLogTotalPages;
        };

        const loadMonitorLogs = async (page = 1) => {
            monitorLogCurrentPage = Math.max(1, page);
            const logsRes = await api('/admin/monitor/logs?page=' + monitorLogCurrentPage + '&pageSize=' + monitorLogPageSize);
            if (!logsRes?.success) return;
            monitorLogTotalPages = logsRes.totalPages || 1;
            monitorLogTotalCount = logsRes.total || 0;
            if (monitorLogCurrentPage > monitorLogTotalPages) {
                return loadMonitorLogs(monitorLogTotalPages);
            }
            const tbody = document.getElementById('monitorLogsList');
            if (!logsRes.data || logsRes.data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3" class="empty-state"><div class="empty-state-icon">${icon('bell')}</div><div class="empty-state-text">暂无监测记录</div></td></tr>';
            } else {
                tbody.innerHTML = logsRes.data.map(log => {
                    let typeText = '', typeClass = '';
                    switch(log.type) {
                        case 'check_complete': typeText = '检查完成'; typeClass = 'badge-success'; break;
                        case 'check_error': typeText = '检查错误'; typeClass = 'badge-error'; break;
                        case 'cookie_invalid': typeText = 'Cookie失效'; typeClass = 'badge-error'; break;
                        case 'vip_lost': typeText = 'VIP丢失'; typeClass = 'badge-warning'; break;
                        case 'vip_unavailable': typeText = '无VIP'; typeClass = 'badge-warning'; break;
                        case 'webhook_sent': typeText = '通知发送'; typeClass = log.success ? 'badge-success' : 'badge-error'; break;
                        case 'webhook_error': typeText = '通知失败'; typeClass = 'badge-error'; break;
                        default: typeText = log.type; typeClass = 'badge-info';
                    }
                    let details = '';
                    if (log.type === 'check_complete') details = '检查了 ' + log.totalChecked + ' 个Cookie';
                    else if (log.type === 'cookie_invalid') details = log.platformName + ': ' + (log.note || log.cookieId) + ' - ' + log.reason;
                    else if (log.type === 'vip_lost') details = log.platformName + ': ' + (log.note || log.cookieId) + ' - ' + log.reason;
                    else if (log.type === 'vip_unavailable') details = log.platformName + ': ' + (log.note || log.cookieId) + ' - ' + log.reason;
                    else if (log.type === 'webhook_sent') details = '状态码: ' + log.statusCode;
                    else if (log.error) details = log.error;
                    return '<tr><td>' + escapeHtml(formatDate(log.timestamp)) + '</td><td><span class="badge ' + typeClass + '">' + escapeHtml(typeText) + '</span></td><td><div class="cell-clip" title="' + escapeHtml(details) + '">' + escapeHtml(details || '-') + '</div></td></tr>';
                }).join('');
            }
            updateMonitorLogPagination();
        };

        const loadMonitor = async () => {
            const [statusRes, configRes, webhookRes, smtpRes] = await Promise.all([
                api('/admin/monitor/status'),
                api('/admin/monitor'),
                api('/admin/webhook'),
                api('/admin/smtp')
            ]);
            if (statusRes?.success) {
                const status = statusRes.data;
                document.getElementById('monitorStatus').textContent = status.isRunning ? '运行中' : '已停止';
                document.getElementById('monitorStatus').style.color = status.isRunning ? 'var(--success)' : 'var(--danger)';
                document.getElementById('monitorCheckCount').textContent = status.checkCount || 0;
                document.getElementById('monitorLastCheck').textContent = status.lastCheckTime ? formatDate(status.lastCheckTime) : '-';
            }
            if (configRes?.success) {
                document.getElementById('monitorEnabled').checked = configRes.data.enabled;
                document.getElementById('monitorInterval').textContent = configRes.data.interval;
                document.getElementById('monitorIntervalInput').value = configRes.data.interval;
            }
            if (webhookRes?.success) {
                document.getElementById('webhookEnabled').checked = webhookRes.data.enabled;
                document.getElementById('webhookUrl').value = webhookRes.data.url || '';
                if (webhookRes.data.contentType) {
                    document.getElementById('webhookContentType').value = webhookRes.data.contentType;
                }
                if (webhookRes.data.headers && Object.keys(webhookRes.data.headers).length > 0) {
                    document.getElementById('webhookHeaders').value = JSON.stringify(webhookRes.data.headers, null, 2);
                }
                if (webhookRes.data.bodyTemplate) {
                    document.getElementById('webhookBodyTemplate').value = webhookRes.data.bodyTemplate;
                }
            }
            if (smtpRes?.success) {
                document.getElementById('smtpEnabled').checked = smtpRes.data.enabled;
                document.getElementById('smtpHost').value = smtpRes.data.host || '';
                document.getElementById('smtpPort').value = smtpRes.data.port || 465;
                document.getElementById('smtpSecure').checked = smtpRes.data.secure !== false;
                document.getElementById('smtpFrom').value = smtpRes.data.from || '';
                document.getElementById('smtpUser').value = smtpRes.data.user || '';
                document.getElementById('smtpPass').value = smtpRes.data.pass || '';
                document.getElementById('smtpTo').value = smtpRes.data.to || '';
            }
            await loadMonitorLogs(1);
        };

        const checkNow = async () => {
            showToast('正在检查Cookie...', 'success');
            const res = await api('/admin/monitor/check', { method: 'POST' });
            if (res?.success) { showToast('检查完成'); loadMonitor(); }
            else showToast(res?.error || '检查失败', 'error');
        };

        const testWebhook = async () => {
            showToast('正在发送测试消息...', 'success');
            const res = await api('/admin/webhook/test', { method: 'POST' });
            if (res?.success) showToast('测试消息已发送');
            else showToast(res?.error || '发送失败', 'error');
        };

        const testSmtp = async () => {
            showToast('正在发送测试邮件...', 'success');
            const res = await api('/admin/smtp/test', { method: 'POST' });
            if (res?.success) showToast('测试邮件已发送,请检查收件箱');
            else showToast(res?.error || '发送失败', 'error');
        };

        const showAddCookieModal = () => {
            document.getElementById('cookieModalTitle').textContent = '添加 Cookie';
            document.getElementById('cookieForm').reset();
            document.getElementById('cookieId').value = '';
            document.getElementById('cookieActive').checked = true;
            document.getElementById('skipValidation').checked = false;
            document.getElementById('cookieSubmitBtn').disabled = false;
            document.getElementById('cookieSubmitBtn').textContent = '保存并验证';
            document.getElementById('cookieHelpContent').classList.remove('show');
            document.getElementById('cookieModal').classList.add('show');
        };

        let qrLoginTimer = null;
        let qrLoginSessionId = null;
        let qrLoginPolling = false;
        let qrLoginDeadline = 0;

        const stopQrLoginPolling = () => {
            if (qrLoginTimer) { clearInterval(qrLoginTimer); qrLoginTimer = null; }
        };

        const setQrLoginStatus = (text, color) => {
            const el = document.getElementById('qrLoginStatus');
            if (!el) return;
            el.textContent = text;
            el.style.color = color || 'var(--text-secondary)';
        };

        const closeQrLogin = () => {
            stopQrLoginPolling();
            const sid = qrLoginSessionId;
            qrLoginSessionId = null;
            if (sid) api('/admin/cookies/qr/netease/cancel', { method: 'POST', body: JSON.stringify({ sessionId: sid }) }).catch(() => {});
            closeModal('qrLoginModal');
        };

        const openQrLogin = async () => {
            if (!QR_LOGIN_ENABLED) return;
            document.getElementById('qrLoginModal').classList.add('show');
            document.getElementById('qrLoginImage').style.display = 'none';
            document.getElementById('qrLoginPlaceholder').style.display = 'flex';
            document.getElementById('qrLoginRefreshBtn').disabled = true;
            setQrLoginStatus('正在生成二维码…');
            const res = await api('/admin/cookies/qr/netease/create', { method: 'POST' });
            document.getElementById('qrLoginRefreshBtn').disabled = false;
            if (!res?.success) {
                setQrLoginStatus(res?.error || '生成二维码失败，请重试', 'var(--danger)');
                return;
            }
            qrLoginSessionId = res.data.sessionId;
            qrLoginDeadline = Date.now() + (res.data.expiresIn || 180) * 1000;
            document.getElementById('qrLoginImage').src = res.data.qrDataUrl;
            document.getElementById('qrLoginImage').style.display = 'block';
            document.getElementById('qrLoginPlaceholder').style.display = 'none';
            setQrLoginStatus('等待扫码…');
            document.getElementById('qrLoginDebug').textContent = '';
            stopQrLoginPolling();
            qrLoginTimer = setInterval(pollQrLogin, 2000);
        };

        const refreshQrLogin = async () => {
            const sid = qrLoginSessionId;
            stopQrLoginPolling();
            qrLoginSessionId = null;
            if (sid) await api('/admin/cookies/qr/netease/cancel', { method: 'POST', body: JSON.stringify({ sessionId: sid }) }).catch(() => {});
            await openQrLogin();
        };

        const remainingText = () => {
            const left = Math.max(0, Math.ceil((qrLoginDeadline - Date.now()) / 1000));
            return Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0');
        };

        const pollQrLogin = async () => {
            if (!qrLoginSessionId || qrLoginPolling) return;
            qrLoginPolling = true;
            try {
                const res = await api('/admin/cookies/qr/netease/check', { method: 'POST', body: JSON.stringify({ sessionId: qrLoginSessionId }) });
                if (!res?.success) { setQrLoginStatus(res?.error || '查询失败，稍后自动重试', 'var(--danger)'); return; }
                const status = res.data.status;
                const code = res.data.code;
                const debugEl = document.getElementById('qrLoginDebug');
                if (debugEl) debugEl.textContent = code ? ('上游状态码 ' + code) : '';
                if (status === 'waiting') {
                    setQrLoginStatus('等待扫码…（剩余 ' + remainingText() + '）');
                } else if (status === 'scanned') {
                    setQrLoginStatus('已扫码，请在手机上确认登录', 'var(--primary)');
                } else if (status === 'expired') {
                    stopQrLoginPolling(); qrLoginSessionId = null;
                    setQrLoginStatus('二维码已过期，请点击「刷新二维码」', 'var(--danger)');
                } else if (status === 'failed') {
                    stopQrLoginPolling(); qrLoginSessionId = null;
                    setQrLoginStatus(res.data.error || '登录失败，请重试', 'var(--danger)');
                } else if (status === 'confirmed') {
                    stopQrLoginPolling(); qrLoginSessionId = null;
                    const info = res.data.userInfo || {};
                    let msg = '已添加：' + (info.nickname || '网易云账号');
                    if (info.canPlayVip !== undefined) msg += info.canPlayVip ? ' · 可播放 VIP' : ' · 不可播放 VIP';
                    setQrLoginStatus('登录成功，Cookie 已保存', 'var(--success)');
                    showToast(msg, 'success');
                    loadCookies();
                    loadDashboard();
                    setTimeout(() => closeModal('qrLoginModal'), 800);
                }
            } finally {
                qrLoginPolling = false;
            }
        };

        const editCookie = async (id) => {
            const res = await api('/admin/cookies/' + id);
            if (!res?.success) return;
            document.getElementById('cookieModalTitle').textContent = '编辑Cookie';
            document.getElementById('cookieId').value = res.data.id;
            document.getElementById('cookiePlatform').value = res.data.platform;
            document.getElementById('cookieNote').value = res.data.note || '';
            document.getElementById('cookieActive').checked = res.data.isActive;
            document.getElementById('skipValidation').checked = false;
            document.getElementById('cookieSubmitBtn').disabled = false;
            document.getElementById('cookieSubmitBtn').textContent = '保存';
            document.getElementById('cookieHelpContent').classList.remove('show');
            document.getElementById('cookieModal').classList.add('show');
        };

        const toggleCookieActive = async (id, isActive) => {
            const res = await api('/admin/cookies/' + id, {
                method: 'PUT',
                body: JSON.stringify({ isActive }),
            });
            if (res?.success) {
                showToast(isActive ? 'Cookie 已启用' : 'Cookie 已禁用');
                loadCookies();
                loadDashboard();
            } else {
                showToast(res?.error || '操作失败', 'error');
                loadCookies();
            }
        };

        const verifyCookie = async (id) => {
            showToast('正在验证Cookie...', 'success');
            const res = await api('/admin/cookies/' + id + '/verify', { method: 'POST' });
            if (res?.success) {
                if (res.data.isValid) {
                    let msg = 'Cookie验证有效';
                    if (res.data.userInfo?.canPlayVip !== undefined) msg += res.data.userInfo.canPlayVip ? ' - 可播放VIP音乐' : ' - 不可播放VIP音乐';
                    showToast(msg, 'success');
                } else showToast('Cookie验证失败: ' + (res.data.validationError || '无效'), 'error');
                loadCookies(); loadDashboard();
            } else showToast(res?.error || '验证失败', 'error');
        };

        const deleteCookie = async (id) => {
            if (!confirm('确定要删除这个Cookie吗？')) return;
            const res = await api('/admin/cookies/' + id, { method: 'DELETE' });
            if (res?.success) { showToast('Cookie已删除'); loadCookies(); loadDashboard(); }
            else showToast(res?.error || '删除失败', 'error');
        };

        const showAddUserModal = () => {
            document.getElementById('userModalTitle').textContent = '添加用户';
            document.getElementById('userForm').reset();
            document.getElementById('editUsername').value = '';
            document.getElementById('userUsername').disabled = false;
            document.getElementById('passwordGroup').style.display = 'block';
            document.getElementById('userPassword').required = true;
            document.getElementById('userModal').classList.add('show');
        };

        const editUser = (username) => {
            document.getElementById('userModalTitle').textContent = '编辑用户';
            document.getElementById('editUsername').value = username;
            document.getElementById('userUsername').value = username;
            document.getElementById('userUsername').disabled = true;
            document.getElementById('passwordGroup').style.display = 'block';
            document.getElementById('userPassword').required = false;
            document.getElementById('userPassword').placeholder = '留空则不修改密码';
            document.getElementById('userModal').classList.add('show');
        };

        const deleteUser = async (username) => {
            if (!confirm('确定要删除用户 ' + username + ' 吗？')) return;
            const res = await api('/admin/users/' + username, { method: 'DELETE' });
            if (res?.success) { showToast('用户已删除'); loadUsers(); }
            else showToast(res?.error || '删除失败', 'error');
        };

        const closeModal = (id) => {
            document.getElementById(id).classList.remove('show');
        };

        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('loginUsername').value;
            const password = document.getElementById('loginPassword').value;
            const res = await api('/admin/login', { method: 'POST', body: JSON.stringify({ username, password }) });
            if (res?.require2FA) {
                document.getElementById('loginBox').style.display = 'none';
                document.getElementById('twoFactorBox').style.display = 'block';
                document.getElementById('twoFactorUsername').value = username;
                document.getElementById('twoFactorCode').value = '';
                document.getElementById('twoFactorError').textContent = '';
                document.getElementById('twoFactorCode').focus();
            } else if (res?.success) {
                authToken = res.data.token; authUsername = res.data.username;
                localStorage.setItem('authToken', authToken); localStorage.setItem('authUsername', authUsername);
                showAdmin();
            } else document.getElementById('loginError').textContent = res?.error || '登录失败';
        });

        document.getElementById('twoFactorForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('twoFactorUsername').value;
            const code = document.getElementById('twoFactorCode').value.trim();
            if (!code) { document.getElementById('twoFactorError').textContent = '请输入验证码'; return; }
            const res = await api('/admin/login', { method: 'POST', body: JSON.stringify({ username, password: document.getElementById('loginPassword').value, code }) });
            if (res?.success) {
                authToken = res.data.token; authUsername = res.data.username;
                localStorage.setItem('authToken', authToken); localStorage.setItem('authUsername', authUsername);
                showAdmin();
            } else document.getElementById('twoFactorError').textContent = res?.error || '验证失败';
        });

        const cancel2FA = () => {
            document.getElementById('loginBox').style.display = 'block';
            document.getElementById('twoFactorBox').style.display = 'none';
            document.getElementById('twoFactorError').textContent = '';
        };

        document.getElementById('cookieForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('cookieId').value;
            const skipValidation = document.getElementById('skipValidation').checked;
            const data = { platform: document.getElementById('cookiePlatform').value, cookie: document.getElementById('cookieData').value, note: document.getElementById('cookieNote').value, isActive: document.getElementById('cookieActive').checked, skipValidation };
            const submitBtn = document.getElementById('cookieSubmitBtn');
            submitBtn.disabled = true; submitBtn.innerHTML = '<span class="loading"></span> 验证中...';
            let res;
            if (id) res = await api('/admin/cookies/' + id, { method: 'PUT', body: JSON.stringify(data) });
            else res = await api('/admin/cookies', { method: 'POST', body: JSON.stringify(data) });
            submitBtn.disabled = false; submitBtn.textContent = id ? '保存' : '保存并验证';
            if (res?.success) {
                let msg = 'Cookie已保存';
                if (!skipValidation && res.data?.userInfo?.canPlayVip !== undefined) msg += res.data.userInfo.canPlayVip ? ' - 可播放VIP音乐' : ' - 不可播放VIP音乐';
                showToast(msg, 'success'); closeModal('cookieModal'); loadCookies(); loadDashboard();
            } else showToast(res?.error || '保存失败', 'error');
        });

        document.getElementById('userForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const editUsername = document.getElementById('editUsername').value;
            const data = { username: document.getElementById('userUsername').value, password: document.getElementById('userPassword').value, role: document.getElementById('userRole').value };
            let res;
            if (editUsername) res = await api('/admin/users/' + editUsername, { method: 'PUT', body: JSON.stringify(data) });
            else res = await api('/admin/users', { method: 'POST', body: JSON.stringify(data) });
            if (res?.success) { showToast('用户已保存'); closeModal('userModal'); loadUsers(); }
            else showToast(res?.error || '保存失败', 'error');
        });

        document.getElementById('profileForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const newUsername = document.getElementById('newUsername').value.trim();
            if (!newUsername) { showToast('请输入新用户名', 'error'); return; }
            if (newUsername === authUsername) { showToast('新用户名与当前用户名相同', 'error'); return; }
            const res = await api('/admin/profile', { method: 'PUT', body: JSON.stringify({ newUsername }) });
            if (res?.success) {
                authUsername = newUsername; localStorage.setItem('authUsername', newUsername);
                document.getElementById('currentUser').textContent = newUsername;
                document.getElementById('currentUsernameDisplay').value = newUsername;
                document.getElementById('newUsername').value = ''; showToast('用户名已修改');
            } else showToast(res?.error || '修改失败', 'error');
        });

        document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const oldPassword = document.getElementById('oldPassword').value;
            const newPassword = document.getElementById('newPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            if (newPassword !== confirmPassword) { showToast('两次输入的密码不一致', 'error'); return; }
            const res = await api('/admin/password', { method: 'PUT', body: JSON.stringify({ oldPassword, newPassword }) });
            if (res?.success) { showToast('密码已修改'); document.getElementById('changePasswordForm').reset(); }
            else showToast(res?.error || '修改失败', 'error');
        });

        document.getElementById('adminPathForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const adminPath = document.getElementById('adminPathInput').value.trim();
            if (!adminPath) { showToast('请输入管理后台路径', 'error'); return; }
            const res = await api('/admin/config/admin-path', { method: 'PUT', body: JSON.stringify({ adminPath }) });
            if (res?.success) showToast('管理后台路径已保存，重启服务后生效');
            else showToast(res?.error || '保存失败', 'error');
        });

        document.getElementById('cacheForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const enabled = document.getElementById('cacheEnabled').checked;
            const maxEntries = parseInt(document.getElementById('cacheMaxEntries').value, 10);
            if (!Number.isInteger(maxEntries) || maxEntries < 50 || maxEntries > 100000) {
                showToast('最大缓存条目需为 50~100000 之间的整数', 'error');
                return;
            }
            const ttlByType = {};
            let invalidType = '';
            document.querySelectorAll('[data-cache-ttl]').forEach((input) => {
                const type = input.dataset.cacheTtl;
                const minutes = parseInt(input.value, 10);
                if (!Number.isInteger(minutes) || minutes < 1 || minutes > 10080) invalidType = type;
                else ttlByType[type] = minutes;
            });
            if (invalidType) {
                showToast('TTL 需为 1~10080 分钟之间的整数', 'error');
                return;
            }
            const res = await api('/admin/cache', {
                method: 'PUT',
                body: JSON.stringify({ enabled, maxEntries, ttlByType }),
            });
            if (res?.success) {
                renderCacheStats(res.data);
                loadCacheConfig();
                showToast('缓存配置已保存');
            } else {
                showToast(res?.error || '保存失败', 'error');
            }
        });

        document.getElementById('geoForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const key = document.getElementById('geoApiKey').value.trim();
            const body = { enabled: document.getElementById('geoEnabled').checked };
            if (key) body.key = key;
            const res = await api('/admin/geo', { method: 'PUT', body: JSON.stringify(body) });
            if (res?.success) {
                showToast('IP 归属地配置已保存');
                loadGeoConfig();
            } else {
                showToast(res?.error || '保存失败', 'error');
            }
        });

        document.getElementById('loginBgForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const enabled = document.getElementById('loginBgEnabled').checked;
            const apiUrl = document.getElementById('loginBgApiUrl').value.trim();
            const ttlHours = parseInt(document.getElementById('loginBgTtlHours').value, 10);
            if (!apiUrl) { showToast('请填写图片接口地址', 'error'); return; }
            if (!Number.isInteger(ttlHours) || ttlHours < 1 || ttlHours > 168) {
                showToast('缓存有效期需为 1~168 小时', 'error');
                return;
            }
            const submitBtn = e.currentTarget.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.disabled = true;
            try {
                const res = await api('/admin/login-bg/settings', {
                    method: 'PUT',
                    body: JSON.stringify({ enabled, apiUrl, ttlHours }),
                });
                if (!res?.success) {
                    showToast(res?.error || '保存失败', 'error');
                    return;
                }
                renderLoginBgPreview(res.data);
                showToast('登录页背景设置已保存');
                // 首次启用或刚换了接口：立刻抓一张，省得第一次打开登录页空着
                if (enabled && !res.data?.cache?.fetchedAt) await doRefreshLoginBg(true);
            } finally {
                if (submitBtn) submitBtn.disabled = false;
            }
        });

        const fillMyIp = async (silent) => {
            const quiet = silent === true;
            const res = await api('/admin/geo/client-ip');
            if (res?.success && res.data?.ip && res.data.ip !== 'unknown') {
                const input = document.getElementById('geoTestIp');
                if (input) input.value = res.data.ip;
                if (!quiet) showToast('已填入当前 IP：' + res.data.ip);
                return res.data.ip;
            }
            if (!quiet) showToast('获取当前 IP 失败，请手动填写', 'error');
            return '';
        };

        const renderGeoResult = (d) => {
            const box = document.getElementById('geoTestResult');
            if (!box) return;
            const input = document.getElementById('geoTestIp');
            const fields = [
                ['IP', d.ip || (input ? input.value.trim() : '')],
                ['国家 / 地区', [d.country, d.countryCode ? '(' + d.countryCode + ')' : ''].filter(Boolean).join(' ')],
                ['省 / 市 / 区', [d.region, d.city, d.county].filter(Boolean).join(' · ')],
                ['运营商', d.isp],
                ['大洲', d.continents],
                ['城市编码', d.cityCode],
                ['经纬度', [d.lat, d.lng].filter(Boolean).join(', ')],
                ['英文名', d.enName ? d.enName + (d.enNameShort ? ' (' + d.enNameShort + ')' : '') : ''],
                ['备注', d.remark],
            ].filter(([, value]) => value);
            box.innerHTML = '<div class="geo-result-grid">'
                + fields.map(([label, value]) => '<div class="geo-result-item"><span>' + escapeHtml(label) + '</span><b>' + escapeHtml(value) + '</b></div>').join('')
                + '</div><details><summary>原始字段</summary><pre>' + escapeHtml(JSON.stringify(d, null, 2)) + '</pre></details>';
            box.style.display = '';
        };

        const testGeoApi = async () => {
            const input = document.getElementById('geoTestIp');
            const ip = input ? input.value.trim() : '';
            const key = document.getElementById('geoApiKey').value.trim();
            const status = document.getElementById('geoTestStatus');
            const box = document.getElementById('geoTestResult');
            if (status) status.textContent = '正在查询 ' + (ip || '当前 IP') + ' …';
            if (box) box.style.display = 'none';
            const body = {};
            if (ip) body.ip = ip;
            if (key) body.key = key;
            const res = await api('/admin/geo/test', {
                method: 'POST',
                body: JSON.stringify(body),
            });
            if (res?.success) {
                const d = res.data || {};
                if (d.ip && input) input.value = d.ip;
                renderGeoResult(d);
                if (status) {
                    const label = [d.region, d.city, d.county].filter(Boolean).join(' · ') || d.country || d.countryCode || '未知';
                    status.textContent = '查询成功：' + (d.ip || ip) + ' → ' + label;
                }
                showToast('查询成功');
            } else {
                if (status) status.textContent = '查询失败：' + (res?.error || '未知错误');
                showToast(res?.error || '查询失败', 'error');
            }
        };

        const clearGeoCacheConfirm = async () => {
            if (!confirm('确定清空本地 IP 归属地缓存？')) return;
            const res = await api('/admin/geo/cache/clear', { method: 'POST' });
            if (res?.success) {
                showToast('IP 缓存已清空');
                loadGeoConfig();
            } else {
                showToast(res?.error || '清空失败', 'error');
            }
        };

        document.getElementById('monitorForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const enabled = document.getElementById('monitorEnabled').checked;
            const interval = parseInt(document.getElementById('monitorIntervalInput').value);
            const res = await api('/admin/monitor', { method: 'PUT', body: JSON.stringify({ enabled, interval }) });
            if (res?.success) { showToast('监测设置已保存'); loadMonitor(); }
            else showToast(res?.error || '保存失败', 'error');
        });

        document.getElementById('webhookForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const enabled = document.getElementById('webhookEnabled').checked;
            const url = document.getElementById('webhookUrl').value.trim();
            const contentType = document.getElementById('webhookContentType').value;
            const headersStr = document.getElementById('webhookHeaders').value.trim();
            const bodyTemplateStr = document.getElementById('webhookBodyTemplate').value.trim();
            let headers = {};
            if (headersStr) { try { headers = JSON.parse(headersStr); } catch { showToast('Headers JSON格式无效', 'error'); return; } }
            const res = await api('/admin/webhook', { method: 'PUT', body: JSON.stringify({ enabled, url, contentType, headers, bodyTemplate: bodyTemplateStr || undefined }) });
            if (res?.success) showToast('Webhook设置已保存');
            else showToast(res?.error || '保存失败', 'error');
        });

        document.getElementById('smtpForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                enabled: document.getElementById('smtpEnabled').checked,
                host: document.getElementById('smtpHost').value.trim(),
                port: parseInt(document.getElementById('smtpPort').value) || 465,
                secure: document.getElementById('smtpSecure').checked,
                from: document.getElementById('smtpFrom').value.trim(),
                user: document.getElementById('smtpUser').value.trim(),
                pass: document.getElementById('smtpPass').value.trim(),
                to: document.getElementById('smtpTo').value.trim()
            };
            const res = await api('/admin/smtp', { method: 'PUT', body: JSON.stringify(data) });
            if (res?.success) showToast('SMTP设置已保存');
            else showToast(res?.error || '保存失败', 'error');
        });

        let twoFASetupData = null;
        let twoFASetupStep = 1;

        const load2FAStatus = async () => {
            const res = await api('/admin/2fa/status');
            if (res?.success) {
                if (res.data.enabled) {
                    document.getElementById('twoFactorDisabled').style.display = 'none';
                    document.getElementById('twoFactorEnabled').style.display = 'block';
                } else {
                    document.getElementById('twoFactorDisabled').style.display = 'block';
                    document.getElementById('twoFactorEnabled').style.display = 'none';
                }
            }
        };

        const startSetup2FA = async () => {
            const res = await api('/admin/2fa/setup', { method: 'POST' });
            if (!res?.success) { showToast(res?.error || '获取2FA设置失败', 'error'); return; }
            twoFASetupData = res.data;
            twoFASetupStep = 1;
            document.getElementById('twoFactorStep1').style.display = 'block';
            document.getElementById('twoFactorStep2').style.display = 'none';
            document.getElementById('twoFactorStep3').style.display = 'none';
            document.getElementById('twoFactorSetupBack').style.display = 'none';
            document.getElementById('twoFactorSetupNext').style.display = 'inline-flex';
            document.getElementById('twoFactorSetupNext').textContent = '下一步';
            document.getElementById('twoFactorSetupFinish').style.display = 'none';
            document.getElementById('twoFactorSecretDisplay').value = twoFASetupData.secret;
            generateQRCode(twoFASetupData.otpAuthUrl);
            document.getElementById('twoFactorSetupModal').classList.add('show');
        };

        const generateQRCode = (text) => {
            const container = document.getElementById('qrcodeContainer');
            container.innerHTML = '';
            const img = document.createElement('img');
            img.alt = '2FA QR Code';
            img.style.cssText = 'width:200px;height:200px;display:block;margin:0 auto;';
            if (twoFASetupData && twoFASetupData.qrDataUrl) {
                img.src = twoFASetupData.qrDataUrl;
                container.appendChild(img);
            } else {
                const fallback = document.createElement('div');
                fallback.style.cssText = 'padding:16px;text-align:center;color:var(--text-secondary);font-size:13px;';
                fallback.textContent = '二维码加载失败，请使用下方密钥手动输入';
                container.appendChild(fallback);
            }
        };

        const twoFactorSetupGoNext = async () => {
            if (twoFASetupStep === 1) {
                twoFASetupStep = 2;
                document.getElementById('twoFactorStep1').style.display = 'none';
                document.getElementById('twoFactorStep2').style.display = 'block';
                document.getElementById('twoFactorSetupBack').style.display = 'inline-flex';
                document.getElementById('twoFactorSetupNext').textContent = '验证';
                document.getElementById('twoFactorSetupCode').value = '';
                document.getElementById('twoFactorSetupError').textContent = '';
                document.getElementById('twoFactorSetupCode').focus();
            } else if (twoFASetupStep === 2) {
                const code = document.getElementById('twoFactorSetupCode').value.trim();
                if (!code) { document.getElementById('twoFactorSetupError').textContent = '请输入验证码'; return; }
                const res = await api('/admin/2fa/enable', { method: 'POST', body: JSON.stringify({ code }) });
                if (res?.success) {
                    twoFASetupStep = 3;
                    document.getElementById('twoFactorStep2').style.display = 'none';
                    document.getElementById('twoFactorStep3').style.display = 'block';
                    document.getElementById('twoFactorSetupBack').style.display = 'none';
                    document.getElementById('twoFactorSetupNext').style.display = 'none';
                    document.getElementById('twoFactorSetupFinish').style.display = 'inline-flex';
                    load2FAStatus();
                } else {
                    document.getElementById('twoFactorSetupError').textContent = res?.error || '验证码错误';
                }
            }
        };

        const twoFactorSetupGoBack = () => {
            if (twoFASetupStep === 2) {
                twoFASetupStep = 1;
                document.getElementById('twoFactorStep1').style.display = 'block';
                document.getElementById('twoFactorStep2').style.display = 'none';
                document.getElementById('twoFactorSetupBack').style.display = 'none';
                document.getElementById('twoFactorSetupNext').textContent = '下一步';
            }
        };

        document.getElementById('twoFactorSetupForm').addEventListener('submit', (e) => {
            e.preventDefault();
            twoFactorSetupGoNext();
        });

        const copy2FASecret = () => {
            const secret = document.getElementById('twoFactorSecretDisplay').value;
            navigator.clipboard.writeText(secret).then(() => showToast('密钥已复制'));
        };

        const showDisable2FAModal = () => {
            document.getElementById('disable2FAPassword').value = '';
            document.getElementById('disable2FAError').textContent = '';
            document.getElementById('twoFactorDisableModal').classList.add('show');
        };

        document.getElementById('twoFactorDisableForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const password = document.getElementById('disable2FAPassword').value;
            if (!password) { document.getElementById('disable2FAError').textContent = '请输入密码'; return; }
            const res = await api('/admin/2fa/disable', { method: 'POST', body: JSON.stringify({ password }) });
            if (res?.success) {
                showToast('双因素认证已禁用');
                closeModal('twoFactorDisableModal');
                load2FAStatus();
            } else {
                document.getElementById('disable2FAError').textContent = res?.error || '操作失败';
            }
        });

        // ---------- 可折叠导航 ----------
        const navToggle = document.getElementById('navToggle');
        const navToggleMobile = document.getElementById('navToggleMobile');
        const navBackdrop = document.getElementById('navBackdrop');
        const mobileNavQuery = window.matchMedia('(max-width: 768px)');
        const isMobileNav = () => mobileNavQuery.matches;

        const syncNavUi = () => {
            const mobile = isMobileNav();
            if (mobile) {
                document.body.classList.remove('nav-collapsed');
                const open = document.body.classList.contains('nav-open');
                const label = open ? '关闭导航' : '打开导航';
                navToggleMobile?.setAttribute('aria-expanded', open ? 'true' : 'false');
                navToggleMobile?.setAttribute('aria-label', label);
                if (navToggleMobile) navToggleMobile.title = label;
            } else {
                document.body.classList.remove('nav-open');
                const collapsed = document.body.classList.contains('nav-collapsed');
                const label = collapsed ? '展开导航' : '收起导航';
                navToggle?.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
                navToggle?.setAttribute('aria-label', label);
                if (navToggle) navToggle.title = label;
            }
        };

        const closeMobileNav = () => {
            document.body.classList.remove('nav-open');
            syncNavUi();
        };

        if (!isMobileNav() && localStorage.getItem('adminNavCollapsed') === '1') {
            document.body.classList.add('nav-collapsed');
        }

        document.querySelectorAll('.sidebar-menu li').forEach(li => {
            const label = li.querySelector('.menu-text')?.textContent?.trim() || '';
            if (label) li.title = label;
            li.setAttribute('aria-label', label || li.dataset.section || '');
            li.addEventListener('click', () => {
                switchSection(li.dataset.section);
                closeMobileNav();
            });
        });

        navToggle?.addEventListener('click', () => {
            if (isMobileNav()) return;
            const collapsed = document.body.classList.toggle('nav-collapsed');
            localStorage.setItem('adminNavCollapsed', collapsed ? '1' : '0');
            syncNavUi();
        });
        navToggleMobile?.addEventListener('click', () => {
            if (!isMobileNav()) return;
            document.body.classList.toggle('nav-open');
            syncNavUi();
        });
        navBackdrop.addEventListener('click', closeMobileNav);
        document.getElementById('navClose')?.addEventListener('click', closeMobileNav);
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeMobileNav();
        });
        mobileNavQuery.addEventListener('change', () => {
            if (isMobileNav()) {
                document.body.classList.remove('nav-collapsed');
            } else {
                document.body.classList.remove('nav-open');
                if (localStorage.getItem('adminNavCollapsed') === '1') {
                    document.body.classList.add('nav-collapsed');
                }
            }
            syncNavUi();
        });
        syncNavUi();

        if (authToken && authUsername) {
            const authTimer = setTimeout(() => {
                if (document.body.classList.contains('auth-pending')) showLogin();
            }, 5000);
            api('/admin/check')
                .then(res => {
                    clearTimeout(authTimer);
                    if (res?.success) showAdmin();
                    else showLogin();
                })
                .catch(() => {
                    clearTimeout(authTimer);
                    showLogin();
                });
        } else showLogin();
    </script>
</body>
</html>`
}

export const adminPageHandler = (c) => {
    // 后台路径本身是隐藏的：不在 robots.txt 里声明，改用响应头告诉爬虫不要收录
    c.header('X-Robots-Tag', 'noindex, nofollow')
    // 页面结构会随版本频繁变化，禁止浏览器缓存旧 HTML，避免改了样式仍看到旧卡片
    c.header('Cache-Control', 'no-store, no-cache, must-revalidate')
    c.header('Pragma', 'no-cache')
    return c.html(getAdminHtml({ loginBg: store.getLoginBgConfig() }))
}