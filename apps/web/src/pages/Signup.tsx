import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { api } from '../api';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { appConfig } from '../config';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\-\/\\+\*@#_]).{8,}$/;

export default function SignupPage() {
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        organizationName: '',
    });
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const { mode } = useTheme();
    const { loginWithSocial } = useAuth();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const passwordRequirements = t('signup.passwordRequirements');

    useEffect(() => {
        // Initialize Google Identity Services
        const clientId = appConfig.googleClientId;
        if (clientId && window.google) {
            const buttonDiv = document.getElementById("google-signup-button");
            if (buttonDiv) {
                window.google.accounts.id.initialize({
                    client_id: clientId,
                    callback: handleGoogleResponse,
                });
                window.google.accounts.id.renderButton(
                    buttonDiv,
                    { theme: mode === 'dark' ? "filled_blue" : "outline", size: "large", width: 386 }
                );
            }
        }
    }, [mode]);

    const handleGoogleResponse = async (response: any) => {
        setLoading(true);
        setError('');
        try {
            await loginWithSocial('google', response.credential);
            navigate('/dashboard');
        } catch (err: any) {
            setError(err.message || 'Échec de la connexion Google');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!formData.username || !formData.email || !formData.password || !formData.organizationName) {
            setError(t('signup.errorFields'));
            return;
        }

        if (!PASSWORD_REGEX.test(formData.password)) {
            setError(passwordRequirements);
            return;
        }

        if (formData.password !== confirmPassword) {
            setError(t('signup.passwordMismatch'));
            return;
        }

        setLoading(true);
        try {
            await api.signup(formData);
            setSuccess(true);
        } catch (err: any) {
            setError(err.message || 'Signup failed');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--bg)',
                padding: '1rem'
            }}>
                <div style={{
                    width: '100%',
                    maxWidth: '450px',
                    background: 'var(--card-bg)',
                    borderRadius: '1rem',
                    padding: '2.5rem',
                    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
                    textAlign: 'center'
                }}>
                    <div style={{
                        width: '80px',
                        height: '80px',
                        background: '#e8f5e9',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1.5rem'
                    }}>
                        <span style={{ fontSize: '3rem' }}>✉️</span>
                    </div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
                        {t('signup.successTitle')}
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: '1.6' }}>
                        {t('signup.successMessage', { email: formData.email })}
                    </p>
                    <button
                        onClick={() => navigate('/login')}
                        style={{
                            width: '100%',
                            padding: '0.75rem',
                            background: 'var(--primary)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '0.5rem',
                            fontSize: '1rem',
                            fontWeight: '600',
                            cursor: 'pointer'
                        }}
                    >
                        {t('signup.backToLogin')}
                    </button>
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
            padding: '1rem'
        }}>
            <div style={{
                width: '100%',
                maxWidth: '450px',
            }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <img src={mode === 'dark' ? '/logo/logo-horizontal-dark.png' : '/logo/logo-horizontal-light.png'} alt='logo-spoolytracker' style={{ height: 64, marginBottom: '1rem' }}></img>
                    <p style={{ color: 'var(--text-secondary)' }}>{t('signup.subtitle')}</p>
                </div>

                <div style={{
                    background: 'var(--card-bg)',
                    borderRadius: '1rem',
                    padding: '2rem',
                    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
                }}>
                    <form onSubmit={handleSubmit}>
                        <div style={{ marginBottom: '1.25rem' }}>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                                {t('signup.username')}
                            </label>
                            <input
                                name="username"
                                type="text"
                                value={formData.username}
                                onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase() })}
                                placeholder={t('signup.usernamePlaceholder') || ''}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    border: '1px solid var(--border)',
                                    borderRadius: '0.5rem',
                                    fontSize: '1rem',
                                    background: 'var(--bg)',
                                }}
                            />
                            {formData.username.includes(' ') && (
                                <p style={{
                                    fontSize: '0.75rem',
                                    color: '#ea580c', // Orange for warning
                                    marginTop: '0.5rem',
                                    marginBottom: '1.25rem',
                                    lineHeight: '1.4'
                                }}>
                                    {t('signup.usernameSpacesWarning')}
                                </p>
                            )}

                        </div>

                        <div style={{ marginBottom: '1.25rem' }}>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                                {t('signup.email')}
                            </label>
                            <input
                                name="email"
                                type="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder={t('signup.emailPlaceholder') || ''}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    border: '1px solid var(--border)',
                                    borderRadius: '0.5rem',
                                    fontSize: '1rem',
                                    background: 'var(--bg)',
                                }}
                            />
                        </div>

                        <div style={{ marginBottom: '0.25rem' }}>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                                {t('signup.password')}
                            </label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    name="password"
                                    type={showPassword ? "text" : "password"}
                                    value={formData.password}
                                    onChange={handleChange}
                                    placeholder={t('signup.passwordPlaceholder') || ''}
                                    autoComplete="new-password"
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        border: '1px solid var(--border)',
                                        borderRadius: '0.5rem',
                                        fontSize: '1rem',
                                        background: 'var(--bg)',
                                        paddingRight: '2.5rem',
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    style={{
                                        position: 'absolute',
                                        right: '0.75rem',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        color: 'var(--text-secondary)',
                                    }}
                                >
                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                            <p style={{
                                fontSize: '0.75rem',
                                color: 'var(--text-secondary)',
                                marginTop: '0.5rem',
                                marginBottom: '1.25rem',
                                lineHeight: '1.4'
                            }}>
                                {passwordRequirements}
                            </p>
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                                {t('signup.confirmPassword')}
                            </label>
                            <input
                                type={showPassword ? "text" : "password"}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder={t('signup.confirmPasswordPlaceholder')}
                                required
                                autoComplete="new-password"
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    border: '1px solid var(--border)',
                                    borderRadius: '0.5rem',
                                    fontSize: '1rem',
                                    background: 'var(--bg)',
                                }}
                            />
                        </div>

                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                                {t('signup.organization')}
                            </label>
                            <input
                                name="organizationName"
                                type="text"
                                value={formData.organizationName}
                                onChange={handleChange}
                                placeholder={t('signup.organizationPlaceholder') || ''}
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    border: '1px solid var(--border)',
                                    borderRadius: '0.5rem',
                                    fontSize: '1rem',
                                    background: 'var(--bg)',
                                }}
                            />
                        </div>

                        {error && (
                            <div style={{
                                padding: '0.75rem',
                                marginBottom: '1rem',
                                background: '#fee',
                                color: '#c33',
                                borderRadius: '0.5rem',
                                fontSize: '0.875rem',
                            }}>
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                width: '100%',
                                padding: '0.875rem',
                                background: 'var(--primary)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '0.5rem',
                                fontSize: '1rem',
                                fontWeight: '600',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                opacity: loading ? 0.6 : 1,
                                marginBottom: '1.5rem'
                            }}
                        >
                            {loading ? t('signup.loading') : t('signup.submit')}
                        </button>

                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            margin: '1.5rem 0',
                            color: 'var(--text-secondary)',
                            fontSize: '0.875rem'
                        }}>
                            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
                            <span style={{ padding: '0 1rem' }}>OU</span>
                            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
                        </div>

                        <div id="google-signup-button" style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem', minHeight: '40px' }}></div>

                        <div style={{ textAlign: 'center', fontSize: '0.875rem' }}>
                            {t('signup.hasAccount')} <Link to="/login" style={{ color: 'var(--primary)', fontWeight: '600', textDecoration: 'none' }}>{t('signup.loginLink')}</Link>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
