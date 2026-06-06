import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api } from '../api';
import { Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\-\/\\+\*@#_]).{8,}$/;

export default function ResetPasswordPage() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const navigate = useNavigate();
    const { t } = useTranslation();
    const passwordRequirements = t('resetPassword.passwordRequirements');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!token) {
            setError(t('resetPassword.missingToken'));
            return;
        }

        if (!PASSWORD_REGEX.test(password)) {
            setError(passwordRequirements);
            return;
        }

        if (password !== confirmPassword) {
            setError(t('resetPassword.passwordMismatch'));
            return;
        }

        setLoading(true);
        try {
            await api.resetPassword(token, password);
            setSuccess(true);
            setTimeout(() => {
                navigate('/login');
            }, 3000);
        } catch (err: any) {
            if (err.errorCode === 'ERR_PASSWORD_INVALID_FORMAT') {
                setError(passwordRequirements);
            } else {
                setError(err.message || t('resetPassword.invalidOrExpired'));
            }
        } finally {
            setLoading(false);
        }
    };

    if (!token) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
                <div style={{ textAlign: 'center', padding: '2rem', background: 'var(--card-bg)', borderRadius: '1rem' }}>
                    <h2 style={{ color: '#c33', marginBottom: '1rem' }}>{t('resetPassword.invalidLinkTitle')}</h2>
                    <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>{t('resetPassword.invalidLinkText')}</p>
                    <Link to="/forgot-password" style={{ color: 'var(--primary)', fontWeight: '600', textDecoration: 'none' }}>{t('resetPassword.requestNewLink')}</Link>
                </div>
            </div>
        );
    }

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg)',
        }}>
            <div style={{
                width: '100%',
                maxWidth: '400px',
                padding: '2rem',
            }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                        {t('resetPassword.title')}
                    </h1>
                    <p style={{ color: 'var(--text-secondary)' }}>{t('resetPassword.subtitle')}</p>
                </div>

                <div style={{
                    background: 'var(--card-bg)',
                    borderRadius: '1rem',
                    padding: '2rem',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                }}>
                    {success ? (
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ padding: '1rem', background: '#efe', color: '#2a5', borderRadius: '0.5rem', marginBottom: '1.5rem' }}>
                                {t('resetPassword.success')}
                            </div>
                            <p style={{ color: 'var(--text-secondary)' }}>{t('resetPassword.redirecting')}</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit}>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>{t('resetPassword.newPassword')}</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder={t('resetPassword.newPasswordPlaceholder')}
                                        required
                                        autoComplete="new-password"
                                        style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--border)', borderRadius: '0.5rem', fontSize: '1rem', background: 'var(--bg)', color: 'var(--text)', paddingRight: '2.5rem' }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                                    >
                                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                    </button>
                                </div>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem', lineHeight: '1.4' }}>
                                    {passwordRequirements}
                                </p>
                            </div>

                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>{t('resetPassword.confirmPassword')}</label>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder={t('resetPassword.confirmPasswordPlaceholder')}
                                    required
                                    autoComplete="new-password"
                                    style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--border)', borderRadius: '0.5rem', fontSize: '1rem', background: 'var(--bg)', color: 'var(--text)' }}
                                />
                            </div>

                            {error && (
                                <div style={{ padding: '0.75rem', marginBottom: '1rem', background: '#fee', color: '#c33', borderRadius: '0.5rem', fontSize: '0.875rem' }}>
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                style={{ width: '100%', padding: '0.75rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '0.5rem', fontSize: '1rem', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1 }}
                            >
                                {loading ? t('resetPassword.saving') : t('resetPassword.submit')}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
