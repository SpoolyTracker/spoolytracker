import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!email) {
            setError('Veuillez entrer votre adresse email');
            return;
        }

        setLoading(true);
        try {
            const res = await api.forgotPassword(email);
            setSuccess(res.message || 'Si cette adresse email correspond à un compte, un email de réinitialisation a été envoyé.');
        } catch (err: any) {
            setError(err.message || 'Une erreur est survenue');
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
                    <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                        Mot de passe oublié
                    </h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Entrez votre email pour recevoir un lien de réinitialisation.</p>
                </div>

                <div style={{
                    background: 'var(--card-bg)',
                    borderRadius: '1rem',
                    padding: '2rem',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                }}>
                    {success ? (
                        <div style={{ textAlign: 'center' }}>
                            <div style={{
                                padding: '1rem',
                                background: '#efe',
                                color: '#2a5',
                                borderRadius: '0.5rem',
                                marginBottom: '1.5rem',
                                fontSize: '0.9rem'
                            }}>
                                {success}
                            </div>
                            <Link to="/login" style={{
                                display: 'inline-block',
                                padding: '0.75rem 1.5rem',
                                background: 'var(--primary)',
                                color: 'white',
                                borderRadius: '0.5rem',
                                textDecoration: 'none',
                                fontWeight: '600'
                            }}>
                                Retour à la connexion
                            </Link>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit}>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: '0.875rem',
                                    fontWeight: '600',
                                    marginBottom: '0.5rem',
                                }}>
                                    Email
                                </label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value.toLowerCase())}
                                    placeholder="Entrez votre email"
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '0.75rem',
                                        border: '1px solid var(--border)',
                                        borderRadius: '0.5rem',
                                        fontSize: '1rem',
                                        background: 'var(--bg)',
                                        color: 'var(--text)'
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
                                    padding: '0.75rem',
                                    background: 'var(--primary)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '0.5rem',
                                    fontSize: '1rem',
                                    fontWeight: '600',
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    opacity: loading ? 0.6 : 1,
                                    marginBottom: '1rem'
                                }}
                            >
                                {loading ? 'Envoi...' : 'Envoyer le lien'}
                            </button>

                            <p style={{ textAlign: 'center', margin: 0 }}>
                                <Link to="/login" style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', textDecoration: 'none' }}>
                                    Retour à la connexion
                                </Link>
                            </p>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
