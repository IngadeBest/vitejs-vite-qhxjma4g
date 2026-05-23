import React, { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import InschrijvingForm from '@/features/inschrijven/components/InschrijvingForm';
import { notifyOrganisator } from '@/lib/notifyOrganisator';
import { REGISTRATION_MAINTENANCE, REGISTRATION_MAINTENANCE_MESSAGE } from '@/config/maintenance';

const PublicInschrijven = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (formData) => {
        if (REGISTRATION_MAINTENANCE) {
            setError(REGISTRATION_MAINTENANCE_MESSAGE);
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(false);

        try {
            const { data, error } = await supabase
                .from('inschrijvingen')
                .insert([formData]);

            if (error) throw error;

            await notifyOrganisator(data[0]);
            setSuccess(true);
        } catch (error) {
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <h1>Inschrijven</h1>
            {REGISTRATION_MAINTENANCE && (
                <div role="status" style={{ background: '#eef4ff', border: '1px solid #b8cdf8', padding: 12, borderRadius: 6, marginBottom: 16 }}>
                    <strong>Inschrijven tijdelijk gesloten.</strong>
                    <p>{REGISTRATION_MAINTENANCE_MESSAGE}</p>
                </div>
            )}
            {error && <p className="error">{error}</p>}
            {success && <p className="success">Inschrijving succesvol!</p>}
            <InschrijvingForm onSubmit={handleSubmit} loading={loading || REGISTRATION_MAINTENANCE} />
        </div>
    );
};

export default PublicInschrijven;
