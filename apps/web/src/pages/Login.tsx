import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff } from 'lucide-react';
import { getEnv } from '../runtimeEnv';

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { login, loginWithSocial } = useAuth();
    const { mode } = useTheme();
    const navigate = useNavigate();
    const { t } = useTranslation();

    const handleGoogleResponse = useCallback(async (response: any) => {
        setLoading(true);
        setError('');
        try {
            await loginWithSocial('google', response.credential);
            navigate('/dashboard');
        } catch (err: any) {
            console.error("Social login failed", err);
            setError(err.message || 'Échec de la connexion Google');
        } finally {
            setLoading(false);
        }
    }, [loginWithSocial, navigate]);

    useEffect(() => {
        const clientId = getEnv('VITE_GOOGLE_CLIENT_ID', '');

        if (clientId && window.google) {
            const buttonDiv = document.getElementById("google-button");
            if (buttonDiv) {
                window.google.accounts.id.initialize({
                    client_id: clientId,
                    callback: handleGoogleResponse,
                });
                window.google.accounts.id.renderButton(
                    buttonDiv,
                    { theme: mode === 'dark' ? "filled_blue" : "outline", size: "large", width: 260 }
                );
            }
        }
    }, [mode, handleGoogleResponse]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!username || !password) {
            setError(t('login.errorMissingCredentials') || 'Please enter username and password');
            return;
        }

        setLoading(true);
        try {
            await login(username, password);
            navigate('/dashboard');
        } catch (err: any) {
            if (err.errorCode === 'ERR_INVALID_CREDENTIALS' || err.errorCode === 'ERR_USER_NOT_FOUND' || err.errorCode === 'ERR_INVALID_PASSWORD') {
                setError(t('login.errorInvalidCredentials'));
            } else if (err.errorCode === 'ERR_ACCOUNT_LOCKED') {
                setError(t('login.errorAccountLocked') || 'Trop de tentatives. Réessayez dans quelques minutes.');
            } else if (err.errorCode === 'ERR_ACCOUNT_INACTIVE') {
                setError(t('login.errorAccountInactive'));
            } else {
                setError(err.message || t('login.errorInvalidCredentials') || 'Invalid username or password');
            }
        } finally {
            setLoading(false);
        }
    };

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
                    <img src={mode === 'dark' ? '/logo/logo-horizontal-dark.png' : '/logo/logo-horizontal-light.png'} alt='logo-spoolytracker' style={{ height: 64, marginBottom: '1rem' }}></img>
                    <p style={{ color: 'var(--text-secondary)' }}>{t('login.title')}</p>
                </div>

                <div style={{
                    background: 'var(--card-bg)',
                    borderRadius: '1rem',
                    padding: '2rem',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                }}>
                    <form onSubmit={handleSubmit}>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={{
                                display: 'block',
                                fontSize: '0.875rem',
                                fontWeight: '600',
                                marginBottom: '0.5rem',
                            }}>
                                {t('login.username')}
                            </label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                                placeholder={t('login.enterUsername') || "Enter username"}
                                autoComplete="username"
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
                            <label style={{
                                display: 'block',
                                fontSize: '0.875rem',
                                fontWeight: '600',
                                marginBottom: '0.5rem',
                            }}>
                                {t('login.password')}
                            </label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder={t('login.enterPassword') || "Enter password"}
                                    autoComplete="current-password"
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
                            <div style={{ textAlign: 'right', marginTop: '0.5rem', marginBottom: '1.5rem' }}>
                                <Link to="/forgot-password" style={{ color: 'var(--primary)', fontSize: '0.875rem', fontWeight: '500', textDecoration: 'none' }}>Mot de passe oublié ?</Link>
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
                                    padding: '0.75rem',
                                    background: 'var(--primary)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '0.5rem',
                                    fontSize: '1rem',
                                    fontWeight: '600',
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    opacity: loading ? 0.6 : 1,
                                }}
                            >
                                {loading ? t('login.loggingIn') : t('login.signIn')}
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

                            <div id="google-button" style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem', minHeight: '40px' }}></div>

                            <p style={{
                                textAlign: 'center',
                                marginTop: '1.5rem',
                                fontSize: '0.875rem',
                                color: 'var(--text-secondary)',
                            }}>
                                Pas encore de compte ? <Link to="/signup" style={{ color: 'var(--primary)', fontWeight: '600', textDecoration: 'none' }}>S'inscrire</Link>
                            </p>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
