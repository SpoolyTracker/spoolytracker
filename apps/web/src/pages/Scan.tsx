import { useState } from 'react';
import { Scan as ScanIcon, ArrowRight } from 'lucide-react';

export default function ScanPage() {
    const [scanned, setScanned] = useState(false);

    const handleSimulateScan = () => {
        setScanned(true);
        setTimeout(() => {
            alert("NFC Tag '04:A1:...' detected! \nSpool: Prusament PLA Galaxy Black identified.");
            setScanned(false);
        }, 1000);
    };

    return (
        <div className="flex flex-col items-center justify-center" style={{ height: '70vh' }}>
            <div className="card flex flex-col items-center gap-6" style={{ maxWidth: 400, width: '100%', padding: '3rem' }}>
                <div style={{
                    width: 120, height: 120,
                    borderRadius: '50%',
                    backgroundColor: scanned ? 'var(--success)' : 'rgba(99, 102, 241, 0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.3s'
                }}>
                    <ScanIcon size={60} color={scanned ? 'white' : 'var(--primary)'} />
                </div>

                <div className="text-center">
                    <h2 className="text-xl font-bold">Ready to Scan</h2>
                    <p className="text-muted mt-2">Place your spool on the reader (or click below to simulate)</p>
                </div>

                <button className="btn btn-primary w-full justify-center" onClick={handleSimulateScan}>
                    {scanned ? 'Scanning...' : 'Simulate NFC Scan'}
                    {!scanned && <ArrowRight size={18} />}
                </button>
            </div>
        </div>
    );
}
