import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function VerifyEmailPage() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const id = searchParams.get('id');
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [message, setMessage] = useState('');
    const navigate = useNavigate();
    const { t } = useTranslation();
    const processedRef = useRef(false);

    useEffect(() => {
        if (!token) {
            setStatus('error');
            setMessage(t('verifyEmail.missingToken'));
            return;
        }

        if (processedRef.current) return;
        processedRef.current = true;

        const verify = async () => {
            try {
                const res = await api.verifyEmail(token, id || undefined);
                setStatus('success');
                setMessage(res.message);
            } catch (err: any) {
                setStatus('error');
                setMessage(err.message || t('verifyEmail.invalidToken'));
            }
        };

        verify();
    }, [token, id, t]);

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
                {status === 'loading' && (
                    <>
                        <Loader2 className="animate-spin" size={48} color="var(--primary)" style={{ margin: '0 auto 1.5rem' }} />
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
                            {t('verifyEmail.verifying')}
                        </h2>
                        <p style={{ color: 'var(--text-secondary)' }}>
                            {t('verifyEmail.verifyingSubtitle')}
                        </p>
                    </>
                )}

                {status === 'success' && (
                    <>
                        <CheckCircle size={48} color="#4caf50" style={{ margin: '0 auto 1.5rem' }} />
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
                            {t('verifyEmail.successTitle')}
                        </h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                            {message}
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
                            {t('verifyEmail.backToLogin')}
                        </button>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <AlertCircle size={48} color="#f44336" style={{ margin: '0 auto 1.5rem' }} />
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
                            {t('verifyEmail.errorTitle')}
                        </h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                            {message}
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
                                {t('verifyEmail.backToLogin')}
                            </button>
                            <Link to="/signup" style={{ color: 'var(--primary)', fontSize: '0.875rem', textDecoration: 'none' }}>
                                {t('verifyEmail.createNewAccount')}
                            </Link>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
