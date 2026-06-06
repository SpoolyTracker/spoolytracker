import React, { useState, useEffect } from 'react';
import { BASE_URL } from '../api';
import { useAuth } from '../contexts/AuthContext';

interface SecureImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    src?: string;
    fallbackSrc?: string;
}

export const SecureImage: React.FC<SecureImageProps> = ({ src, fallbackSrc, className, alt, ...rest }) => {
    const { token } = useAuth();
    const [objectUrl, setObjectUrl] = useState<string | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        let currentObjectUrl: string | null = null;
        let isMounted = true;

        if (!src) {
            setError(true);
            return;
        }

        // If it's a completely external URL or data URI, just use it directly
        if ((!src.startsWith(BASE_URL) && !src.startsWith('/') && src.startsWith('http')) || src.startsWith('data:')) {
            setObjectUrl(src);
            return;
        }

        // Handle relative URLs (with or without leading slash)
        const isAbsolute = src.startsWith('http');
        const fullUrl = isAbsolute ? src : `${BASE_URL}${src.startsWith('/') ? '' : '/'}${src}`;

        fetch(fullUrl, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        })
            .then(res => {
                if (!res.ok) throw new Error(`Network response was not ok: ${res.status}`);
                return res.blob();
            })
            .then(blob => {
                if (!isMounted) return;
                // Check if we received an HTML error page instead of an image
                if (blob.type.includes('text/html')) {
                    throw new Error('Received HTML instead of image');
                }
                currentObjectUrl = URL.createObjectURL(blob);
                setObjectUrl(currentObjectUrl);
            })
            .catch(err => {
                console.warn("SecureImage load failed:", err);
                if (isMounted) setError(true);
            });

        return () => {
            isMounted = false;
            if (currentObjectUrl) {
                URL.revokeObjectURL(currentObjectUrl);
            }
        };
    }, [src, token]);

    if (error) {
        if (fallbackSrc) return <img src={fallbackSrc} className={className} alt={alt} {...rest} />;
        return <div className={`bg-gray-200 dark:bg-zinc-800 flex items-center justify-center ${className}`} {...rest}><span className="text-gray-400 text-xs">No image</span></div>;
    }

    if (!objectUrl) {
        return <div className={`animate-pulse bg-gray-200 dark:bg-zinc-800 ${className}`} {...rest} />;
    }

    return <img src={objectUrl} className={className} alt={alt} {...rest} />;
};
