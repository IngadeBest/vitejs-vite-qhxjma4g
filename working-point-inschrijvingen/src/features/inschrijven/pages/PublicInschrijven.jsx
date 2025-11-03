import React, { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import InschrijvingForm from '@/features/inschrijven/components/InschrijvingForm';
import { notifyOrganisator } from '@/lib/notifyOrganisator';

const PublicInschrijven = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (formData) => {
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
            {error && <p className="error">{error}</p>}
            {success && <p className="success">Inschrijving succesvol!</p>}
            <InschrijvingForm onSubmit={handleSubmit} loading={loading} />
        </div>
    );
};

export default PublicInschrijven;